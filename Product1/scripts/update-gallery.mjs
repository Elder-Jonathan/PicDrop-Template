import fs from "node:fs/promises";

const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_FOLDER_PATH = process.env.DROPBOX_FOLDER_PATH || "/Product1";

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

async function getAccessToken(){
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

async function main(){
  const token = await getAccessToken();
  const entries = await listAllFiles(token, DROPBOX_FOLDER_PATH);

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
  console.log(`Wrote ${urls.length} image URLs to ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });