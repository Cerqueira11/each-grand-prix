// Modo online, lado do telão. Carregado só com "?online" na URL.
// O telão continua rodando a corrida e o pódio com o mesmo código do modo offline.
// Este arquivo cria a sala no Firebase, recebe as equipes e os carros dos celulares,
// faz o leilão das peças Premium e publica cada volta para os celulares.
import { FIREBASE_CONFIG, SDK } from "./firebase-config.js";

const { initializeApp } = await import(SDK.app);
const { getAuth, signInAnonymously, onAuthStateChanged } = await import(SDK.auth);
const { getDatabase, ref, set, update, get, remove, onValue, serverTimestamp } = await import(SDK.db);

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

let uid = null;
let teamsSnap = {}, carsSnap = {};
// hora do servidor, igual para telão e celulares (o relógio de cada aparelho pode estar adiantado)
let serverOffset = 0;
onValue(ref(db, ".info/serverTimeOffset"), (s) => { serverOffset = s.val() || 0; });
const now = () => Date.now() + serverOffset;
const AUTO_GRACE_MS = 4000; // espera os celulares enviarem sozinhos antes de o telão fechar o resto
let sweptFor = null;
let unsub = [];
const roomRef = (path) => ref(db, `rooms/${state.room}${path ? "/" + path : ""}`);
const presetId = (i) => `t${i}`;
const presetIndex = (id) => +id.slice(1);
const joinUrl = () => new URL(`jogador.html?sala=${state.room}`, location.href).href;
const status = (txt) => { const el = $("#roomStatus"); if (el) el.textContent = txt; };

// ---------- sala ----------
function newCode() {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I/L para ninguém digitar errado
  return Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join("");
}
async function createRoom() {
  for (let i = 0; i < 10; i++) {
    const code = window.__TEST_ROOM || newCode();
    try {
      await set(ref(db, `rooms/${code}`), { host: uid, phase: "setup", createdAt: serverTimestamp() });
      return code;
    } catch (e) { if (window.__TEST_ROOM) throw e; } // código já usado por outra sala: tenta outro
  }
  throw new Error("não foi possível criar a sala");
}
async function openRoom() {
  if (state.room) {
    try {
      const host = (await get(roomRef("host"))).val();
      if (host === uid) return; // mesma sala, mesmo telão: continua de onde parou
    } catch (e) { /* sala apagada ou de outro telão */ }
  }
  state = freshState();
  state.room = await createRoom();
  saveState();
}
function listen() {
  unsub.forEach((u) => u()); unsub = [];
  unsub.push(onValue(roomRef("teams"), (s) => { teamsSnap = s.val() || {}; syncTeams(); }));
  unsub.push(onValue(roomRef("cars"), (s) => { carsSnap = s.val() || {}; syncTeams(); }));
}

// equipes e carros do banco -> state.teams (só antes da largada; depois o grid fica fixo)
function syncTeams() {
  if (state.phase === "race" || state.phase === "results") return;
  const ids = Object.keys(teamsSnap).filter((id) => teamsSnap[id] && teamsSnap[id].claimedBy).sort();
  state.teams = ids.map((id) => {
    const p = TEAM_PRESETS[presetIndex(id)];
    const car = carsSnap[id] || {};
    return { id, name: p.name, emoji: p.emoji, color: p.color, color2: p.color2 || null, color3: p.color3 || null,
             car: p.car, choices: car.choices || {}, bids: car.bids || {}, locked: !!car.locked, auto: !!car.auto };
  });
  state.draftOrder = state.teams.map((t) => t.id);
  saveState();
  if (state.phase === "setup") renderRoom();
  if (state.phase === "buy") renderBuyStatus();
}

// ---------- telas ----------
function renderRoom() {
  $("#roomCode").textContent = state.room || "····";
  const url = joinUrl();
  $("#roomUrl").innerHTML = `<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</a>`;
  const qr = qrcode(0, "M"); qr.addData(url); qr.make();
  $("#roomQr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  $("#roomSlots").innerHTML = TEAM_PRESETS.map((p, i) => {
    const id = presetId(i), taken = teamsSnap[id] && teamsSnap[id].claimedBy;
    return `<div class="slot${taken ? " taken" : ""}">
      <span class="swatch" style="background:${teamFill(p)}"></span>
      <span class="sname">${p.name}</span>
      ${taken ? `<span class="sstate">entrou ✅</span><button class="btn sm ghost" data-free="${id}">Liberar</button>`
              : `<span class="sstate muted">livre</span>`}
    </div>`;
  }).join("");
  $$("[data-free]").forEach((b) => (b.onclick = () => freeTeam(b.dataset.free)));
}
function renderBuyStatus() {
  const done = state.teams.filter((t) => t.locked).length;
  $("#buyStatus").innerHTML = state.teams.map((t) => `
    <div class="bstat${t.locked ? " done" : ""}">
      <span class="swatch" style="background:${teamFill(t)}"></span>
      <span class="sname">${t.name}</span>
      <span class="sstate">${t.locked ? (t.auto ? "enviado no fim do tempo ⏱" : "carro enviado ✅")
                                      : `montando (${Object.keys(t.choices).length}/5)`}</span>
      ${t.locked ? `<button class="btn sm ghost" data-reopen="${t.id}">Reabrir</button>` : ""}
      <button class="btn sm ghost" data-free="${t.id}">Liberar</button>
    </div>`).join("") || `<div class="muted">Nenhuma equipe entrou ainda.</div>`;
  $("#buyCount").textContent = `${done} de ${state.teams.length} equipes enviaram o carro. Estoque de cada peça Premium: ${state.stock}.`;
  $$("[data-reopen]").forEach((b) => (b.onclick = () => update(roomRef(`cars/${b.dataset.reopen}`), { locked: false })));
  $$("[data-free]").forEach((b) => (b.onclick = () => freeTeam(b.dataset.free)));
}
async function freeTeam(id) {
  const name = TEAM_PRESETS[presetIndex(id)].name;
  const ok = await askConfirm(`Liberar a ${name}? O celular dela sai da equipe e o carro enviado é apagado. Outro celular pode entrar no lugar.`, "Liberar", "🔓", true);
  if (!ok) return;
  await update(roomRef(), { [`teams/${id}`]: null, [`cars/${id}`]: null });
}
window.onlinePhase = (ph) => {
  if (ph === "setup") renderRoom();
  if (ph === "buy") renderBuyStatus();
};

