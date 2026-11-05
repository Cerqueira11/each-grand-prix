// Etapa 2: montagem do carro de cada equipe.

// ===================== BUY =====================
let activeTeamId=null;

// equipes na ordem do draft (fallback: ordem de cadastro)
function teamsInDraftOrder(){
  if(state.draftOrder.length===state.teams.length)
    return state.draftOrder.map(id=>state.teams.find(t=>t.id===id)).filter(Boolean);
  return state.teams;
}
function renderBuy(){
  renderBuyDraftLine();
  renderTeamTabs();
  if(!activeTeamId || !state.teams.find(t=>t.id===activeTeamId))
    activeTeamId=teamsInDraftOrder()[0]?.id;
  renderActiveTeam();
}
function renderBuyDraftLine(){
  const el=$("#buyDraftLine");
  el.innerHTML = teamsInDraftOrder().map((t,i)=>
    `<div class="draftpill${t.id===activeTeamId?' turn':''}"><span class="n">${i+1}º</span> ${t.emoji} ${t.name} ${t.locked?'✅':''}</div>`
  ).join("");
}
function renderTeamTabs(){
  const tabs=$("#teamTabs"); tabs.innerHTML="";
  teamsInDraftOrder().forEach(t=>{
    const b=document.createElement("div");
    b.className="teamtab"+(t.id===activeTeamId?" active":"")+(t.locked?" done":"");
    b.innerHTML=`${t.emoji} ${t.name} ${t.locked?'✅':''}`;
    b.onclick=()=>{ activeTeamId=t.id; renderBuy(); };
    tabs.appendChild(b);
  });
}
const OPT_META = {
  P:{ icon:"🏆", label:"Premium",  note:"garantia · preço travado" },
  E:{ icon:"💰", label:"Econômico",note:"sem garantia" },
  M:{ icon:"🔧", label:"Oficina",  note:"grátis · controle total" },
};
function renderActiveTeam(){
  const team=state.teams.find(t=>t.id===activeTeamId);
  if(!team) return;
  $("#activeTeamName").textContent=`${team.emoji} ${team.name}`;
  const made=teamMadeCount(team);
  const madeTag = made>MAKE_CAP
    ? ` <span class="tag" style="color:var(--red)">🔧 ${made} na oficina (${made-MAKE_CAP} improvisada)</span>`
    : ` <span class="tag">🔧 Oficina ${made}/${MAKE_CAP}</span>`;
  const premCount=teamPremCount(team);
  $("#makeCounter").innerHTML=` <span class="tag"${premCount>=PREM_CAP?' style="color:var(--accent)"':''}>🏆 Premium ${premCount}/${PREM_CAP}</span>`+madeTag;

  const spent=teamSpent(team), left=state.budget-spent;
  $("#budgetText").innerHTML=`<strong style="color:${left<0?'var(--red)':'var(--green)'}">${left}</strong> / ${state.budget}`;
  const bar=$("#budgetBar"); bar.classList.toggle("over", left<0);
  bar.firstElementChild.style.width=Math.min(100,(spent/state.budget)*100)+"%";

  const grid=$("#partsGrid"); grid.innerHTML="";
  PARTS.forEach(p=>{
    const sel=team.choices[p.id];
    const stock=premiumStockValue();
    const usedPrem=premiumBought(p.id, team.id);
    const premSoldOut = usedPrem>=stock && sel!=="P";
    const premCapped  = premCount>=PREM_CAP && sel!=="P"; // já tem 2 premium em outras peças
    const makeImprov = made>=MAKE_CAP && sel!=="M"; // selecionar mais oficina gera improviso (permitido, só avisa)

    const div=document.createElement("div");
    div.className="part";
    let optsHtml="";
    ["P","E","M"].forEach(o=>{
      const m=OPT_META[o], cfg=CFG[p.id][o];
      const price = o==="M" ? "grátis" : "💰"+cfg.cost;
      const extra = o==="P" ? (premSoldOut?"· esgotado":premCapped?"· limite de 2":"· estoque "+(stock-usedPrem))
                  : o==="M" ? (makeImprov?"· -2 (improviso)":"") : "";
      const disabled = o==="P" && (premSoldOut || premCapped);
      optsHtml+=`
        <div class="opt ${sel===o?'sel':''} ${disabled?'disabled':''}" data-part="${p.id}" data-opt="${o}">
          <span class="k">${m.icon} ${m.label} <span class="v">${m.note}</span></span>
          <span class="v">⚡${cfg.note} · ${price} ${extra}</span>
        </div>`;
    });
    div.innerHTML=`<h4>${p.icon} ${p.name}</h4>
      <div class="muted" style="font-size:12px">Escolha como obter esta peça</div>
      <div class="opts">${optsHtml}</div>`;
    grid.appendChild(div);
  });
  $$("#partsGrid .opt").forEach(o=> o.onclick=()=>{
    const team=state.teams.find(t=>t.id===activeTeamId);
    if(o.classList.contains("disabled")){
      const pn=partName(o.dataset.part);
      if(teamPremCount(team)>=PREM_CAP) toast(`Limite de ${PREM_CAP} peças Premium atingido. Troque outra peça Premium antes de escolher ${pn}.`);
      else toast(`${pn} Premium esgotado no mercado. Sobra o econômico ou a oficina.`);
      return;
    }
    if(team.locked){ toast("Carro já fechado. Clique em “Reabrir carro” para editar."); return; }
    const part=o.dataset.part, choice=o.dataset.opt;
    if(choice==="P" && team.choices[part]!=="P"){
      if(premiumBought(part,team.id)>=premiumStockValue()) return; // estoque esgotado
      if(teamPremCount(team)>=PREM_CAP) return;                     // limite de 2 premium
    }
    team.choices[part]=choice;
    saveState(); renderActiveTeam(); renderTeamTabs();
  });

  $("#btnLockTeam").textContent=team.locked?"✏️ Reabrir carro":"✅ Fechar carro desta equipe";
  $("#btnLockTeam").className=team.locked?"btn ghost":"btn green";
}
$("#btnLockTeam").onclick=()=>{
  const team=state.teams.find(t=>t.id===activeTeamId);
  if(team.locked){ team.locked=false; saveState(); renderBuy(); return; }
  if(!teamComplete(team)){ toast("Defina as 5 peças antes de fechar o carro."); return; }
  if(teamSpent(team)>state.budget){ toast(`Orçamento estourado! Faltam ${teamSpent(team)-state.budget} moedas. Ajuste as escolhas.`, "error"); return; }
  if(teamPremCount(team)>PREM_CAP){ toast(`Cada equipe pode ter no máximo ${PREM_CAP} peças Premium.`, "error"); return; }
  team.locked=true;
  // avança para a próxima equipe do draft que ainda não fechou
  const order=teamsInDraftOrder();
  const next=order.find(t=>!t.locked);
  if(next) activeTeamId=next.id;
  saveState(); renderBuy();
};
$("#btnBackSetup").onclick=()=> setPhase("setup");
$("#btnToRace").onclick=async ()=>{
  const locked=state.teams.filter(t=>t.locked);
  if(locked.length<2){ toast("Pelo menos 2 equipes precisam fechar o carro."); return; }
  if(locked.length<state.teams.length){
    const missing=state.teams.length-locked.length;
    const ok=await askConfirm(`${missing} equipe(s) não fecharam o carro e ficarão de fora da corrida. Largar mesmo assim?`, "Largar", "🚦");
    if(!ok) return;
    const keep=new Set(state.teams.filter(t=>t.locked).map(t=>t.id));
    state.teams=state.teams.filter(t=>t.locked);
    state.draftOrder=state.draftOrder.filter(id=>keep.has(id));
  }
  initRace(); setPhase("race");
};
