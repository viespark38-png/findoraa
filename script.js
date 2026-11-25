// Findora shared-database version. Uses Supabase so all visitors read/write the same reports.
"use strict";

const SUPABASE_URL = window.FINDORA_SUPABASE_URL;
const SUPABASE_KEY = window.FINDORA_SUPABASE_ANON_KEY;
const TABLE = "reports";
const todayDate = new Date();
const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,"0")}-${String(todayDate.getDate()).padStart(2,"0")}`;
document.getElementById("itemDate").max = today;

let supabaseClient;
let reports = [];
let realtimeChannel;

function showMessage(elementId, message, success=false) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `form-message ${success ? "success" : "error"}`;
}
function connectionMessage(message, state="") {
  const el = document.getElementById("connectionMessage");
  el.textContent = message;
  el.className = `connection-message ${state}`;
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function normalize(row) {
  return {
    id: row.id, type: row.report_type, name: row.item_name, category: row.category,
    description: row.description, date: row.item_date, location: row.location,
    reporter: row.reporter_name, contact: row.contact_info, picture: row.picture || "",
    status: row.status
  };
}
async function loadReports() {
  const { data, error } = await supabaseClient.from(TABLE).select("*").order("created_at", {ascending:false});
  if (error) throw error;
  reports = (data || []).map(normalize);
  renderItems();
  connectionMessage("Connected — reports are shared with everyone using this Findora website.", "success");
}
function updateSummary() {
  let lost=0, found=0, resolved=0;
  for (const report of reports) {
    if (report.type === "Lost Item") lost++;
    else if (report.type === "Found Item") found++;
    if (report.status === "Claimed" || report.status === "Returned") resolved++;
  }
  document.getElementById("totalCount").textContent = reports.length;
  document.getElementById("lostCount").textContent = lost;
  document.getElementById("foundCount").textContent = found;
  document.getElementById("resolvedCount").textContent = resolved;
}
function renderItems() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  const category = document.getElementById("categoryFilter").value;
  const filtered = reports.filter(r => {
    const text = `${r.name} ${r.description} ${r.location} ${r.category}`.toLowerCase();
    return text.includes(keyword) && (type==="All" || r.type===type) && (category==="All" || r.category===category);
  });
  const grid = document.getElementById("itemGrid");
  grid.innerHTML = "";
  for (const report of filtered) {
    const card = document.createElement("article");
    card.className = "item-card";
    const emoji = report.category==="Books & School Supplies"?"📚":report.category==="Electronics"?"🎧":report.category==="ID & Cards"?"🪪":report.category==="Accessories"?"🎒":"🎁";
    const picture = report.picture ? `<img src="${report.picture}" alt="Picture of ${escapeHTML(report.name)}">` : `<span aria-hidden="true">${emoji}</span>`;
    card.innerHTML = `<div class="item-picture">${picture}</div><div class="item-content">
      <div class="item-top"><span class="pill ${report.type==="Found Item"?"found":"lost"}">${report.type==="Found Item"?"😊 FOUND":"🔍 LOST"}</span><span class="category-pill">${escapeHTML(report.category)}</span></div>
      <h3>${escapeHTML(report.name)}</h3><p>${escapeHTML(report.description)}</p>
      <div class="item-meta"><span>📍 ${escapeHTML(report.location)}</span><span>🗓️ ${escapeHTML(report.date)}</span><span>● ${escapeHTML(report.status)}</span></div>
      <button class="details-button" type="button" data-report-id="${report.id}">View Details →</button></div>`;
    grid.appendChild(card);
  }
  document.getElementById("resultCount").textContent = `${filtered.length} item${filtered.length===1?"":"s"}`;
  document.getElementById("emptyState").hidden = filtered.length!==0;
  updateSummary();
  updateStatusOptions();
}
function updateStatusOptions() {
  const select = document.getElementById("statusItem");
  const previous = select.value;
  select.innerHTML = '<option value="">Choose a report</option>';
  for (const report of reports) {
    const option=document.createElement("option");
    option.value=String(report.id);
    option.textContent=`${report.name} — ${report.type} (${report.status})`;
    select.appendChild(option);
  }
  if (reports.some(r=>String(r.id)===previous)) select.value=previous;
}
function subscribeToChanges() {
  realtimeChannel = supabaseClient.channel("findora-reports-live")
    .on("postgres_changes",{event:"*",schema:"public",table:TABLE},async payload=>{
      try { await loadReports(); }
      catch(error){ console.error(error); connectionMessage("Live update received, but refreshing reports failed. Reload the page.", "error"); }
    }).subscribe((status)=>{
      if(status==="CHANNEL_ERROR" || status==="TIMED_OUT") {
        connectionMessage("Database connected, but live updates could not start. Refresh to see new reports.", "error");
      }
    });
}

document.getElementById("reportForm").addEventListener("submit", async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  try {
    const type=document.getElementById("reportType").value;
    const name=document.getElementById("itemName").value.trim();
    const category=document.getElementById("itemCategory").value;
    const description=document.getElementById("itemDescription").value.trim();
    const date=document.getElementById("itemDate").value;
    const location=document.getElementById("itemLocation").value.trim();
    const reporter=document.getElementById("reporterName").value.trim();
    const contact=document.getElementById("contactInfo").value.trim();
    const file=document.getElementById("itemPicture").files[0];
    if(!type||!name||!category||!description||!date||!location||!reporter||!contact) throw new Error("Please complete all required fields.");
    if(date>today) throw new Error("The date cannot be in the future.");
    if(file && !["image/jpeg","image/png"].includes(file.type)) throw new Error("Please upload a JPG, JPEG, or PNG image.");
    if(file && file.size>700_000) throw new Error("Please choose an image smaller than 700 KB for this prototype.");
    let picture="";
    if(file) picture=await new Promise((resolve,reject)=>{
      const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("The picture could not be read.")); reader.readAsDataURL(file);
    });
    const record={report_type:type,item_name:name,category,description,item_date:date,location,reporter_name:reporter,contact_info:contact,picture,status:"Available"};
    const {error}=await supabaseClient.from(TABLE).insert(record);
    if(error) throw error;
    event.currentTarget.reset();
    document.getElementById("itemDate").max=today;
    showMessage("formMessage","Report submitted! It is now shared with everyone.",true);
    await loadReports();
  } catch(error) {
    showMessage("formMessage",error.message || "Could not submit the report. Check your database setup.",false);
  } finally { button.disabled=false; }
});

document.getElementById("statusForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=event.currentTarget.querySelector('button[type="submit"]');
  button.disabled=true;
  try {
    const id=Number(document.getElementById("statusItem").value);
    const newType=document.getElementById("newReportType").value;
    const newStatus=document.getElementById("newStatus").value;
    const verified=document.getElementById("ownershipVerified").checked;
    const current=reports.find(r=>Number(r.id)===id);
    if(!current) throw new Error("Please select an item.");
    if(!newType && !newStatus) throw new Error("Choose a report type or status to change.");
    if((newStatus==="Claimed" || newStatus==="Returned" || newType==="Found Item") && !verified) throw new Error("Please confirm that the item or claim has been checked.");
    const changes={};
    if(newType) changes.report_type=newType;
    if(newStatus) changes.status=newStatus;
    const {error}=await supabaseClient.from(TABLE).update(changes).eq("id",id);
    if(error) throw error;
    event.currentTarget.reset();
    showMessage("statusMessage","Changes saved and shared with everyone.",true);
    await loadReports();
  } catch(error) {
    showMessage("statusMessage",error.message || "Could not update this item.",false);
  } finally { button.disabled=false; }
});

document.getElementById("itemGrid").addEventListener("click",event=>{
  const button=event.target.closest("[data-report-id]");
  if(!button)return;
  const r=reports.find(item=>String(item.id)===button.dataset.reportId);
  if(!r)return;
  alert(`Item: ${r.name}\nType: ${r.type}\nCategory: ${r.category}\nDescription: ${r.description}\nLocation: ${r.location}\nDate: ${r.date}\nStatus: ${r.status}\nFor contact, please coordinate through authorized school personnel.`);
});
document.getElementById("searchInput").addEventListener("input",renderItems);
document.getElementById("searchButton").addEventListener("click",renderItems);
document.getElementById("typeFilter").addEventListener("change",renderItems);
document.getElementById("categoryFilter").addEventListener("change",renderItems);

async function startFindora() {
  if(!window.supabase || !SUPABASE_URL || !SUPABASE_KEY ||
     SUPABASE_URL.includes("PASTE_YOUR") || SUPABASE_KEY.includes("PASTE_YOUR")) {
    connectionMessage("Setup needed: add your Supabase Project URL and anon/publishable key in supabase-config.js.", "error");
    return;
  }
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  try { await loadReports(); subscribeToChanges(); }
  catch(error) {
    console.error("Findora database error:",error);
    connectionMessage(`Database setup error: ${error.message}. Check the SQL setup and Supabase keys.`, "error");
  }
}
startFindora();
