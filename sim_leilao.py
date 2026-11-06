"""Testa o leilão de lance fechado pelas peças Premium escassas (modo online).

Regras testadas:
- Cada equipe monta o carro e dá um lance secreto (moedas) para cada peça Premium pedida.
- Se os pedidos de uma peça cabem no estoque, todos levam e ninguém paga lance.
- Se não cabem, os maiores lances levam e pagam o que ofereceram. Empate é sorteado.
  Quem perde fica com a peça econômica e não paga o lance.
- Preço das peças + lances não pode passar do orçamento.

Compara com a fila sorteada (regras v10s) usando a mesma medida: % de títulos
(quem vence o pódio, já com o bônus de orçamento só para o top 5).

Rodar: python sim_leilao.py
"""
import itertools, random, statistics
import sim

sim.__dict__.update(sim.VARIANTS["v11s"])
N_TEAMS = 9
STOCK = -(-N_TEAMS // 2)          # 5 unidades por peça premium com 9 equipes
BIDS = (0, 2, 4, 6, 8, 10)

cars = [s for s in itertools.product("PEM", repeat=5)
        if sim.cost(s) <= sim.BUDGET and s.count("P") <= sim.PREM_CAP]
auction_strats = [(s, b) for s in cars for b in BIDS
                  if (b == 0 or "P" in s) and sim.cost(s) + b * s.count("P") <= sim.BUDGET]


def title_winner(res):
    return max(range(len(res)), key=lambda i: (res[i][0], res[i][2]))


def auction_alloc(entries, rng, stats=None):
    """entries = [(carro, lance)]. Devolve carros finais e moedas pagas em lances."""
    final = [list(s) for s, _ in entries]
    paid = [0] * len(entries)
    for k, p in enumerate(sim.PARTS):
        req = [i for i, (s, _) in enumerate(entries) if s[k] == "P"]
        if len(req) <= STOCK:
            continue
        tie = {i: rng.random() for i in req}
        req.sort(key=lambda i: (-entries[i][1], tie[i]))
        for i in req[:STOCK]:
            paid[i] += entries[i][1]
        for i in req[STOCK:]:
            final[i][k] = "E"
        if stats is not None:
            stats["disputas"] += 1
            stats["lance_vencedor"].append(entries[req[STOCK - 1]][1])
    return [tuple(s) for s in final], paid


def race_auction(entries, rng, stats=None):
    final, paid = auction_alloc(entries, rng, stats)
    return sim.race(final, rng, extra=paid, scarcity=False)


def draft_alloc(strats, order):
    stock = {p: STOCK for p in sim.PARTS}
    final = [list(s) for s in strats]
    for i in order:
        for k, p in enumerate(sim.PARTS):
            if final[i][k] == "P":
                if stock[p] > 0:
                    stock[p] -= 1
                else:
                    final[i][k] = "E"
    return [tuple(s) for s in final]


def evaluate(cands, field, runs, rng, racefn):
    out = {}
    for c in cands:
        t = 0
        for _ in range(runs):
            res = racefn([c] + [rng.choice(field) for _ in range(N_TEAMS - 1)], rng)
            t += title_winner(res) == 0
        out[c] = t / runs
    return out


def iterate(cands, racefn, rng, label):
    st = evaluate(cands, cands, 60, rng, racefn)
    top = sorted(cands, key=lambda c: -st[c])[:30]
    st = evaluate(cands, top, 100, rng, racefn)
    top = sorted(cands, key=lambda c: -st[c])[:30]
    st = evaluate(cands, top, 200, rng, racefn)
    print(f"\n=== {label}: {len(cands)} estratégias, contra as 30 mais fortes ===")
    return st, top


def lab(c):
    if isinstance(c[1], int):
        return f"{sim.label(c[0])} lance {c[1]:2d}  custo+lance {sim.cost(c[0]) + c[1] * c[0].count('P'):2d}"
    return sim.label(c)


def main():
    rng = random.Random(2026)

    # ---- fila sorteada (referência) ----
    def race_draft(strats, rng):
        return sim.race(strats, rng)  # sim.race já sorteia a ordem quando SCARCITY=True
    st_d, top_d = iterate(cars, race_draft, rng, "Fila sorteada (v10s)")
    for c in sorted(cars, key=lambda c: -st_d[c])[:5]:
        print(f"  {lab(c)}  títulos {st_d[c]*100:4.1f}%")

    # sorte da fila: melhor estratégia da fila jogando sempre em 1º ou sempre em último
    best = max(cars, key=lambda c: st_d[c])
    for pos_name, pos in (("1º da fila", 0), ("último da fila", N_TEAMS - 1)):
        t = 0; R = 3000
        for _ in range(R):
            strats = [best] + [rng.choice(top_d) for _ in range(N_TEAMS - 1)]
            others = list(range(1, N_TEAMS)); rng.shuffle(others)
            order = others[:pos] + [0] + others[pos:]
            res = sim.race(draft_alloc(strats, order), rng, scarcity=False)
            t += title_winner(res) == 0
        print(f"  melhor estratégia da fila sendo {pos_name}: títulos {100*t/R:4.1f}%")

    # ---- leilão ----
    stats = {"disputas": 0, "lance_vencedor": []}
    st_a, top_a = iterate(auction_strats, race_auction, rng, "Leilão de lance fechado")
    ranked = sorted(auction_strats, key=lambda c: -st_a[c])
    for c in ranked[:10]:
        print(f"  {lab(c)}  títulos {st_a[c]*100:4.1f}%")

    print("\n  melhor estratégia por tamanho do lance:")
    for b in BIDS:
        cs = [c for c in auction_strats if c[1] == b]
        c = max(cs, key=lambda c: st_a[c])
        print(f"    lance {b:2d}: {lab(c)}  títulos {st_a[c]*100:4.1f}%")

    for name, s in (("tudo oficina", ("M",) * 5), ("tudo econômico", ("E",) * 5)):
        print(f"  {name}: títulos {st_a[(s, 0)]*100:4.1f}%")

    # disputas no grid forte
    R = 3000
    for _ in range(R):
        race_auction([rng.choice(top_a) for _ in range(N_TEAMS)], rng, stats)
    lv = stats["lance_vencedor"]
    print(f"\n  no grid forte: {stats['disputas']/R:.1f} peças disputadas por corrida;"
          f" lance mínimo que ganhou: mediana {statistics.median(lv) if lv else 0}")
    bids_top = [c[1] for c in top_a]
    print("  lances usados pelas 30 mais fortes:", {b: bids_top.count(b) for b in BIDS})


if __name__ == "__main__":
    main()
