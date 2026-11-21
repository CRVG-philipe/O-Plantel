"""Calcula overall (45-92) e atributos de cada jogador.
Entrada: raw/players_all.json [k, lg, nome, pos, nasc, valor€mi, stats[j,g,a,nota]|None, sofaId]
         raw/attrs.json {sofaId: [posSofa, a1..a5]} (opcional)
Saída:   overall.json {k: {"nome|nasc": [ovr, estimado(0/1), atributos|null]}}
"""
import json, math, statistics as stt, datetime as dt, collections, os, sys

P = json.load(open('dados-brutos/overall/players_all.json', encoding='utf-8'))
A = json.load(open('dados-brutos/overall/attrs.json', encoding='utf-8')) if os.path.exists('dados-brutos/overall/attrs.json') else {}
corr = 'nao-usar'
if os.path.exists(corr):
    fx = {(c['k'], c['nome'], c['nascimento']): c for c in json.load(open(corr, encoding='utf-8'))}
    for x in P:
        c = fx.get((x[0], x[2], x[4]))
        if c: x[6] = c['stats']; x[7] = c['sofascore']

HOJE = dt.date(2026, 11, 21)
def idade(n):
    try: return (HOJE - dt.date.fromisoformat(n)).days / 365.25
    except: return 26
def setor(pos):
    return 'G' if pos == 'GOL' else 'D' if pos in ('ZAG', 'LE', 'LD') else 'M' if pos in ('VOL', 'MC', 'MEI', 'ME', 'MD') else 'F'

# força da liga = média do log do valor dos 15 mais caros de cada clube
club_vals = collections.defaultdict(list); club_lg = {}
for k, lg, nome, pos, nasc, v, s, sid in P:
    club_lg[k] = lg
    if v: club_vals[k].append(v)
lg_str = collections.defaultdict(list)
for k, vs in club_vals.items():
    top = sorted(vs, reverse=True)[:15]
    lg_str[club_lg[k]].append(stt.mean(math.log10(v + 0.02) for v in top))
LG = {lg: stt.mean(v) for lg, v in lg_str.items()}
lg_max = max(LG.values())

def fator_idade(a):
    if a < 20: return 1.7
    if a < 22: return 1.35
    if a < 24: return 1.12
    if a < 30: return 1.0
    if a < 32: return 0.8
    if a < 34: return 0.6
    return 0.45

# valor imputado para quem não tem valor: quantil 20% do valor da liga
lg_vals = collections.defaultdict(list)
for x in P:
    if x[5]: lg_vals[x[1]].append(x[5])
def q(v, p):
    v = sorted(v); return v[int(p * (len(v) - 1))] if v else 0.1

PESOS = {
    'F': [0.35, 0.25, 0.10, 0.05, 0.25],   # attacking technical tactical defending creativity
    'M': [0.15, 0.25, 0.20, 0.15, 0.25],
    'D': [0.05, 0.15, 0.30, 0.40, 0.10],
    'G': [0.35, 0.20, 0.15, 0.15, 0.15],   # saves anticipation distribution aerial tactical
}

rows = []
for x in P:
    k, lg, nome, pos, nasc, v, s, sid = x
    a = idade(nasc); sec = setor(pos)
    est = 0
    if not v:
        est = 1
        v = q(lg_vals.get(lg, []), 0.2) or 0.05
    va = v / fator_idade(a)
    if sec == 'G': va *= 1.6
    elif sec == 'D': va *= 1.15
    score = math.log10(va + 0.02)
    # nota Sofascore, pesada pela confiabilidade (jogos) e pela força da liga
    if s and s[0] and s[3]:
        rel = s[0] / (s[0] + 12)
        score += 0.55 * (s[3] - 6.85) * rel * (0.6 + 0.4 * (LG.get(lg, 0) / lg_max))
    elif s is not None and s[0] == 0:
        score -= 0.05
    at = A.get(str(sid)) if sid else None
    rows.append([x, score, at, sec, est])

# atributos: z-score dentro de (liga, setor), soma pequena ao score
grp = collections.defaultdict(list)
for r in rows:
    if r[2]:
        w = PESOS['G' if r[2][0] == 'G' else r[3]]
        r.append(sum(wi * ai for wi, ai in zip(w, r[2][1:])))
        grp[(r[0][1], r[3])].append(r[-1])
    else:
        r.append(None)
for r in rows:
    if r[5] is not None and len(grp[(r[0][1], r[3])]) > 8:
        g = grp[(r[0][1], r[3])]; m, sd = stt.mean(g), stt.pstdev(g) or 1
        r[1] += 0.12 * (r[5] - m) / sd

# percentil -> overall
alvo = [(0, 45), (0.05, 51), (0.2, 57), (0.5, 63), (0.8, 69), (0.95, 75), (0.99, 81), (0.998, 86), (1, 91)]
ordem = sorted(range(len(rows)), key=lambda i: rows[i][1])
n = len(rows); out = collections.defaultdict(dict)
for rank, i in enumerate(ordem):
    p = rank / (n - 1)
    for (p0, o0), (p1, o1) in zip(alvo, alvo[1:]):
        if p <= p1:
            ovr = round(o0 + (o1 - o0) * (p - p0) / (p1 - p0)); break
    x, score, at, sec, est = rows[i][:5]
    attr = None
    if at:
        attr = {'tipo': 'G' if at[0] == 'G' else 'L', 'v': at[1:]}
    out[x[0]][x[2] + '|' + x[4]] = [ovr, est, attr]
json.dump(out, open('public/overall.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

# relatório
flat = [(v[0], k, nm) for k, d in out.items() for nm, v in d.items()]
flat.sort(reverse=True)
print('top', [(o, nm.split('|')[0]) for o, k, nm in flat[:15]])
for lg in ['ENG', 'BRA', 'BRB', 'BRC', 'SAU', 'JPN']:
    vs = sorted([v[0] for x, (k, d) in [(0, kv) for kv in out.items()] for nm, v in d.items() if club_lg[k] == lg])
    print(lg, 'mediana', vs[len(vs) // 2], 'p90', vs[int(len(vs) * .9)], 'max', vs[-1])
print('com atributos', sum(1 for r in rows if r[2]), 'de', len(rows))
