// Tela do celular do líder. Entra na sala, escolhe a equipe, monta o carro com os lances
// e acompanha a corrida. Quem calcula a corrida é o telão; o celular só mostra.
import { FIREBASE_CONFIG, SDK } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const SECTIONS = ["pJoin", "pTeams", "pWait", "pBuild", "pRace", "pResult"];
const show = (id) => SECTIONS.forEach((s) => $("#" + s).classList.toggle("hide", s !== id));
const presetOf = (id) => TEAM_PRESETS[+id.slice(1)];
const coins = (n) => `${n} ${n === 1 ? "moeda" : "moedas"}`;

function toast(msg, kind = "warn", ms = 3500) {
  let host = $("#toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; host.className = "toasts"; document.body.appendChild(host); }
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="ticon">${{ warn: "⚠️", error: "⛔", ok: "✅" }[kind] || "ℹ️"}</span><span>${msg}</span>`;
  host.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); };
  el.onclick = close; setTimeout(close, ms);
}
function askConfirm(msg, okLabel) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<div class="askpop"><div class="aicon">🏁</div><p>${msg}</p>
      <div class="row"><button class="btn ghost" data-a="no">Voltar</button><button class="btn green" data-a="yes">${okLabel}</button></div></div>`;
    document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector('[data-a="yes"]').onclick = () => done(true);
    ov.querySelector('[data-a="no"]').onclick = () => done(false);
  });
}
function wait(icon, title, text, extraHtml = "") {
  $("#waitIcon").textContent = icon; $("#waitTitle").textContent = title;
  $("#waitText").textContent = text; $("#waitExtra").innerHTML = extraHtml;
  show("pWait");
}

// ---------- sala pela URL ----------
const params = new URLSearchParams(location.search);
const room = (params.get("sala") || "").trim().toUpperCase();
$("#joinForm").onsubmit = (e) => {
  e.preventDefault();
  const c = $("#joinCode").value.trim().toUpperCase();
  if (!/^[A-Z2-9]{4}$/.test(c)) { toast("O código tem 4 letras ou números. Confira no telão."); return; }
  location.search = "?sala=" + c;
};
const hasRoom = /^[A-Z2-9]{4}$/.test(room);

// ---------- Firebase (só carrega quando há código de sala) ----------
let ref, set, remove, onValue, db;
let serverOffset = 0; // hora do servidor, para o cronômetro bater com o telão
const R = (p) => ref(db, `rooms/${room}/${p}`);

let uid = null, myId = null;
const S = { phase: undefined, settings: {}, teams: {}, car: null, live: null, auction: null, results: null };
let carUnsub = null;

