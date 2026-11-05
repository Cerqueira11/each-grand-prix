// Dados do jogo: peças, preços, cartas, equipes e geometria da pista.

/* =====================================================================
   ECONOMIA v4s (validada por sim.py). Notas pequenas + dados de sorte.
   Opções por peça: P = Premium, E = Econômica, M = Oficina (fabricar).
   ===================================================================== */
const PARTS = [
  { id:"motor", name:"Motor",        icon:"🏎️" },
  { id:"pneus", name:"Pneus",        icon:"🛞" },
  { id:"aero",  name:"Aerodinâmica", icon:"💨" },
  { id:"freios",name:"Freios",       icon:"🛑" },
  { id:"susp",  name:"Suspensão",    icon:"🔩" },
];
// nota/preço por opção. M (oficina) é grátis.
const CFG = {
  motor: { P:{note:9, cost:28}, E:{note:7, cost:12}, M:{note:5} },
  pneus: { P:{note:8, cost:16}, E:{note:6, cost:7 }, M:{note:4} },
  aero:  { P:{note:8, cost:20}, E:{note:6, cost:9 }, M:{note:6} },
  freios:{ P:{note:8, cost:14}, E:{note:6, cost:6 }, M:{note:5} },
  susp:  { P:{note:8, cost:14}, E:{note:6, cost:6 }, M:{note:5} },
};
const MAKE_CAP = 2;          // oficina dá conta de 2 peças
const PREM_CAP = 2;          // cada equipe compra no máximo 2 peças premium
const DEFAULT_BUDGET = 55;   // orçamento calibrado para o limite de 2 premium (ver sim.py v8s)
const IMPROV_PENALTY = 2;    // da 3ª peça fabricada em diante: -2 na nota
const DICE = 2;              // nº de d6 de sorte por volta
const POINTS = [25,18,15,12,10,8,6,4,2];
const BONUS_DIV = 2;         // +1 ponto a cada 2 moedas de saldo (ver sim.py v9s)
const BONUS_CAP = 15;
const BONUS_TOPN = 5;        // só quem chega entre os 5 primeiros recebe o bônus (ver sim.py v10s)

// Baralho de 10 cartas; sai 1 por volta (5 voltas => 5 cartas).
// Cada carta tem title/desc (linguagem natural) e apply(car, ctx) que ajusta a nota da volta,
// o dinheiro (money) ou penalidades permanentes (perm). ctx tem o sorteio compartilhado da volta.
const DECK = [
  { key:"chuva", icon:"🌧️", title:"Chuva forte",
    desc:"Pista encharcada. Pneus bons seguram; pneus fracos ou de oficina escorregam." },
  { key:"atraso", icon:"🚚", title:"Entrega atrasada",
    desc:"Uma peça não chegou a tempo. Quem a comprou no fornecedor econômico fica sem ela nesta volta." },
  { key:"quebra", icon:"💥", title:"Peça quebrou",
    desc:"Uma peça falha. Premium tem garantia (troca grátis). Econômica perde rendimento e paga conserto. Oficina perde ainda mais." },
  { key:"reajuste", icon:"📈", title:"Fornecedor aumentou o preço",
    desc:"Reajuste surpresa. Cada peça econômica custa +2 moedas. Peça premium tem preço travado." },
  { key:"regra", icon:"📜", title:"Mudou o regulamento",
    desc:"Aero comprada precisa de adaptação: paga 5 moedas (ou perde rendimento até o fim). Aero de oficina adapta de graça." },
  { key:"engenheiros", icon:"🧠", title:"Engenheiros inspirados",
    desc:"A garagem brilha: todas as peças fabricadas pela equipe rendem +1 nesta volta." },
  { key:"reta", icon:"🏁", title:"Reta longa",
    desc:"Pé no fundo! O motor vale em dobro nesta volta." },
  { key:"curvas", icon:"🌀", title:"Curvas fechadas",
    desc:"Trecho técnico: freios e suspensão valem 1,5x nesta volta." },
  { key:"faliu", icon:"🏚️", title:"Um fornecedor faliu",
    desc:"Um fornecedor específico sai do mercado. Quem dependia dele perde rendimento até o fim da corrida." },
  { key:"revisao", icon:"🔩", title:"Revisão obrigatória",
    desc:"Manutenção cara: cada peça premium custa +2 moedas de revisão." },
];

