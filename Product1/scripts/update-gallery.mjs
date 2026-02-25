import fs from "node:fs/promises";

async function readJsonFile(path){
  try{
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function parseJsonEnv(name){
  const raw = process.env[name];
  if(!raw) return null;
  try{
    return JSON.parse(raw);
  }catch(err){
    throw new Error(`Invalid JSON in env var ${name}: ${err.message}`);
  }
}

const jsonConfigFromSecret = parseJsonEnv("DROPBOX_CONFIG_JSON");
const jsonConfigFromFile = await readJsonFile(process.env.DROPBOX_CONFIG_PATH || "Product1/dropbox-config.json");
const resolvedConfig = jsonConfigFromSecret || jsonConfigFromFile || {};

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || resolvedConfig.appKey;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || resolvedConfig.appSecret;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN || resolvedConfig.refreshToken;
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || resolvedConfig.accessToken;
const DROPBOX_FOLDER_PATH = process.env.DROPBOX_FOLDER_PATH || resolvedConfig.folderPath || "/Product1";

const OUTPUT_PATH = process.env.OUTPUT_PATH || "Product1/gallery.json";
const MAX_IMAGES = parseInt(process.env.MAX_IMAGES || "200", 10);

function assertEnv(name, val){ if(!val) throw new Error(`Missing env var: ${name}`); }
function isImage(name){
  const n = (name || "").toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp") || n.endsWith(".gif");
}
function toRaw(link){
  if(link.includes("dl=0")) return link.replace("dl=0", "raw=1");
  if(link.includes("dl=1")) return link.replace("dl=1", "raw=1");
  return link.includes("?") ? (link.includes("raw=1") ? link : link + "&raw=1") : (link + "?raw=1");
}

async function requestAccessTokenFromRefreshToken(){
  assertEnv("DROPBOX_APP_KEY", DROPBOX_APP_KEY);
  assertEnv("DROPBOX_APP_SECRET", DROPBOX_APP_SECRET);
  assertEnv("DROPBOX_REFRESH_TOKEN", DROPBOX_REFRESH_TOKEN);

  const basic = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString("base64");

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: DROPBOX_REFRESH_TOKEN
    })
  });

  if(!res.ok){
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getAccessToken(){
  if(DROPBOX_ACCESS_TOKEN){
    return DROPBOX_ACCESS_TOKEN;
  }

  return requestAccessTokenFromRefreshToken();
}

async function dbxPost(accessToken, endpoint, bodyObj){
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bodyObj)
  });
  const txt = await res.text();
  if(!res.ok) throw new Error(`Dropbox API ${endpoint} failed: ${res.status} ${txt}`);
  return JSON.parse(txt);
}

async function listAllFiles(accessToken, path){
  let out = await dbxPost(accessToken, "files/list_folder", {
    path,
    recursive: false,
    include_deleted: false,
    include_non_downloadable_files: false
  });
  let entries = out.entries || [];
  while(out.has_more){
    out = await dbxPost(accessToken, "files/list_folder/continue", { cursor: out.cursor });
    entries = entries.concat(out.entries || []);
  }
  return entries;
}

async function getOrCreateSharedLink(accessToken, filePath){
  const listed = await dbxPost(accessToken, "sharing/list_shared_links", {
    path: filePath,
    direct_only: true
  });

  if(listed.links && listed.links.length > 0){
    return listed.links[0].url;
  }

  // Create one if none exists
  const created = await dbxPost(accessToken, "sharing/create_shared_link_with_settings", { path: filePath });
  return created.url;
}

function canFallbackToRefreshToken(err){
  if(!DROPBOX_ACCESS_TOKEN) return false;
  if(!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) return false;

  const msg = String(err && err.message ? err.message : err);
  return msg.includes(" 401 ") || msg.includes("invalid_access_token") || msg.includes("expired_access_token");
}

async function main(){
  let token = await getAccessToken();
  let usedRefreshFallback = false;

  let entries;
  try{
    entries = await listAllFiles(token, DROPBOX_FOLDER_PATH);
  }catch(err){
    if(!canFallbackToRefreshToken(err)) throw err;
    console.warn("Provided DROPBOX_ACCESS_TOKEN failed; falling back to refresh-token OAuth flow.");
    token = await requestAccessTokenFromRefreshToken();
    usedRefreshFallback = true;
    entries = await listAllFiles(token, DROPBOX_FOLDER_PATH);
  }

  const files = entries
    .filter(e => e[".tag"] === "file")
    .filter(e => isImage(e.name))
    .sort((a,b) => new Date(b.server_modified || 0) - new Date(a.server_modified || 0))
    .slice(0, MAX_IMAGES);

  const urls = [];
  for(const f of files){
    const path = f.path_lower || f.path_display;
    const shared = await getOrCreateSharedLink(token, path);
    urls.push(toRaw(shared));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    dropboxFolderPath: DROPBOX_FOLDER_PATH,
    images: urls
  };

  await fs.mkdir(OUTPUT_PATH.split("/").slice(0,-1).join("/") || ".", { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${urls.length} image URLs to ${OUTPUT_PATH}${usedRefreshFallback ? " (refresh fallback used)" : ""}`);
}

main().catch(err => { console.error(err); process.exit(1); });