// rascunho do carro, salvo no aparelho até ser enviado
let draft = { choices: {}, bids: {} };
const draftKey = () => `egp_draft_${room}_${myId}`;
function loadDraft() { try { draft = JSON.parse(localStorage.getItem(draftKey())) || { choices: {}, bids: {} }; } catch (e) { draft = { choices: {}, bids: {} }; } }
function saveDraft() { try { localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch (e) {} }

function watch(path, key) {
  onValue(R(path), (s) => { S[key] = s.val(); if (key === "teams") findMe(); render(); },
    (err) => { wait("⛔", "Sem acesso à sala", "Recarregue a página. Se continuar, avise o organizador."); });
}
function findMe() {
  const teams = S.teams || {};
  const mine = Object.keys(teams).find((id) => teams[id] && teams[id].claimedBy === uid) || null;
  if (mine === myId) return;
  myId = mine;
  if (carUnsub) { carUnsub(); carUnsub = null; }
  S.car = null;
  if (myId) {
    loadDraft();
    // o rascunho também fica no banco; só redesenha quando o carro trava ou destrava
    carUnsub = onValue(R(`cars/${myId}`), (s) => {
      const was = !!(S.car && S.car.locked);
      S.car = s.val();
      if (!!(S.car && S.car.locked) !== was || S.phase !== "buy") render();
    }, () => {});
  }
}

// ---------- telas ----------
function render() {
  const badge = $("#pTeamBadge");
  if (myId) { const p = presetOf(myId); badge.innerHTML = `<span class="swatch" style="background:${teamFill(p)}"></span>${p.name}`; }
  else badge.textContent = "";

  if (S.phase === undefined) return;               // ainda carregando
  if (S.phase === null) { wait("❓", "Sala não encontrada", `Não existe sala com o código ${room}. Confira o código no telão.`, `<a class="btn" href="jogador.html">Digitar outro código</a>`); return; }

  if (S.phase === "results") return renderResults();
  if (S.phase === "race") return renderRace();

  if (!myId) return renderTeamPicker();
  if (S.phase === "setup") {
    wait("✅", `Você é a ${presetOf(myId).name}`, "Espere o organizador abrir a montagem dos carros. A tela muda sozinha.",
      `<button class="btn ghost" id="btnLeave">Trocar de equipe</button>`);
    bindLeave();
    return;
  }
  if (S.phase === "buy") {
    if (S.car && S.car.locked) return renderSent();
    return renderBuild();
  }
}
function bindLeave() {
  const b = $("#btnLeave"); if (!b) return;
  b.onclick = async () => { try { await remove(R(`teams/${myId}/claimedBy`)); } catch (e) { toast("Não consegui sair da equipe.", "error"); } };
}

function renderTeamPicker() {
  if (S.phase !== "setup" && S.phase !== "buy") return;
  const teams = S.teams || {};
  $("#teamGrid").innerHTML = TEAM_PRESETS.map((p, i) => {
    const id = "t" + i, taken = teams[id] && teams[id].claimedBy;
    return `<button class="pteam" data-team="${id}" ${taken ? "disabled" : ""}>
      <span class="swatch" style="background:${teamFill(p)}"></span>${p.name}<span class="st">${taken ? "ocupada" : "livre"}</span></button>`;
  }).join("");
  $$("[data-team]").forEach((b) => (b.onclick = async () => {
    try { await set(R(`teams/${b.dataset.team}/claimedBy`), uid); }
    catch (e) { toast("Outro celular pegou essa equipe antes. Escolha outra."); }
  }));
  show("pTeams");
}

// ---- montagem ----
const OPT = { P: { label: "🏆 Premium", name: "Premium", tip: "garantia · preço travado" },
              E: { label: "💰 Econômico", name: "Econômico", tip: "sem garantia" },
              M: { label: "🔧 Oficina", name: "Oficina", tip: "grátis" } };
function budget() { return (S.settings && S.settings.budget) || DEFAULT_BUDGET; }
function stock() { return (S.settings && S.settings.stock) || 1; }
function premCount() { return PARTS.filter((p) => draft.choices[p.id] === "P").length; }
function makeCount() { return PARTS.filter((p) => draft.choices[p.id] === "M").length; }

function renderBuild() {
  $("#buildRules").textContent = `Você tem ${budget()} moedas. No máximo ${PREM_CAP} peças Premium, cada uma com ${stock()} unidades no mercado. A oficina dá conta de ${MAKE_CAP} peças sem perder nota. Quando o tempo acabar, o carro vai do jeito que estiver, e peça sem escolha vai para a oficina.`;
  $("#auctionHelp").innerHTML = `Para cada peça Premium você dá um lance secreto em moedas, que pode ser 0. Cada peça tem ${stock()} unidades.
    <br>1. Se até ${stock()} equipes pedirem a peça, todas levam e ninguém paga o lance. As moedas ficam no seu saldo.
    <br>2. Se mais equipes pedirem, levam os ${stock()} maiores lances, e cada uma paga o próprio lance.
    <br>3. Empate no limite do estoque vai para sorteio.
    <br>4. Quem não leva fica com a peça econômica e não paga o lance.`;
  if (!S.car) pushDraft(); // rascunho salvo só no aparelho (ex.: página recarregada) sobe para o banco
  const made = makeCount();
  $("#partList").innerHTML = PARTS.map((p) => {
    const sel = draft.choices[p.id];
    const opts = ["P", "E", "M"].map((o) => {
      const c = CFG[p.id][o];
      const price = o === "M" ? "grátis" : coins(c.cost);
      const off = (o === "P" && sel !== "P" && premCount() >= PREM_CAP);
      const improv = (o === "M" && sel !== "M" && made >= MAKE_CAP) ? " · −2 (improviso)" : "";
      const stockTxt = o === "P" ? `<br><span class="pstock">${stock()} no estoque</span>` : "";
      return `<button class="popt${sel === o ? " sel" : ""}${off ? " off" : ""}" data-part="${p.id}" data-opt="${o}">
        <span><span class="pl">${OPT[o].label}</span><br><span class="pv">${OPT[o].tip}</span></span>
        <span class="pv">nota ${c.note}<br>${price}${improv}${stockTxt}</span></button>`;
    }).join("");
    const bid = draft.bids[p.id] || 0;
    const bidRow = sel === "P" ? `<div class="pbid">
        <span class="bl">Lance pelo Premium<br><span class="pv">só paga se houver disputa e você levar</span></span>
        <span class="bc"><button data-bid="${p.id}" data-d="-1">−</button><strong>${bid}</strong><button data-bid="${p.id}" data-d="1">+</button></span>
      </div>` : "";
    return `<div class="ppart"><h4>${p.icon} ${p.name}</h4><div class="popts">${opts}</div>${bidRow}</div>`;
  }).join("");

  $$("[data-opt]").forEach((b) => (b.onclick = () => {
    const part = b.dataset.part, o = b.dataset.opt;
    if (o === "P" && draft.choices[part] !== "P" && premCount() >= PREM_CAP) {
      toast(`Você já tem ${PREM_CAP} peças Premium. Troque uma delas antes.`); return;
    }
    draft.choices[part] = o;
    if (o !== "P") delete draft.bids[part];
    saveDraft(); pushDraft(); renderBuild();
  }));
  $$("[data-bid]").forEach((b) => (b.onclick = () => {
    const part = b.dataset.bid, d = +b.dataset.d;
    const next = Math.max(0, (draft.bids[part] || 0) + d);
    if (d > 0 && carCost(draft.choices, { ...draft.bids, [part]: next }) > budget()) { toast("Não sobra moeda para aumentar o lance."); return; }
    draft.bids[part] = next;
    saveDraft(); pushDraft(); renderBuild();
  }));

  const left = budget() - carCost(draft.choices, draft.bids);
  $("#sumBudget").textContent = budget();
  $("#sumLeft").textContent = left;
  $("#sumLeft").style.color = left < 0 ? "var(--red)" : "var(--green)";
  $("#sumPrem").innerHTML = `<span class="tag">🏆 Premium ${premCount()}/${PREM_CAP}</span>`;
  $("#sumMake").innerHTML = made > MAKE_CAP ? `<span class="tag" style="color:var(--red)">🔧 Oficina ${made} (${made - MAKE_CAP} improvisada)</span>`
                                            : `<span class="tag">🔧 Oficina ${made}/${MAKE_CAP}</span>`;
  const bar = $("#pBudgetBar"); bar.classList.toggle("over", left < 0);
  bar.firstElementChild.style.width = Math.min(100, (1 - left / budget()) * 100) + "%";
  $("#btnSend").onclick = sendCar;
  show("pBuild");
}
async function sendCar() {
  const bids = {};
  PARTS.forEach((p) => { if (draft.choices[p.id] === "P") bids[p.id] = draft.bids[p.id] || 0; });
  const prob = carProblem(draft.choices, bids, budget());
  if (prob === "carro incompleto") { toast("Escolha as 5 peças antes de enviar."); return; }
  if (prob) { toast(`Não dá para enviar: ${prob}.`, "error"); return; }
  const left = budget() - carCost(draft.choices, bids);
  const ok = await askConfirm(`Enviar o carro? Sobram ${coins(left)} se você levar todos os Premium pedidos. Depois de enviado, só o organizador consegue reabrir.`, "Enviar");
  if (!ok) return;
  try {
    await set(R(`cars/${myId}`), { choices: { ...draft.choices }, bids, locked: true });
    toast("Carro enviado!", "ok");
  } catch (e) { toast("Não consegui enviar. A montagem pode ter sido encerrada.", "error"); }
}
function carSummary(choices, bids) {
  return PARTS.map((p) => {
    const c = choices[p.id];
    const b = c === "P" && bids && bids[p.id] ? ` · lance ${coins(bids[p.id])}` : "";
    return `<div class="pline neutral"><span>${p.icon} ${p.name}: <strong>${OPT[c] ? OPT[c].name : "?"}</strong>${b}</span></div>`;
  }).join("");
}
// rascunho no banco: se o celular fechar, o telão ainda fecha o carro com o que estava escolhido
let pushTimer = null;
function draftPayload() {
  const bids = {};
  PARTS.forEach((p) => { if (draft.choices[p.id] === "P") bids[p.id] = draft.bids[p.id] || 0; });
  return { choices: { ...draft.choices }, bids, locked: false };
}
function pushDraft() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (S.phase !== "buy" || !myId || (S.car && S.car.locked) || !Object.keys(draft.choices).length) return;
    set(R(`cars/${myId}`), draftPayload()).catch(() => {}); // recusado se o carro já travou
  }, 400);
}

