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

// carro de quem não enviou a tempo: peça sem escolha vai para a oficina; se preço + lances passar
// do orçamento, os lances são zerados; se só o preço já passar, Premium vira econômico, da mais cara para a mais barata.
function autoCompleteCar(choices, bids, budget){
  const c={}, b={};
  PARTS.forEach(p=>{ const v=choices && choices[p.id]; c[p.id]=["P","E","M"].includes(v)?v:"M"; });
  PARTS.filter(p=>c[p.id]==="P").slice(PREM_CAP).forEach(p=>{ c[p.id]="E"; });
  PARTS.forEach(p=>{ if(c[p.id]==="P"){ const v=bids && bids[p.id]; b[p.id]=Number.isInteger(v)&&v>0?v:0; } });
  if(carCost(c,b)>budget) Object.keys(b).forEach(k=>{ b[k]=0; });
  const byPrice=PARTS.filter(p=>c[p.id]==="P").sort((x,y)=>CFG[y.id].P.cost-CFG[x.id].P.cost);
  for(const p of byPrice){ if(carCost(c,b)<=budget) break; c[p.id]="E"; delete b[p.id]; }
  return {choices:c, bids:b};
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
    // houve sorteio quando o último lance que levou é igual ao primeiro que ficou de fora
    const cut=winners[winners.length-1].bid;
    const drew=losers[0].bid===cut;
    const inDraw=r=> drew && r.bid===cut;
    winners.forEach(r=>{ paid[r.id]+=r.bid; perTeam[r.id].push({part:p.id, won:true, bid:r.bid, disputed:true, draw:inDraw(r)}); });
    losers.forEach(r=>{ final[r.id][p.id]="E"; perTeam[r.id].push({part:p.id, won:false, bid:r.bid, disputed:true, draw:inDraw(r)}); });
    report.push({part:p.id, requests:req.length, stock,
      winners:winners.map(r=>({id:r.id, bid:r.bid, draw:inDraw(r)})), losers:losers.map(r=>({id:r.id, bid:r.bid, draw:inDraw(r)})),
      draw: drew ? {bid:cut, ids:req.filter(inDraw).map(r=>r.id), seats:winners.filter(inDraw).length} : null});
  }
  return {final, paid, perTeam, report};
}
