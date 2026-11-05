// Etapa 3: motor da corrida (cartas), pista SVG, animação e pop-ups.

// ===================== RACE =====================
// cada equipe tem um "runtime": money, perm (penalidade permanente por peça), total (soma dos pontos de volta)
function initRace(){
  const deck=shuffle(DECK.slice()).slice(0, state.laps); // sorteia quais cartas saem e em que ordem
  const run={};
  state.teams.forEach(t=>{
    run[t.id]={ money: state.budget-teamSpent(t), perm:Object.fromEntries(PARTS.map(p=>[p.id,0])), total:0, lastLap:0 };
  });
  state.race={ currentLap:0, deck, run, finished:false };
  saveState();
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// aplica a carta da volta a uma equipe; devolve as notas efetivas da volta.
// ctx = { X: peça sorteada, Y: fornecedor sorteado ('P'/'E'), Q: peça sorteada p/ quebra (ou null) }
function applyCard(team, card, ctx){
  const r=state.race.run[team.id];
  const ch=team.choices;
  const notes=baseNotes(team);
  // aplica penalidades permanentes acumuladas
  for(const p of PARTS) notes[p.id]+=r.perm[p.id];

  switch(card.key){
    case "chuva":
      notes.pneus += ({P:1, E:-2, M:-3})[ch.pneus]; break;
    case "atraso":
      if(ch[ctx.X]==="E") notes[ctx.X]=0; break;
    case "quebra":
      if(ctx.Q){
        if(ch[ctx.Q]==="E"){ notes[ctx.Q]-=3; r.money-=4; }
        else if(ch[ctx.Q]==="M"){ notes[ctx.Q]-=4; }
        // P: garantia, troca grátis (nada acontece)
      }
      break;
    case "reajuste":
      r.money -= 2*PARTS.filter(p=>ch[p.id]==="E").length; break;
    case "regra":
      if(ch.aero!=="M"){
        if(r.money>=5){ r.money-=5; }
        else { r.perm.aero-=2; notes.aero-=2; }
      }
      break;
    case "engenheiros":
      for(const p of PARTS) if(ch[p.id]==="M") notes[p.id]+=1; break;
    case "reta":
      notes.motor*=2; break;
    case "curvas":
      notes.freios += Math.floor(notes.freios/2);
      notes.susp   += Math.floor(notes.susp/2); break;
    case "faliu":
      if(ch[ctx.X]===ctx.Y){ r.perm[ctx.X]-=2; notes[ctx.X]-=2; } break;
    case "revisao":
      r.money -= 2*PARTS.filter(p=>ch[p.id]==="P").length; break;
  }
  return notes;
}

let pathEl=null;         // <path> da pista, p/ medir pontos (getPointAtLength)
let pathLen=0;
let animating=false;

function renderRace(){
  $("#lapNum").textContent=state.race? state.race.currentLap:0;
  $("#lapTotal").textContent=state.laps;
  buildCircuit();
  renderLeaderboard();
  const started = state.race && state.race.currentLap>0;
  const done = state.race && state.race.finished;
  // botão "Iniciar" só antes de começar; "Continuar" se a corrida foi reaberta no meio; "Ver pódio" no fim
  $("#btnToResults").classList.toggle("hide", !done);
  if(done){
    $("#btnStartRace").classList.add("hide");
  } else if(started){
    $("#btnStartRace").classList.remove("hide");
    $("#btnStartRace").textContent="▶ Continuar corrida";
  } else {
    $("#btnStartRace").classList.remove("hide");
    $("#btnStartRace").textContent="🚦 Iniciar corrida";
  }
  $("#raceHint").classList.toggle("hide", started);
}

// desenha o SVG do circuito (fundo escuro, pista larga, prédios como polígonos)
function buildCircuit(){
  const host=$("#circuitHost");
  const badge=(cx,cy,n,r=15)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3a2608"/>
      <text x="${cx}" y="${cy}" fill="#f6c56f" font-size="${r}" font-weight="800" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI">${n}</text>`;
  const buildings = BUILDINGS.map(b=>{
    if(b.type==="circle")
      return `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="${BUILDING_FILL}" stroke="${BUILDING_STROKE}" stroke-width="2"/>${badge(b.cx,b.cy,b.num)}`;
    const pts=b.pts.split(" ").map(p=>p.split(",").map(Number));
    const cx=pts.reduce((a,p)=>a+p[0],0)/pts.length, cy=pts.reduce((a,p)=>a+p[1],0)/pts.length;
    return `<polygon points="${b.pts}" fill="${BUILDING_FILL}" stroke="${BUILDING_STROKE}" stroke-width="2" stroke-linejoin="round"/>${badge(cx,cy,b.num)}`;
  }).join("");
  const legend = BUILDINGS.map((b,i)=>
    `<g transform="translate(755 ${120+i*40})">${badge(0,0,b.num,13)}
       <text x="24" y="0" fill="#cdd4e2" font-size="17" dominant-baseline="central" font-family="Segoe UI,sans-serif">${b.label}</text>
     </g>`).join("");
  // gradientes metade/metade das equipes bicolores
  const grads = state.teams.filter(t=>teamColors(t).length>1).map(t=>{
    const c=teamColors(t), step=100/c.length;
    const stops=c.map((col,i)=>`<stop offset="${i*step}%" stop-color="${col}"/><stop offset="${(i+1)*step}%" stop-color="${col}"/>`).join("");
    return `<linearGradient id="tg-${t.id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>`;
  }).join("");

  host.innerHTML=`
    <svg class="circuit" viewBox="0 0 940 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
        </filter>
        <pattern id="checker" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#fff"/>
          <rect width="5" height="5" fill="#111"/>
          <rect x="5" y="5" width="5" height="5" fill="#111"/>
        </pattern>
        ${grads}
      </defs>
      <rect x="0" y="0" width="940" height="1000" fill="#141414"/>
      <!-- pista larga: borda clara + asfalto + tracejado central -->
      <path d="${TRACK_PATH}" fill="none" stroke="#d6d2c4" stroke-width="76" stroke-linejoin="round"/>
      <path d="${TRACK_PATH}" fill="none" stroke="#4a4f5a" stroke-width="66" stroke-linejoin="round"/>
      <path id="trackPath" d="${TRACK_PATH}" fill="none" stroke="#f2f2f2" stroke-width="2.5" stroke-dasharray="14 16" opacity="0.55"/>
      ${buildings}
      <g id="startMark"></g>
      <text x="740" y="80" fill="#e8eaf0" font-size="20" font-weight="700" font-family="Segoe UI,sans-serif">Construções</text>
      ${legend}
      <g id="cars"></g>
    </svg>`;
  pathEl=host.querySelector("#trackPath");
  pathLen=pathEl.getTotalLength();
  const p0=pathEl.getPointAtLength(0);
  host.querySelector("#startMark").innerHTML=
    `<rect x="${p0.x-6}" y="${p0.y-33}" width="12" height="66" fill="url(#checker)"/>
     <text x="${p0.x}" y="${p0.y+58}" font-size="16" fill="#cdd4e2" text-anchor="middle" font-family="Segoe UI,sans-serif">Largada e chegada</text>`;
  renderCarsAt(carProgressFraction());
}

// fração do traçado (0..1) para cada equipe, proporcional à pontuação acumulada.
function carProgressFraction(){
  const run=state.race.run;
  const maxTotal=Math.max(1, ...state.teams.map(t=>run[t.id].total));
  const prog = state.laps ? state.race.currentLap/state.laps : 0;
  const f={};
  state.teams.forEach(t=>{
    const rel = maxTotal>0 ? run[t.id].total/maxTotal : 0;
    f[t.id] = Math.min(0.999, rel*prog);
  });
  return f;
}
// desenha os carros numa fração dada (usada tanto estática quanto a cada frame da animação)
function renderCarsAt(frac){
  if(!pathEl) return;
  const g=$("#circuitHost")?.querySelector("#cars");
  if(!g) return;
  // cada equipe tem uma faixa fixa (3 faixas). Dentro da faixa, um carro nunca encosta
  // no da frente: se estiver perto demais, fica CAR_GAP atrás (na largada vira um grid).
  const placed=[];
  LANES.forEach((laneOff,lane)=>{
    const inLane=state.teams.filter((t,idx)=>idx%LANES.length===lane)
      .map(t=>({t, len:frac[t.id]*pathLen}))
      .sort((a,b)=>b.len-a.len);
    let prev=null;
    inLane.forEach(c=>{
      if(prev!==null && prev-c.len<CAR_GAP) c.len=prev-CAR_GAP;
      prev=c.len;
      placed.push({t:c.t, len:((c.len%pathLen)+pathLen)%pathLen, off:laneOff});
    });
  });
  g.innerHTML = placed.map(({t,len,off})=>{
    const pt=pathEl.getPointAtLength(len);
    const ahead=pathEl.getPointAtLength((len+6)%pathLen);
    const ang=Math.atan2(ahead.y-pt.y, ahead.x-pt.x);
    const nx=pt.x - Math.sin(ang)*off, ny=pt.y + Math.cos(ang)*off;
    const fill = teamColors(t).length>1 ? `url(#tg-${t.id})` : t.color;
    return `<g transform="translate(${nx.toFixed(1)} ${ny.toFixed(1)}) rotate(${(ang*180/Math.PI).toFixed(1)})" filter="url(#sh)">
      <rect x="-15" y="-8" width="30" height="16" rx="6" fill="${fill}" stroke="#fff" stroke-width="2"/>
      <circle cx="3" cy="0" r="3.5" fill="#111" opacity="0.75"/>
    </g>`;
  }).join("");
}
function renderLeaderboard(){
  const run=state.race.run;
  const ranked=[...state.teams].sort((a,b)=>run[b.id].total-run[a.id].total);
  $("#leaderboard").innerHTML = ranked.map((t,i)=>
    `<div class="lbitem"><span class="pos">${i+1}º</span><span class="swatch" style="width:14px;height:14px;background:${teamFill(t)}"></span>${t.name} <span class="sc">${Math.round(run[t.id].total)} m</span></div>`
  ).join("");
}

// ---- rodar UMA volta: computa pontos, ANIMA os carros pela pista, abre pop-up ----
function runOneLap(){
  if(!state.race || state.race.finished || animating) return;
  animating=true;
  const lap=state.race.currentLap;             // índice 0-based
  const card=state.race.deck[lap];
  // sorteio de quebra: 6 opções (5 peças + "ninguém"), igual ao sim.py
  const qPool=[...PARTS.map(p=>p.id), null];
  const ctx={
    X: PARTS[Math.floor(Math.random()*PARTS.length)].id,
    Y: Math.random()<0.5?"P":"E",
    Q: qPool[Math.floor(Math.random()*qPool.length)],
  };
  // posição (fração na pista) ANTES de pontuar esta volta
  const fracBefore = carProgressFraction();
  // calcula efeitos e pontos da volta
  const effects=[];
  state.teams.forEach(t=>{
    const moneyBefore = state.race.run[t.id].money;
    const notes=applyCard(t, card, ctx);
    const sum=PARTS.reduce((a,p)=>a+notes[p.id],0);
    let luck=0; for(let i=0;i<DICE;i++) luck+=d6(); // dados nos bastidores (não exibidos)
    state.race.run[t.id].total += sum+luck;
    const moneyAfter = state.race.run[t.id].money;
    const impact = describeImpact(t, card, ctx, moneyAfter-moneyBefore);
    if(impact) effects.push(impact);
  });
  state.race.currentLap++;
  if(state.race.currentLap>=state.laps) state.race.finished=true;
  saveState();
  $("#lapNum").textContent=state.race.currentLap;
  // posição DEPOIS; cada carro anda +1 volta na pista + o ganho relativo de posição
  const fracAfter = carProgressFraction();
  animateLap(fracBefore, fracAfter, ()=>{
    if(!state.race) return; // jogo reiniciado durante a volta
    renderLeaderboard();
    showCardPopup(card, ctx, effects, lap+1);
  });
}

// anima os carros de fracBefore -> fracAfter dando "1 volta" visual na pista.
// cada carro percorre: (1 volta completa) + (variação da sua fração acumulada).
function animateLap(fracBefore, fracAfter, done){
  const DURATION=LAP_MS;            // ms por volta animada
  const t0=performance.now();
  const ease=x=> -(Math.cos(Math.PI*x)-1)/2; // easeInOutSine: arranca e freia suave
  function frame(now){
    const k=Math.min(1,(now-t0)/DURATION);
    const e=ease(k);
    const cur={};
    state.teams.forEach(t=>{
      // o carro gira 1 volta inteira (+1.0) interpolando da fração antiga à nova
      const from=fracBefore[t.id], to=fracAfter[t.id]+1; // +1 = uma volta completa
      const val=from + (to-from)*e;
      cur[t.id]= val % 1;           // posição visível na pista (0..1)
    });
    renderCarsAt(cur);
    if(k<1) requestAnimationFrame(frame);
    else { renderCarsAt(fracAfter); done&&done(); }
  }
  requestAnimationFrame(frame);
}

// descreve, em linguagem natural, o que a carta fez com cada equipe (p/ o pop-up)
function describeImpact(team, card, ctx, moneyDelta){
  const ch=team.choices, who=`${team.emoji} ${team.name}`;
  const g=(txt,kind)=>({who, txt, kind});
  // unidades explícitas: "m" = metros nesta volta (decide a posição), "moedas" = saldo (decide o bônus)
  const M=n=>`<strong>${n>0?"+":"−"}${Math.abs(n)} m</strong>`;
  const C=n=>`<strong>−${Math.abs(n)} moedas</strong>`;
  const perm=state.race.run[team.id].perm;
  const note=pid=>Math.max(0, baseNotes(team)[pid]+perm[pid]); // nota atual da peça
  switch(card.key){
    case "chuva":
      if(ch.pneus==="P") return g(`pneus premium seguram firme: ${M(1)} nesta volta`,"good");
      if(ch.pneus==="E") return g(`pneus econômicos escorregam: ${M(-2)} nesta volta`,"bad");
      return g(`pneus de oficina escorregam feio: ${M(-3)} nesta volta`,"bad");
    case "atraso":
      if(ch[ctx.X]==="E") return g(`${partName(ctx.X)} econômico não chegou: ${M(-note(ctx.X))} nesta volta`,"bad");
      return null;
    case "quebra":
      if(!ctx.Q) return null;
      if(ch[ctx.Q]==="P") return g(`${partName(ctx.Q)} premium quebrou, mas a garantia trocou de graça`,"good");
      if(ch[ctx.Q]==="E") return g(`${partName(ctx.Q)} econômico quebrou: ${M(-3)} nesta volta e ${C(4)} de conserto`,"bad");
      if(ch[ctx.Q]==="M") return g(`${partName(ctx.Q)} de oficina quebrou: ${M(-4)} nesta volta`,"bad");
      return null;
    case "reajuste":
      return moneyDelta<0 ? g(`reajuste nas peças econômicas: ${C(moneyDelta)}`,"bad") : null;
    case "regra":
      if(ch.aero==="M") return g("aero de oficina adapta de graça","good");
      return moneyDelta<0 ? g(`adaptou a aero: ${C(moneyDelta)}`,"bad")
                          : g(`sem dinheiro para adaptar a aero: <strong>−2 m por volta</strong> até o fim`,"bad");
    case "engenheiros": {
      const n=PARTS.filter(p=>ch[p.id]==="M").length;
      return n? g(`${n} peça(s) de oficina rendem mais: ${M(n)} nesta volta`,"good") : g("não tem peças de oficina","neutral");
    }
    case "reta":
      return g(`motor (${ch.motor==="P"?"premium":ch.motor==="E"?"econômico":"oficina"}) conta em dobro: ${M(note("motor"))} nesta volta`, ch.motor==="P"?"good":"neutral");
    case "curvas": {
      const extra=Math.floor(note("freios")/2)+Math.floor(note("susp")/2);
      return g(`freios e suspensão valem 1,5x: ${M(extra)} nesta volta`,"neutral");
    }
    case "faliu":
      if(ch[ctx.X]===ctx.Y) return g(`dependia do fornecedor que faliu (${partName(ctx.X)}): <strong>−2 m por volta</strong> até o fim`,"bad");
      return null;
    case "revisao":
      return moneyDelta<0 ? g(`revisão das peças premium: ${C(moneyDelta)}`,"bad") : null;
  }
  return null;
}

// ---- pop-up da carta ----
function showCardPopup(card, ctx, effects, lapNumber){
  let draw="";
  if(card.key==="atraso") draw=`Peça sorteada: <strong>${partName(ctx.X)}</strong>`;
  else if(card.key==="faliu") draw=`Fornecedor sorteado: <strong>${ctx.Y==="P"?"Premium":"Econômico"} de ${partName(ctx.X)}</strong>`;
  else if(card.key==="quebra") draw = ctx.Q ? `Peça sorteada: <strong>${partName(ctx.Q)}</strong>` : `<strong>Ninguém quebrou nesta volta!</strong>`;

  const effRows = effects.length
    ? effects.map(e=>`<div class="eff ${e.kind}"><span class="who">${e.who}:</span><span>${e.txt}</span></div>`).join("")
    : `<div class="eff neutral">Nenhuma equipe foi afetada nesta volta.</div>`;

  const ov=document.createElement("div");
  ov.className="overlay"; ov.id="cardOverlay";
  const last = state.race.finished;
  ov.innerHTML=`
    <div class="cardpop">
      <div class="lap">Volta ${lapNumber} de ${state.laps}</div>
      <div class="cicon">${card.icon}</div>
      <h3>${card.title}</h3>
      <div class="cdesc">${card.desc}</div>
      ${draw?`<div class="note" style="margin-bottom:12px">🎯 ${draw}</div>`:""}
      <div class="effbox">
        <div class="efftitle">O que aconteceu nesta volta</div>
        ${effRows}
      </div>
      <button class="btn ${last?'green':''}" id="btnContinue">${last?'🏆 Ver pódio':'Continuar ▶'}</button>
    </div>`;
  document.body.appendChild(ov);
  $("#btnContinue").onclick=()=>{
    ov.remove();
    if(state.race.finished){ animating=false; renderRace(); setPhase("results"); return; }
    // pausa: mostra a classificação por alguns segundos e depois a corrida segue sozinha
    showStandingsPause(lapNumber, ()=>{ animating=false; renderRace(); runOneLap(); });
  };
}

// ---- pausa entre voltas: classificação parcial + contagem regressiva ----
function showStandingsPause(lapNumber, then){
  const run=state.race.run;
  const ranked=[...state.teams].sort((a,b)=>run[b.id].total-run[a.id].total);
  const medal=["🥇","🥈","🥉"];
  const rows=ranked.map((t,i)=>`
    <div class="standrow${i===0?' top1':''}">
      <span class="p">${medal[i]||(i+1)+"º"}</span>
      <span class="swatch" style="width:16px;height:16px;background:${teamFill(t)}"></span>
      <span>${t.name}</span>
      <span class="pts">${Math.round(run[t.id].total)} m</span>
    </div>`).join("");
  const secs=Math.round(PAUSE_MS/1000);
  const ov=document.createElement("div");
  ov.className="overlay"; ov.id="cardOverlay";
  ov.innerHTML=`
    <div class="standpop">
      <h3>🏁 Classificação após a volta ${lapNumber}</h3>
      <div class="sub2">Faltam ${state.laps-lapNumber} volta(s)</div>
      ${rows}
      <div class="countbar"><div style="animation-duration:${PAUSE_MS}ms"></div></div>
      <div class="foot">
        <span>A corrida volta em <strong id="pauseSecs">${secs}</strong>s</span>
        <button class="btn sm green" id="btnSkipPause">Seguir agora ▶</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  let left=secs, finished=false;
  const tick=setInterval(()=>{ left--; const el=$("#pauseSecs"); if(el) el.textContent=Math.max(0,left); },1000);
  const go=()=>{ if(finished) return; finished=true; clearInterval(tick); clearTimeout(timer); ov.remove(); then(); };
  const timer=setTimeout(go, PAUSE_MS);
  $("#btnSkipPause").onclick=go;
}

function partName(id){ return PARTS.find(p=>p.id===id)?.name||id; }

$("#btnStartRace").onclick=()=>{
  if(!state.race || state.race.finished) return;
  $("#btnStartRace").classList.add("hide");
  runOneLap();
};
$("#btnBackBuy").onclick=()=>{ if(animating) return; setPhase("buy"); };
$("#btnToResults").onclick=()=> setPhase("results");
