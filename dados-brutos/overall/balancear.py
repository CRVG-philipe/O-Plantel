"""Balanceamento por liga sobre o overall v1.
f(x) = x + a + b*max(0, x - c)   (c = percentil 85 da liga; b<0 comprime o topo, b>0 estica)
A ordem dos jogadores dentro da liga não muda."""
import json, collections, sys, itertools
IN = sys.argv[1] if len(sys.argv) > 1 else 'dados-brutos/overall/overall_v1.json'
PL = sys.argv[2] if len(sys.argv) > 2 else 'dados-brutos/overall/players_all.json'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'public/overall.json'
O = json.load(open(IN, encoding='utf-8')); lg = {x[0]: x[1] for x in json.load(open(PL, encoding='utf-8'))}
ALVO = {  # liga: (média dos 11 melhores por time, melhor time, maior jogador)  None = livre
 'BRA': (76, 81, 83), 'POR': (71, 80, 83), 'ENG2': (69, 75, 81), 'NED': (69, 77, 82), 'TUR': (70, 79, 85),
 'ARG': (70, 77, 83), 'BEL': (68, None, None), 'SCO': (64, None, None), 'BRB': (67, None, None), 'BRC': (59, None, None)}
def met(clubs, f):
    tops = []; mx = 0
    for vs in clubs:
        v = sorted((f(x) for x in vs), reverse=True); tops.append(sum(v[:11]) / 11); mx = max(mx, v[0])
    return sum(tops) / len(tops), max(tops), mx
PARAM = {}
for L, (t_avg, t_best, t_max) in ALVO.items():
    clubs = [[v[0] for v in d.values()] for k, d in O.items() if lg[k] == L]
    allv = sorted(x for c in clubs for x in c); c = allv[int(.85 * (len(allv) - 1))]
    best = None
    bs = [0] if t_best is None else [i / 20 for i in range(-16, 11)]
    for a in [i / 4 for i in range(-24, 25)]:
        for b in bs:
            f = lambda x: x + a + b * max(0, x - c)
            m = met(clubs, f)
            err = (m[0] - t_avg) ** 2 * 3 + ((m[1] - t_best) ** 2 if t_best else 0) + ((m[2] - t_max) ** 2 if t_max else 0)
            if best is None or err < best[0]: best = (err, a, b, m)
    PARAM[L] = (best[1], best[2], c)
    print(L, 'a=%.2f b=%.2f c=%d' % (best[1], best[2], c), 'resultado média %.1f melhor %.1f max %.1f' % best[3], 'alvo', (t_avg, t_best, t_max))
out = {}
for k, d in O.items():
    p = PARAM.get(lg[k])
    out[k] = {nm: ([max(40, min(92, round(v[0] + p[0] + p[1] * max(0, v[0] - p[2]))))] if p else [v[0]]) + [0, v[2]] for nm, v in d.items()}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump({L: {'a': p[0], 'b': p[1], 'c': p[2]} for L, p in PARAM.items()}, open('dados-brutos/overall/balanceamento-parametros.json', 'w'), indent=1)