// cronômetro e envio automático quando o tempo acaba
const autoKey = () => `egp_auto_${room}_${myId}`;
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
setInterval(() => {
  const ends = S.settings && S.settings.buyEndsAt;
  const el = $("#pTimer");
  if (S.phase !== "buy" || !ends) { if (el) el.textContent = ""; return; }
  const left = ends - (Date.now() + serverOffset);
  el.textContent = left > 0 ? `⏱ ${fmt(left)}` : "⏱ Tempo!";
  el.classList.toggle("warn", left <= 30000);
  if (left > 0 || !myId || (S.car && S.car.locked)) return;
  if (localStorage.getItem(autoKey()) === String(ends)) return; // já enviou sozinho neste prazo
  try { localStorage.setItem(autoKey(), String(ends)); } catch (e) {}
  autoSend();
}, 500);
async function autoSend() {
  const f = autoCompleteCar(draft.choices, draft.bids, budget());
  try {
    await set(R(`cars/${myId}`), { choices: f.choices, bids: f.bids, locked: true, auto: true });
    toast("O tempo acabou. Seu carro foi enviado do jeito que estava.", "warn", 6000);
  } catch (e) { /* o telão já fechou o carro */ }
}

function renderSent() {
  if (S.car.auto) {
    return wait("⏱", "Tempo esgotado", "O carro foi enviado do jeito que estava. Peça sem escolha foi para a oficina. Espere o leilão no telão.",
      `<div style="text-align:left;margin-top:12px">${carSummary(S.car.choices || {}, S.car.bids || {})}</div>`);
  }
  wait("📨", "Carro enviado", "Espere o organizador fazer o leilão e largar a corrida. Fique de olho no telão.",
    `<div style="text-align:left;margin-top:12px">${carSummary(S.car.choices || {}, S.car.bids || {})}</div>`);
}

