const $ = (sel) => document.querySelector(sel);

let toastTimer = null;
function toast(msg, ms=1400){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.hidden = false;
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function haptic(){
  if(navigator.vibrate) navigator.vibrate(12);
}

function safeUrl(url){
  try { return new URL(url).toString(); }
  catch { return ""; }
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    haptic();
    toast("Copied!");
    return true;
  }catch{
    toast("Copy failed — use address bar");
    return false;
  }
}

async function shareLink({title, text, url}){
  try{
    if(navigator.share){
      await navigator.share({title, text, url});
      haptic();
      return true;
    }
  }catch{}
  return false;
}

async function fetchJson(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return await res.json();
}

function setHref(el, href){
  const u = safeUrl(href);
  if(!u){
    el.setAttribute("href", "#");
    el.setAttribute("aria-disabled", "true");
    el.onclick = (e) => e.preventDefault();
  }else{
    el.removeAttribute("aria-disabled");
    el.setAttribute("href", u);
    el.onclick = null;
  }
}

function pageUrl(){
  return window.location.href.split("?")[0];
}

async function initProductPage(){
  let cfg;
  try{
    cfg = await fetchJson("config.json");
  }catch(e){
    console.error(e);
    cfg = {
      productId: "productX",
      title: "Droppic",
      subtitle: "Upload your photos here.",
      uploadUrl: "",
      notes: ["Upload is not configured yet."]
    };
  }

  // UI text
  $("#title").textContent = cfg.title || "Droppic";
  $("#subtitle").textContent = cfg.subtitle || "Upload your photos here.";
  $("#productId").textContent = cfg.productId || "";

  // Primary: Upload (Dropbox File Request)
  setHref($("#uploadBtn"), cfg.uploadUrl || "");
  setHref($("#bbUpload"), cfg.uploadUrl || "");

  // Notes
  const list = $("#notes");
  list.innerHTML = "";
  (cfg.notes || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    list.appendChild(li);
  });

  // Share/copy
  const payload = {
    title: cfg.title || "Droppic",
    text: "Upload photos here:",
    url: pageUrl()
  };

  $("#shareBtn").onclick = async () => {
    const ok = await shareLink(payload);
    if(!ok){
      await copyText(payload.url);
      toast("Share not supported — link copied");
    }
  };
  $("#copyBtn").onclick = () => copyText(payload.url);

  $("#bbShare").onclick = async () => {
    const ok = await shareLink(payload);
    if(!ok){
      await copyText(payload.url);
      toast("Share not supported — link copied");
    }
  };
  $("#bbCopy").onclick = () => copyText(payload.url);

  // Copy upload link
  $("#copyUploadBtn").onclick = async () => {
    const u = safeUrl(cfg.uploadUrl || "");
    if(!u){
      toast("Upload link not set");
      return;
    }
    await copyText(u);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  if(document.body.dataset.page === "product"){
    initProductPage();
  }
});