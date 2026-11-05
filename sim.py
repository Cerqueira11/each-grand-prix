"""Simulação de balanceamento do EACH Grand Prix."""
import itertools, random, statistics, sys

PARTS = ["motor", "pneus", "aero", "freios", "susp"]
# (nota, preço) por peça; Make = nota sem custo
CFG = {
    "motor":  {"P": (10, 30), "E": (6, 12), "M": (5, 0)},
    "pneus":  {"P": (9, 18),  "E": (6, 7),  "M": (4, 0)},
    "aero":   {"P": (9, 22),  "E": (6, 9),  "M": (7, 0)},
    "freios": {"P": (9, 16),  "E": (6, 6),  "M": (6, 0)},
    "susp":   {"P": (9, 16),  "E": (6, 6),  "M": (6, 0)},
}
BUDGET = 70
MAKE_CAP = 2          # peças fabricadas acima disso são "improvisadas"
IMPROV_PENALTY = 2
LAPS = 5
DICE = 2              # nº de d6 por volta (sorte)
POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2]
BONUS_DIV = 5         # +1 ponto a cada N moedas de saldo
BONUS_CAP = 8
BONUS_TOPN = 9        # só quem chega entre os N primeiros recebe o bônus de orçamento

DECK = ["chuva", "atraso", "quebra", "reajuste", "regra",
        "engenheiros", "reta", "curvas", "faliu", "chuva2"]


def cost(s):
    return sum(CFG[p][o][1] for p, o in zip(PARTS, s))


def base_notes(s):
    notes = {p: CFG[p][o][0] for p, o in zip(PARTS, s)}
    made = [p for p, o in zip(PARTS, s) if o == "M"]
    # improvisadas: as piores (ordem da lista) além da capacidade
    for p in made[MAKE_CAP:]:
        notes[p] -= IMPROV_PENALTY
    return notes


