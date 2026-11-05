// Etapa 4: pódio e classificação final.

// ===================== RESULTS =====================
function computeResults(){
  const run=state.race.run;
  const ranked=[...state.teams].sort((a,b)=> run[b.id].total-run[a.id].total);
  const rows=ranked.map((t,i)=>{
    const posPts=POINTS[i]||1;
    const money=Math.max(0, run[t.id].money);
    const inTop = i < BONUS_TOPN;
    const budgetBonus = inTop ? Math.max(0, Math.min(BONUS_CAP, Math.floor(money/BONUS_DIV))) : 0;
    return { team:t, finish:i+1, dist:Math.round(run[t.id].total), posPts, budgetBonus, inTop, money, total:posPts+budgetBonus };
  });
  // reordena pelo total final (posição domina; bônus de orçamento desempata)
  rows.sort((a,b)=> b.total-a.total || a.finish-b.finish);
  return rows;
}
function renderResults(){
  const res=computeResults();
  const podium=$("#podium"); podium.innerHTML="";
  const medals=["🥇","🥈","🥉"], order=[1,0,2];
  order.forEach(idx=>{
    const r=res[idx]; if(!r) return;
    const div=document.createElement("div");
    div.className="pod p"+(idx+1);
    div.innerHTML=`<div class="medal">${medals[idx]}</div>
      <div class="pname">${r.team.emoji} ${r.team.name}</div>
      <div class="pill">${r.total} pts</div>`;
    div.style.borderTopColor=r.team.color;
    podium.appendChild(div);
  });
  const tb=$("#resultsTable tbody"); tb.innerHTML="";
  res.forEach((r,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><strong>${i+1}</strong></td>
      <td><span class="swatch" style="display:inline-block;background:${teamFill(r.team)};width:12px;height:12px;vertical-align:middle;margin-right:6px"></span>${r.team.emoji} ${r.team.name}</td>
      <td>${r.finish}º <span class="note">(${r.dist} m)</span></td>
      <td>${r.posPts}</td>
      <td>${r.budgetBonus?('+'+r.budgetBonus+' 💰'):(!r.inTop && r.money>=BONUS_DIV?'<span class="note">fora do top 5</span>':'—')}</td>
      <td>💰${r.money}</td>
      <td><strong>${r.total}</strong></td>`;
    tb.appendChild(tr);
  });
}
$("#btnBackRace").onclick=()=> setPhase("race");
$("#btnNewGame").onclick=()=> doReset();