// ---------- etapas ----------
$("#btnToBuy").onclick = async () => {
  if (state.teams.length < 2) { toast("Pelo menos 2 equipes precisam entrar pelo celular."); return; }
  state.budget = +$("#budgetInput").value || DEFAULT_BUDGET;
  state.laps = +$("#lapsInput").value || 5;
  state.premiumStock = +$("#stockInput").value || 0;
  state.stock = premiumStockValue();
  const mins = Math.min(15, Math.max(0.5, +$("#buyMinutesInput").value || 3));
  state.buyEndsAt = Math.round(now() + mins * 60000);
  sweptFor = null;
  saveState();
  await update(roomRef(), { phase: "buy", settings: { budget: state.budget, laps: state.laps, stock: state.stock,
    premCap: PREM_CAP, buyEndsAt: state.buyEndsAt } });
  setPhase("buy");
};

// ---------- cronômetro da montagem ----------
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
setInterval(() => {
  if (state.phase !== "buy" || !state.buyEndsAt) return;
  const left = state.buyEndsAt - now();
  const el = $("#buyTimer");
  el.textContent = left > 0 ? fmt(left) : "Tempo!";
  el.classList.toggle("warn", left <= 30000);
  if (left <= -AUTO_GRACE_MS && sweptFor !== state.buyEndsAt) { sweptFor = state.buyEndsAt; closeLateCars(); }
}, 500);

// fecha os carros de quem não enviou (celular fechado ou sem internet) com o rascunho que estava no banco
async function closeLateCars() {
  const late = state.teams.filter((t) => !t.locked);
  for (const t of late) {
    const car = carsSnap[t.id] || {};
    const f = autoCompleteCar(car.choices, car.bids, state.budget);
    try { await set(roomRef(`cars/${t.id}`), { choices: f.choices, bids: f.bids, locked: true, auto: true }); }
    catch (e) { toast(`Não consegui fechar o carro da ${t.name}: ${e.message}`, "error"); }
  }
  if (late.length) toast(`Tempo esgotado. ${late.length} carro(s) foram fechados do jeito que estavam.`, "warn", 6000);
}

$("#btnAddMinute").onclick = async () => {
  if (state.phase !== "buy") return;
  state.buyEndsAt = Math.round(Math.max(now(), state.buyEndsAt || 0) + 60000);
  sweptFor = null; saveState();
  await update(roomRef("settings"), { buyEndsAt: state.buyEndsAt });
  toast("Mais 1 minuto para a montagem.", "ok");
};

$("#btnToRace").onclick = async () => {
  const locked = state.teams.filter((t) => t.locked);
  if (locked.length < 2) { toast("Pelo menos 2 equipes precisam enviar o carro."); return; }
  for (const t of locked) {
    const prob = carProblem(t.choices, t.bids, state.budget);
    if (prob) {
      toast(`O carro da ${t.name} foi recusado (${prob}). Ele foi reaberto no celular.`, "error", 6000);
      await update(roomRef(`cars/${t.id}`), { locked: false });
      return;
    }
  }
  if (locked.length < state.teams.length) {
    const missing = state.teams.length - locked.length;
    const ok = await askConfirm(`${missing} equipe(s) não enviaram o carro e ficarão de fora da corrida. Largar mesmo assim?`, "Largar", "🚦");
    if (!ok) return;
  }
  const res = resolveAuction(locked.map((t) => ({ id: t.id, choices: t.choices, bids: t.bids || {} })), state.stock);
  state.teams = locked.map((t) => ({ ...t, choices: res.final[t.id], bidPaid: res.paid[t.id], auction: res.perTeam[t.id] }));
  state.draftOrder = state.teams.map((t) => t.id);
  initRace();
  // a fase muda para "race" primeiro: a partir daí as regras do banco travam os carros
  await update(roomRef(), {
    phase: "race",
    auction: { report: res.report, perTeam: res.perTeam, paid: res.paid, inRace: state.draftOrder },
    live: { lap: 0, laps: state.laps, finished: false, standings: standings() },
  });
  setPhase("race");
  showAuctionPopup(res);
};