const TEAM_PRESETS = [
  // color2 = segunda cor (equipes bicolores, metade/metade)
  { name:"Scuderia Ferrariable", emoji:"🔴", color:"#e10600", car:"🏎️" },
  { name:"Red Bug Racing",       emoji:"🔵", color:"#1b2a6b", color2:"#e10600", color3:"#ffcc00", car:"🏎️" },
  { name:"McDeploy",             emoji:"🟠", color:"#ff8000", car:"🏎️" },
  { name:"Merce-Devs",           emoji:"⚪", color:"#c4cad0", color2:"#00d2be", car:"🏎️" },
  { name:"Aston Lag",            emoji:"🟢", color:"#00594f", car:"🏎️" },
  { name:"Alpane",               emoji:"🔵", color:"#2563eb", color2:"#ff5fa2", car:"🏎️" },
  { name:"Haashcode",            emoji:"⚪", color:"#e10600", color2:"#ffffff", car:"🏎️" },
  { name:"Slowlliams",           emoji:"🔵", color:"#2f6bff", color2:"#000000", car:"🏎️" },
  { name:"Sauber-Security GP",   emoji:"🟢", color:"#52e000", car:"🏎️" },
];
// preenchimento CSS da equipe (bicolor = metade/metade)
function teamColors(t){ return [t.color, t.color2, t.color3].filter(Boolean); }
// preenchimento CSS: faixas iguais e duras (2 cores = metade/metade, 3 = terços)
function teamFill(t){
  const c=teamColors(t);
  if(c.length===1) return c[0];
  const step=100/c.length;
  return `linear-gradient(90deg, ${c.map((col,i)=>`${col} ${i*step}% ${(i+1)*step}%`).join(", ")})`;
}

/* =====================================================================
   CIRCUITO EACH — pista estilizada sobre planta simplificada do campus.
   viewBox 1000x820. TRACK_PATH é o traçado fechado; os carros andam sobre ele.
   BUILDINGS são os blocos dos prédios (com os apelidos da turma).
   ===================================================================== */
// Formato "pipa" que lembra o terreno da EACH: ponta em cima (rodovia/Titanic),
// base larga embaixo (Ginásio/CPTM). Largada no meio da base. Sentido horário.
// Traçado copiado do mapa de referência (viewBox 940x1000). Começa na largada (base),
// segue para a esquerda, sobe o lado esquerdo, faz a ponta de cima, desce pela direita
// com o "S" para dentro e volta pela base. Sentido horário.
const TRACK_PATH =
  "M 418 938 L 230 938 "+
  "C 185 938 160 915 140 880 "+
  "C 115 830 110 770 95 720 "+
  "C 85 690 60 660 48 625 "+
  "C 38 595 50 565 80 545 "+
  "C 105 528 120 515 140 490 "+
  "L 270 300 "+
  "C 330 215 370 160 400 95 "+
  "C 420 55 440 45 462 45 "+
  "C 490 45 505 65 515 95 "+
  "C 560 200 640 330 695 440 "+
  "C 712 475 705 495 680 500 "+
  "C 640 510 600 530 560 565 "+
  "C 525 600 520 650 545 700 "+
  "C 580 760 630 830 655 880 "+
  "C 670 915 665 938 620 938 "+
  "L 418 938 Z";
// prédios como polígonos, posições do mapa de referência
const BUILDINGS = [
  { label:"Elefante Branco", num:1, type:"poly", pts:"390,415 442,330 495,317 552,377 525,405 475,417 440,398" },
  { label:"CB",              num:2, type:"poly", pts:"417,483 528,434 585,500 525,547 460,540 423,520" },
  { label:"Titanic",         num:3, type:"poly", pts:"325,385 365,408 247,580 205,553" },
  { label:"Auditórios",      num:4, type:"poly", pts:"92,580 165,537 197,580 123,630" },
  { label:"Queijo",          num:5, type:"circle", cx:165, cy:662, r:42 },
  { label:"Biblioteca",      num:6, type:"poly", pts:"170,728 240,690 317,800 237,847" },
  { label:"Ginásio",         num:7, type:"poly", pts:"471,815 566,815 566,880 471,880" },
];
const BUILDING_FILL="#f6c56f", BUILDING_STROKE="#8a5a12";
const LAP_MS=7000;         // duração da animação de cada volta (ms)
const PAUSE_MS=5000;       // pausa mostrando a classificação antes da próxima volta (ms)
const LANES=[-18,0,18];    // 3 faixas na pista (deslocamento lateral)
const CAR_GAP=34;          // distância mínima entre carros na mesma faixa