// ---- corrida ----
function auctionLines() {
  const a = S.auction || {};
  const mine = (a.perTeam && a.perTeam[myId]) || [];
  const paid = (a.paid && a.paid[myId]) || 0;
  if (!mine.length) return `<h3>Leilão</h3><div class="pline neutral">Você não pediu peças Premium.</div>`;
  return `<h3>Leilão</h3>` + mine.map((r) => {
    const n = partName(r.part);
    if (!r.disputed) return `<div class="pline good">${n} Premium: sem disputa, levou sem pagar lance.</div>`;
    if (r.won && r.draw) return `<div class="pline good">${n} Premium: empatou com outras equipes em ${coins(r.bid)}, ganhou no sorteio e pagou ${coins(r.bid)}.</div>`;
    if (r.won) return `<div class="pline good">${n} Premium: ganhou a disputa e pagou ${coins(r.bid)}.</div>`;
    if (r.draw) return `<div class="pline bad">${n} Premium: empatou com outras equipes em ${coins(r.bid)}, perdeu no sorteio e ficou com o econômico. O lance não foi cobrado.</div>`;
    return `<div class="pline bad">${n} Premium: perdeu a disputa e ficou com o econômico. O lance não foi cobrado.</div>`;
  }).join("") + (paid ? `<div class="pline neutral">Total pago em lances: ${coins(paid)}.</div>` : "");
}
function inRace() {
  const list = (S.auction && S.auction.inRace) || [];
  return myId && (Array.isArray(list) ? list : Object.values(list)).includes(myId);
}
function standingsHtml(list) {
  return list.map((r) => {
    const p = presetOf(r.id);
    return `<div class="prow${r.id === myId ? " me" : ""}"><span class="p">${r.pos}º</span>
      <span class="swatch" style="width:14px;height:14px;background:${teamFill(p)}"></span>${p.name}<span class="v">${r.dist} m</span></div>`;
  }).join("");
}
function renderRace() {
  if (!inRace()) {
    return wait("📺", "Acompanhe pelo telão", myId ? "Sua equipe não enviou o carro a tempo e ficou fora desta corrida." : "A corrida já começou. Não dá mais para entrar.");
  }
  const live = S.live || {};
  const list = live.standings || [];
  const me = list.find((r) => r.id === myId);
  $("#aucBox").innerHTML = auctionLines();
  $("#raceLap").textContent = live.lap ? `Volta ${live.lap} de ${live.laps}` : "A corrida vai começar";
  $("#racePos").textContent = me && live.lap ? `${me.pos}º` : "🚦";
  $("#raceDist").textContent = me && live.lap ? `${me.dist} m percorridos` : "Olhe o telão.";
  if (live.card) {
    const eff = (live.effects && live.effects[myId]) || [];
    $("#raceCard").innerHTML = `<div class="cardhead"><span class="ci">${live.card.icon}</span><h3>${live.card.title}</h3></div>
      ${live.draw ? `<div class="pline neutral"><span>🎯 ${live.draw}</span></div>` : ""}
      ${eff.length ? eff.map((e) => `<div class="pline ${e.kind}"><span>${e.txt}</span></div>`).join("") : `<div class="pline neutral"><span>Essa carta não afetou o seu carro.</span></div>`}`;
    $("#raceCard").classList.remove("hide");
  } else $("#raceCard").classList.add("hide");
  $("#raceTable").innerHTML = standingsHtml(list);
  show("pRace");
}