function standings() {
  const run = state.race.run;
  return [...state.teams].sort((a, b) => run[b.id].total - run[a.id].total)
    .map((t, i) => ({ id: t.id, pos: i + 1, dist: Math.round(run[t.id].total) }));
}

// resultado do leilão no telão, antes da largada
function showAuctionPopup(res) {
  const name = (id) => state.teams.find((t) => t.id === id)?.name || id;
  const coins = (n) => `${n} ${n === 1 ? "moeda" : "moedas"}`;
  const body = res.report.length
    ? res.report.map((r) => `
        <div class="auc">
          <div class="auctitle">${PARTS.find((p) => p.id === r.part).icon} ${partName(r.part)} Premium: ${r.requests} pedidos, ${r.stock} no estoque</div>
          <div class="eff good"><span class="who">Levaram:</span><span>${r.winners.map((w) => `${name(w.id)} (${coins(w.bid)}${w.draw ? ", no sorteio" : ""})`).join(", ")}</span></div>
          <div class="eff bad"><span class="who">Ficaram com o econômico:</span><span>${r.losers.map((w) => `${name(w.id)} (lance de ${coins(w.bid)}${w.draw ? ", perdeu no sorteio" : ""})`).join(", ")}</span></div>
          ${r.draw ? `<div class="eff neutral"><span class="who">🎲 Empate:</span><span>${r.draw.ids.map(name).join(", ")} deram ${coins(r.draw.bid)} cada e disputaram ${r.draw.seats} ${r.draw.seats === 1 ? "unidade" : "unidades"}. O sorteio decidiu.</span></div>` : ""}
        </div>`).join("")
    : `<div class="eff neutral">Nenhuma peça Premium foi disputada. Todo mundo levou o que pediu, sem pagar lance.</div>`;
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.id = "cardOverlay";
  ov.innerHTML = `<div class="cardpop">
      <div class="lap">Antes da largada</div>
      <div class="cicon">🔨</div>
      <h3>Resultado do leilão</h3>
      <div class="cdesc">Quando mais equipes pediram uma peça Premium do que o estoque, levaram os maiores lances. Quem levou pagou o lance.</div>
      <div class="effbox">${body}</div>
      <button class="btn green" id="btnAuctionOk">Ver a pista 🏁</button>
    </div>`;
  document.body.appendChild(ov);
  $("#btnAuctionOk").onclick = () => ov.remove();
}

// ---------- corrida e pódio para os celulares ----------
window.onlineLapDone = ({ lap, card, draw, effects }) => {
  const byTeam = {};
  effects.forEach((e) => { (byTeam[e.teamId] = byTeam[e.teamId] || []).push({ txt: e.txt, kind: e.kind }); });
  set(roomRef("live"), {
    lap, laps: state.laps, finished: !!state.race.finished,
    card: { icon: card.icon, title: card.title, desc: card.desc }, draw: draw || "",
    effects: byTeam, standings: standings(),
  }).catch((e) => toast("Não consegui avisar os celulares desta volta: " + e.message, "error"));
};
window.onlineResults = (rows) => {
  if (!state.race || !state.race.finished) return;
  update(roomRef(), {
    phase: "results",
    results: rows.map((r, i) => ({ id: r.team.id, place: i + 1, finish: r.finish, dist: r.dist,
      posPts: r.posPts, budgetBonus: r.budgetBonus, inTop: r.inTop, money: r.money, total: r.total })),
  }).catch((e) => toast("Não consegui enviar o pódio aos celulares: " + e.message, "error"));
};

// ---------- reinício ----------
async function resetOnline() {
  if (!(await askConfirm("Reiniciar o jogo? A sala atual é apagada e uma sala nova é criada. Os celulares vão precisar entrar de novo.", "Reiniciar", "↺", true))) return;
  const ov = $("#cardOverlay"); if (ov) ov.remove();
  animating = false;
  try { await remove(roomRef()); } catch (e) { /* sala já não existia */ }
  state.room = null;
  await openRoom(); listen(); setPhase("setup");
}
$("#btnReset").onclick = resetOnline;
$("#btnNewGame").onclick = resetOnline;

// ---------- início ----------
onValue(ref(db, ".info/connected"), (s) => status(s.val() ? "Conectado ao servidor." : "Sem conexão. Tentando de novo..."));
onAuthStateChanged(auth, async (user) => {
  if (!user || uid) return;
  uid = user.uid;
  try {
    await openRoom();
    listen();
    setPhase(state.phase || "setup");
  } catch (e) {
    status("Erro ao criar a sala: " + e.message);
    toast("Não consegui criar a sala online. Confira a internet ou use o modo offline.", "error", 8000);
  }
});
signInAnonymously(auth).catch((e) => {
  status("Sem conexão com o servidor.");
  toast("Não consegui conectar ao servidor. Confira a internet ou use o modo offline.", "error", 8000);
});
