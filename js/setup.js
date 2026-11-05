// Etapa 1: cadastro de equipes e sorteio da ordem de escolha.

// ===================== SETUP =====================
function renderSetup(){
  $("#budgetInput").value=state.budget;
  $("#lapsInput").value=state.laps;
  $("#stockInput").value=state.premiumStock;
  const list=$("#teamList"); list.innerHTML="";
  state.teams.forEach(t=>{
    const div=document.createElement("div");
    div.className="teamline";
    div.innerHTML=`
      <div class="swatch" style="background:${teamFill(t)}"></div>
      <div style="flex:1"><strong>${t.emoji} ${t.name}</strong></div>
      <button class="btn sm red" data-rm="${t.id}">Remover</button>`;
    list.appendChild(div);
  });
  $("#teamCount").textContent=`${state.teams.length}/9 equipes`;
  $("#btnAddTeam").disabled=state.teams.length>=9;
  $$("[data-rm]").forEach(b=> b.onclick=()=>{
    state.teams=state.teams.filter(t=>t.id!==b.dataset.rm);
    state.draftOrder=[]; // grid mudou: invalida sorteio
    saveState(); renderSetup();
  });
  renderDraftLine();
}
function renderDraftLine(){
  const el=$("#draftLine");
  $("#btnDraw").disabled = state.teams.length<2;
  if(!state.draftOrder.length){
    el.innerHTML="";
    $("#draftHint").textContent = state.teams.length<2
      ? "Adicione as equipes e sorteie quando o grid estiver fechado."
      : "Pronto para sortear a ordem de escolha.";
    return;
  }
  $("#draftHint").textContent="Ordem sorteada — a 1ª escolhe primeiro. Sorteie de novo se quiser.";
  el.innerHTML = state.draftOrder.map((id,i)=>{
    const t=state.teams.find(x=>x.id===id); if(!t) return "";
    return `<div class="draftpill"><span class="n">${i+1}º</span> ${t.emoji} ${t.name}</div>`;
  }).join("");
}
$("#btnDraw").onclick=()=>{
  if(state.teams.length<2) return;
  state.draftOrder = shuffle(state.teams.map(t=>t.id));
  saveState(); renderDraftLine();
};
$("#btnAddTeam").onclick=()=>{
  if(state.teams.length>=9) return;
  const preset=TEAM_PRESETS[state.teams.length];
  state.teams.push({
    id:"t"+Date.now()+Math.random().toString(36).slice(2,6),
    name:preset.name, emoji:preset.emoji, color:preset.color, color2:preset.color2||null, color3:preset.color3||null, car:preset.car,
    choices:{}, locked:false
  });
  state.draftOrder=[]; // grid mudou: invalida sorteio
  saveState(); renderSetup();
};
["budgetInput","lapsInput","stockInput"].forEach(id=>{
  $("#"+id).addEventListener("change",()=>{
    state.budget=+$("#budgetInput").value||DEFAULT_BUDGET;
    state.laps=+$("#lapsInput").value||5;
    state.premiumStock=+$("#stockInput").value||0;
    saveState();
  });
});
$("#btnToBuy").onclick=()=>{
  if(state.teams.length<2){ toast("Adicione pelo menos 2 equipes."); return; }
  if(state.draftOrder.length!==state.teams.length){
    toast("Sorteie a ordem de escolha antes de montar os carros (botão 🎲)."); return;
  }
  state.budget=+$("#budgetInput").value||DEFAULT_BUDGET;
  state.laps=+$("#lapsInput").value||5;
  state.premiumStock=+$("#stockInput").value||0;
  activeTeamId=state.draftOrder[0];
  saveState(); setPhase("buy");
};
