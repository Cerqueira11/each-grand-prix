// Reinício do jogo e inicialização (carregado por último).

// ===================== RESET =====================
async function doReset(){
  if(!(await askConfirm("Reiniciar o jogo e apagar tudo (equipes, carros e corrida)?", "Reiniciar", "↺", true))) return;
  state=freshState(); activeTeamId=null; animating=false;
  const ov=$("#cardOverlay"); if(ov) ov.remove();
  saveState(); setPhase("setup");
}
$("#btnReset").onclick=doReset;

// ===================== BOOT =====================
// estado salvo de versão anterior (sem draftOrder) é incompatível: recomeça limpo
if(!Array.isArray(state.draftOrder)) state=freshState();
// 70 era o orçamento padrão antigo; jogos salvos com ele passam para o novo padrão
if(state.budget===70 && state.phase==="setup") state.budget=DEFAULT_BUDGET;
// equipes salvas antes da troca de cores pegam as cores atuais do preset
state.teams.forEach(t=>{
  const p=TEAM_PRESETS.find(x=>x.name===t.name);
  if(p){ t.color=p.color; t.color2=p.color2||null; t.color3=p.color3||null; }
});
if(state.phase==="race" && !state.race) state.phase="buy";
setPhase(state.phase||"setup");