def race(strats, rng):
    n = len(strats)
    if SCARCITY:
        stock = {p: -(-n // 2) for p in PARTS}
        order0 = list(range(n)); rng.shuffle(order0)
        strats = list(strats)
        for i in order0:
            s = list(strats[i])
            for k, p in enumerate(PARTS):
                if s[k] == "P":
                    if stock[p] > 0:
                        stock[p] -= 1
                    else:
                        s[k] = "E"
            strats[i] = tuple(s)
    cars = []
    for s in strats:
        cars.append({"s": dict(zip(PARTS, s)), "notes": base_notes(s),
                     "money": BUDGET - cost(s), "total": 0, "perm": {p: 0 for p in PARTS}})
    deck = DECK[:] * DECK_MULT
    rng.shuffle(deck)
    if CARDS_ON_HALF:
        laps_with = set(rng.sample(range(LAPS), LAPS // 2))
        it = iter(deck)
        deck = [next(it) if l in laps_with else "amarela" for l in range(LAPS)]
    for lap in range(LAPS):
        card = deck[lap]
        X = rng.choice(PARTS)
        Y = rng.choice(["P", "E"])
        for c in cars:
            s, nt = c["s"], dict(c["notes"])
            for p in PARTS:
                nt[p] += c["perm"][p]
            if card in ("chuva", "chuva2"):
                nt["pneus"] += {"P": 1, "E": -2, "M": -3}[s["pneus"]]
            elif card == "atraso":
                if s[X] == "E":
                    nt[X] = 0
            elif card == "quebra":
                q = rng.choice(PARTS + [None])
                if q:
                    if s[q] == "E":
                        nt[q] -= 3; c["money"] -= 4
                    elif s[q] == "M":
                        nt[q] -= 4
            elif card == "reajuste":
                c["money"] -= 2 * sum(1 for p in PARTS if s[p] == "E")
            elif card == "regra":
                if s["aero"] != "M":
                    if c["money"] >= 5:
                        c["money"] -= 5
                    else:
                        c["perm"]["aero"] -= 2; nt["aero"] -= 2
            elif card == "engenheiros":
                for p in PARTS:
                    if s[p] == "M":
                        nt[p] += 1
            elif card == "reta":
                nt["motor"] *= 2
            elif card == "curvas":
                nt["freios"] += nt["freios"] // 2
                nt["susp"] += nt["susp"] // 2
            elif card == "revisao":
                c["money"] -= 2 * sum(1 for p in PARTS if s[p] == "P")
            elif card == "amarela":
                pass
            elif card == "faliu":
                if s[X] == Y:
                    c["perm"][X] -= 2; nt[X] -= 2
            luck = sum(rng.randint(1, 6) for _ in range(DICE))
            c["total"] += sum(nt.values()) + luck
    order = sorted(range(n), key=lambda i: -cars[i]["total"] + rng.random() * 1e-6)
    res = [0] * n
    for pos, i in enumerate(order):
        bonus = max(0, min(BONUS_CAP, cars[i]["money"] // BONUS_DIV)) if pos < BONUS_TOPN else 0
        res[i] = (POINTS[pos] + bonus, pos == 0, POINTS[pos], bonus)
    return res


def evaluate(valid, field, n_teams=9, runs=150, rng=None):
    stats = {}
    for s in valid:
        tot, wins = 0, 0
        for _ in range(runs):
            opp = [rng.choice(field) for _ in range(n_teams - 1)]
            r = race([s] + opp, rng)[0]
            tot += r[0]; wins += r[1]
        stats[s] = (tot / runs, wins / runs)
    return stats


def label(s):
    return " ".join(f"{p[:3]}:{o}" for p, o in zip(PARTS, s))


def main():
    rng = random.Random(42)
    allc = list(itertools.product("PEM", repeat=5))
    valid = [s for s in allc if cost(s) <= BUDGET and s.count("P") <= PREM_CAP]
    print(f"Combinacoes validas: {len(valid)} de {len(allc)}  | orcamento {BUDGET}")
    st = evaluate(valid, valid, rng=rng)
    # 2a geracao: adversarios = top 30
    top = sorted(st, key=lambda s: -st[s][0])[:30]
    st2 = evaluate(valid, top, rng=rng)
    ranked = sorted(st2, key=lambda s: -st2[s][0])
    print("\nTOP 12 (contra campo de estrategias fortes):")
    for s in ranked[:12]:
        print(f"  {label(s)}  custo {cost(s):3d}  pts {st2[s][0]:5.1f}  vitorias {st2[s][1]*100:4.1f}%")
    print("\nEstrategias extremas:")
    for name, s in [("Tudo Make", ("M",)*5), ("Tudo economica", ("E",)*5)]:
        print(f"  {name:22s} pts {st2[s][0]:5.1f}  vit {st2[s][1]*100:4.1f}%  pos #{ranked.index(s)+1}")
    prem = [s for s in valid if s.count("P") == max(v.count("P") for v in valid)]
    for s in prem:
        print(f"  Max premium {label(s)} pts {st2[s][0]:5.1f} vit {st2[s][1]*100:4.1f}% pos #{ranked.index(s)+1}")
    vals = [st2[s][0] for s in valid]
    print(f"\nMedia {statistics.mean(vals):.1f} | melhor {max(vals):.1f} | mediana {statistics.median(vals):.1f}")


VARIANTS = {
    "v2": dict(
        CFG={
            "motor":  {"P": (10, 28), "E": (7, 12), "M": (4, 0)},
            "pneus":  {"P": (9, 16),  "E": (7, 7),  "M": (4, 0)},
            "aero":   {"P": (9, 20),  "E": (7, 9),  "M": (6, 0)},
            "freios": {"P": (9, 14),  "E": (7, 6),  "M": (5, 0)},
            "susp":   {"P": (9, 14),  "E": (7, 6),  "M": (5, 0)},
        }, DICE=3, BONUS_DIV=4, BONUS_CAP=8),
    "v3": dict(
        CFG={
            "motor":  {"P": (9, 28), "E": (7, 12), "M": (5, 0)},
            "pneus":  {"P": (8, 16), "E": (6, 7),  "M": (4, 0)},
            "aero":   {"P": (8, 20), "E": (6, 9),  "M": (6, 0)},
            "freios": {"P": (8, 14), "E": (6, 6),  "M": (5, 0)},
            "susp":   {"P": (8, 14), "E": (6, 6),  "M": (5, 0)},
        }, DICE=4, BONUS_DIV=4, BONUS_CAP=8),
}
_v3cfg = VARIANTS["v3"]["CFG"]
VARIANTS["v4"] = dict(VARIANTS["v3"], DECK=["chuva", "atraso", "quebra", "reajuste", "regra",
                       "engenheiros", "reta", "curvas", "faliu", "revisao"])
VARIANTS["v4s"] = dict(VARIANTS["v4"], SCARCITY=True)
VARIANTS["v5s"] = dict(VARIANTS["v4s"], CFG={
    "motor":  {"P": (9, 26), "E": (7, 12), "M": (5, 0)},
    "pneus":  {"P": (8, 14), "E": (7, 7),  "M": (4, 0)},
    "aero":   {"P": (8, 18), "E": (6, 8),  "M": (6, 0)},
    "freios": {"P": (8, 12), "E": (7, 6),  "M": (5, 0)},
    "susp":   {"P": (8, 12), "E": (7, 6),  "M": (5, 0)},
}, BUDGET=60, BONUS_DIV=3, BONUS_CAP=8)
SCARCITY = False
DECK_MULT = 1
CARDS_ON_HALF = False
VARIANTS["v7_all"] = dict(VARIANTS["v4s"], LAPS=10)                       # 10 voltas, todas as 10 cartas saem
VARIANTS["v7_dup"] = dict(VARIANTS["v4s"], LAPS=10, DECK_MULT=2)          # baralho duplicado, saem 10 de 20
VARIANTS["v7_half"] = dict(VARIANTS["v4s"], LAPS=10, CARDS_ON_HALF=True)  # carta em so 5 das 10 voltas
VARIANTS["v7_dup6"] = dict(VARIANTS["v4s"], LAPS=10, DECK_MULT=2, DICE=6) # + mais sorte
VARIANTS["v6s"] = dict(VARIANTS["v4s"], CFG={
    "motor":  {"P": (9, 26), "E": (7, 12), "M": (5, 0)},
    "pneus":  {"P": (8, 16), "E": (6, 6),  "M": (4, 0)},
    "aero":   {"P": (8, 16), "E": (6, 7),  "M": (6, 0)},
    "freios": {"P": (8, 14), "E": (6, 5),  "M": (5, 0)},
    "susp":   {"P": (8, 14), "E": (6, 5),  "M": (5, 0)},
})

# v8s: v4s + no máximo 2 peças premium por equipe + orçamento 55
VARIANTS["v8s"] = dict(VARIANTS["v4s"], BUDGET=55, PREM_CAP=2)
# v9s: v8s + bônus de orçamento mais forte (+1 a cada 2 moedas, máx +15)
VARIANTS["v9s"] = dict(VARIANTS["v8s"], BONUS_DIV=2, BONUS_CAP=15)
# v10s (vigente): v9s + bônus de orçamento só para quem chega no top 5
VARIANTS["v10s"] = dict(VARIANTS["v9s"], BONUS_TOPN=5)
PREM_CAP = 5

if __name__ == "__main__":
    if len(sys.argv) > 1:
        globals().update(VARIANTS[sys.argv[1]])
    main()
