// Estado salvo, helpers de tela (toast, confirmação), regras das peças e navegação entre etapas.

// ===================== ESTADO =====================
// "?online" na URL liga o modo telão com celulares. O jogo salvo fica separado do modo offline.
// O modo online foi desligado depois da apresentação (sem projeto Firebase ativo).
// Para religar, troque ONLINE_ENABLED para true e configure js/firebase-config.js.
const ONLINE_ENABLED = false;
const ONLINE = ONLINE_ENABLED && new URLSearchParams(location.search).has("online");
const STORAGE_KEY = ONLINE ? "agp_state_online" : "agp_state";
if(ONLINE) document.body.classList.add("online");
let state = loadState() || freshState();
function freshState(){
  return {
    phase:"setup",
    budget:DEFAULT_BUDGET, laps:5, premiumStock:0,
    teams:[],            // {id,name,emoji,color,car,choices:{partId:'P'|'E'|'M'},locked}
    draftOrder:[],       // array de teamId na ordem sorteada de escolha
    race:null,
  };
}
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function loadState(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)); }catch(e){ return null; } }

// ===================== HELPERS =====================
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
function d6(){ return 1+Math.floor(Math.random()*6); }

// aviso estilizado no topo da tela (some sozinho). kind: "warn" | "error" | "ok"
function toast(msg, kind="warn", ms=3500){
  let host=$("#toasts");
  if(!host){ host=document.createElement("div"); host.id="toasts"; host.className="toasts"; document.body.appendChild(host); }
  const icon={warn:"⚠️", error:"⛔", ok:"✅"}[kind]||"ℹ️";
  const el=document.createElement("div");
  el.className=`toast ${kind}`;
  el.innerHTML=`<span class="ticon">${icon}</span><span>${msg}</span>`;
  host.appendChild(el);
  const close=()=>{ el.classList.add("out"); setTimeout(()=>el.remove(),250); };
  el.onclick=close;
  setTimeout(close, ms);
}
// confirmação estilizada; devolve Promise<boolean>
function askConfirm(msg, okLabel="Confirmar", icon="❓", danger=false){
  return new Promise(resolve=>{
    const ov=document.createElement("div");
    ov.className="overlay";
    ov.innerHTML=`<div class="askpop">
      <div class="aicon">${icon}</div>
      <p>${msg}</p>
      <div class="row">
        <button class="btn ghost" data-a="no">Cancelar</button>
        <button class="btn ${danger?'red':'green'}" data-a="yes">${okLabel}</button>
      </div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ ov.remove(); resolve(v); };
    ov.querySelector('[data-a="yes"]').onclick=()=>done(true);
    ov.querySelector('[data-a="no"]').onclick=()=>done(false);
    ov.onclick=e=>{ if(e.target===ov) done(false); };
  });
}

function premiumStockValue(){
  if(state.premiumStock && state.premiumStock>0) return state.premiumStock;
  return Math.max(1, Math.ceil(state.teams.length/2)); // metade das equipes, p/ cima
}
function premiumBought(partId, exceptTeamId){
  return state.teams.filter(t=>t.id!==exceptTeamId && t.choices[partId]==="P").length;
}

function teamSpent(team){
  let s=0;
  for(const p of PARTS){
    const c=team.choices[p.id];
    if(c==="P") s+=CFG[p.id].P.cost;
    else if(c==="E") s+=CFG[p.id].E.cost;
  }
  return s;
}
function teamMadeCount(team){ return PARTS.filter(p=>team.choices[p.id]==="M").length; }
function teamBoughtCount(team){ return PARTS.filter(p=>["P","E"].includes(team.choices[p.id])).length; }
function teamPremCount(team){ return PARTS.filter(p=>team.choices[p.id]==="P").length; }
function teamComplete(team){ return PARTS.every(p=>team.choices[p.id]); }

// notas base do carro (com penalidade de oficina improvisada acima da capacidade)
function baseNotes(team){
  const notes={};
  for(const p of PARTS){
    const c=team.choices[p.id]||"M";
    notes[p.id]=CFG[p.id][c].note;
  }
  const made=PARTS.filter(p=>team.choices[p.id]==="M").map(p=>p.id);
  made.slice(MAKE_CAP).forEach(pid=> notes[pid]-=IMPROV_PENALTY);
  return notes;
}

// ===================== NAV =====================
function setPhase(ph){
  state.phase=ph; saveState();
  $$(".step").forEach(s=>{
    s.classList.remove("active","done");
    const order=["setup","buy","race","results"];
    const si=order.indexOf(s.dataset.step), ci=order.indexOf(ph);
    if(si<ci) s.classList.add("done");
    if(si===ci) s.classList.add("active");
  });
  ["setup","buy","race","results"].forEach(v=> $("#view-"+v).classList.toggle("hide", v!==ph));
  if(ph==="setup") renderSetup();
  if(ph==="buy") renderBuy();
  if(ph==="race") renderRace();
  if(ph==="results") renderResults();
  if(window.onlinePhase) window.onlinePhase(ph); // modo online ajusta as telas depois de desenhar
}