// ---- pódio ----
function renderResults() {
  const rows = S.results || [];
  const mine = rows.find((r) => r.id === myId);
  if (!mine) { wait("🏆", "Corrida encerrada", "Veja o pódio no telão."); return; }
  const medal = ["🥇", "🥈", "🥉"][mine.place - 1] || "🏁";
  $("#resIcon").textContent = medal;
  $("#resTitle").textContent = `${presetOf(myId).name} terminou em ${mine.place}º`;
  const bonus = mine.budgetBonus ? `+${mine.budgetBonus}` : (mine.inTop ? "0" : "fora do top 5");
  $("#resBreak").innerHTML = `
    <div class="breakline"><span>Chegada na corrida</span><span>${mine.finish}º (${mine.dist} m)</span></div>
    <div class="breakline"><span>Pontos da posição</span><span>${mine.posPts}</span></div>
    <div class="breakline"><span>Saldo no fim</span><span>${coins(mine.money)}</span></div>
    <div class="breakline"><span>Bônus de orçamento</span><span>${bonus}</span></div>
    <div class="breakline"><span>Total</span><span>${mine.total} pts</span></div>`;
  $("#resTable").innerHTML = rows.map((r) => {
    const p = presetOf(r.id);
    return `<div class="prow${r.id === myId ? " me" : ""}"><span class="p">${r.place}º</span>
      <span class="swatch" style="width:14px;height:14px;background:${teamFill(p)}"></span>${p.name}<span class="v">${r.total} pts</span></div>`;
  }).join("");
  show("pResult");
}
function partName(id) { return PARTS.find((p) => p.id === id)?.name || id; }

// ---------- início ----------
async function start() {
  $("#pRoom").textContent = "Sala " + room;
  wait("📡", "Conectando...", "Entrando na sala " + room + ".");
  try {
    const { initializeApp } = await import(SDK.app);
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import(SDK.auth);
    const dbm = await import(SDK.db);
    ({ ref, set, remove, onValue } = dbm);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    db = dbm.getDatabase(app);
    onValue(ref(db, ".info/serverTimeOffset"), (s) => { serverOffset = s.val() || 0; });
    onAuthStateChanged(auth, (user) => {
      if (!user || uid) return;
      uid = user.uid;
      watch("phase", "phase"); watch("settings", "settings"); watch("teams", "teams");
      watch("live", "live"); watch("auction", "auction"); watch("results", "results");
    });
    await signInAnonymously(auth);
  } catch (e) {
    wait("📡", "Sem conexão", "Não consegui conectar ao servidor. Confira a internet e recarregue a página.");
  }
}
if (hasRoom) start(); else show("pJoin");
