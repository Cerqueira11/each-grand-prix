// Leilão de lance fechado das peças Premium (modo online). Mesmas regras de sim_leilao.py.

// custo total que a equipe compromete: preço das peças + lances das peças Premium
function carCost(choices, bids){
  let s=0;
  for(const p of PARTS){
    const c=choices[p.id];
    if(c==="P") s+=CFG[p.id].P.cost + (bids && bids[p.id] || 0);
    else if(c==="E") s+=CFG[p.id].E.cost;
  }
  return s;
}

// confere se um carro enviado pelo celular respeita as regras. Devolve "" se estiver ok.
function carProblem(choices, bids, budget){
  if(!PARTS.every(p=>["P","E","M"].includes(choices[p.id]))) return "carro incompleto";
  if(PARTS.filter(p=>choices[p.id]==="P").length>PREM_CAP) return `mais de ${PREM_CAP} peças Premium`;
  for(const p of PARTS){
    const b=bids && bids[p.id] || 0;
    if(!Number.isInteger(b) || b<0) return "lance inválido";
  }
  if(carCost(choices, bids)>budget) return "passou do orçamento";
  return "";
}

// entries: [{id, choices, bids}]. Para cada peça:
// - se os pedidos de Premium cabem no estoque, todos levam e ninguém paga lance;
// - se não cabem, os maiores lances levam e pagam o lance; empate é sorteado;
//   quem perde fica com o econômico e não paga o lance.
function resolveAuction(entries, stock, rand=Math.random){
  const final={}, paid={}, perTeam={}, report=[];
  entries.forEach(e=>{ final[e.id]={...e.choices}; paid[e.id]=0; perTeam[e.id]=[]; });
  for(const p of PARTS){
    const req=entries.filter(e=>e.choices[p.id]==="P")
      .map(e=>({id:e.id, bid:(e.bids && e.bids[p.id]) || 0, tie:rand()}));
    if(!req.length) continue;
    if(req.length<=stock){
      req.forEach(r=> perTeam[r.id].push({part:p.id, won:true, bid:0, disputed:false}));
      continue;
    }
    req.sort((a,b)=> b.bid-a.bid || a.tie-b.tie);
    const winners=req.slice(0,stock), losers=req.slice(stock);
    winners.forEach(r=>{ paid[r.id]+=r.bid; perTeam[r.id].push({part:p.id, won:true, bid:r.bid, disputed:true}); });
    losers.forEach(r=>{ final[r.id][p.id]="E"; perTeam[r.id].push({part:p.id, won:false, bid:r.bid, disputed:true}); });
    report.push({part:p.id, requests:req.length, stock,
      winners:winners.map(r=>({id:r.id, bid:r.bid})), losers:losers.map(r=>({id:r.id, bid:r.bid}))});
  }
  return {final, paid, perTeam, report};
}
