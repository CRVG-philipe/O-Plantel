"""Overall dos jogadores novos (rodada 3) na MESMA escala da v1, sem mexer nos antigos."""
import json, math, statistics as stt, datetime as dt, collections, bisect, sys
OLD = json.load(open('raw/players_all_fix.json')); NEW = json.load(open('raw/players_r3.json'))
A = json.load(open('raw/attrs.json')); A.update(json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {})
V1 = json.load(open('pacote8/public/overall.json'))
HOJE = dt.date(2026, 11, 21)
def idade(n):
    try: return (HOJE - dt.date.fromisoformat(n)).days / 365.25
    except: return 26
def setor(p): return 'G' if p == 'GOL' else 'D' if p in ('ZAG','LE','LD') else 'M' if p in ('VOL','MC','MEI','ME','MD') else 'F'
def fator_idade(a):
    return 1.7 if a < 20 else 1.35 if a < 22 else 1.12 if a < 24 else 1.0 if a < 30 else .8 if a < 32 else .6 if a < 34 else .45
PESOS = {'F': [.35,.25,.10,.05,.25], 'M': [.15,.25,.20,.15,.25], 'D': [.05,.15,.30,.40,.10], 'G': [.35,.20,.15,.15,.15]}
def run(P):
    club_vals = collections.defaultdict(list); club_lg = {}
    for x in P:
        club_lg[x[0]] = x[1]
        if x[5]: club_vals[x[0]].append(x[5])
    lg_s = collections.defaultdict(list)
    for k, vs in club_vals.items(): lg_s[club_lg[k]].append(stt.mean(math.log10(v + .02) for v in sorted(vs, reverse=True)[:15]))
    LG = {l: stt.mean(v) for l, v in lg_s.items()}; lgmax = max(LG.values())
    lgv = collections.defaultdict(list)
    for x in P:
        if x[5]: lgv[x[1]].append(x[5])
    def q(v, p): v = sorted(v); return v[int(p * (len(v) - 1))] if v else .1
    rows = []
    for x in P:
        k, lg, nome, pos, nasc, v, s, sid = x; sec = setor(pos)
        if not v: v = q(lgv.get(lg, []), .2) or .05
        va = v / fator_idade(idade(nasc)) * (1.6 if sec == 'G' else 1.15 if sec == 'D' else 1)
        sc = math.log10(va + .02)
        if s and s[0] and s[3]: sc += .55 * (s[3] - 6.85) * s[0] / (s[0] + 12) * (.6 + .4 * (LG.get(lg, 0) / lgmax))
        elif s is not None and s[0] == 0: sc -= .05
        at = A.get(str(sid)) if sid else None
        az = sum(w * a for w, a in zip(PESOS['G' if at[0] == 'G' else sec], at[1:])) if at else None
        rows.append([x, sc, at, sec, az])
    grp = collections.defaultdict(list)
    for r in rows:
        if r[4] is not None: grp[(r[0][1], r[3])].append(r[4])
    for r in rows:
        g = grp[(r[0][1], r[3])]
        if r[4] is not None and len(g) > 8: r[1] += .12 * (r[4] - stt.mean(g)) / (stt.pstdev(g) or 1)
    return rows
ALVO = [(0,45),(.05,51),(.2,57),(.5,63),(.8,69),(.95,75),(.99,81),(.998,86),(1,91)]
old_rows = run(OLD)
# confere a v1 (antes do balanceamento usava outra escala de alvo; aqui reconstruímos o mapa score->ovr dos antigos)
sc_old = sorted(r[1] for r in old_rows); n = len(sc_old)
alvo0 = [(0,45),(.05,51),(.2,57),(.5,63),(.8,69),(.95,75),(.99,81),(.998,86),(1,91)]
def ovr_from_score(s):
    i = bisect.bisect_left(sc_old, s); p = min(max(i / (n - 1), 0), 1)
    for (p0,o0),(p1,o1) in zip(alvo0, alvo0[1:]):
        if p <= p1: return round(o0 + (o1-o0)*(p-p0)/(p1-p0))
    return 91
chk = sum(1 for r in old_rows if ovr_from_score(r[1]) == V1[r[0][0]][r[0][2]+'|'+r[0][4]][0]) / n
print('reproduz v1:', round(chk*100,1), '%')
all_rows = run(OLD + NEW)  # força das ligas/atributos calculados com todos
new_rows = all_rows[len(OLD):]
out = collections.defaultdict(dict)
for r in new_rows:
    x = r[0]; at = r[2]
    out[x[0]][x[2] + '|' + x[4]] = [ovr_from_score(r[1]), 0, {'tipo': 'G' if at[0] == 'G' else 'L', 'v': at[1:]} if at else None]
json.dump(out, open('raw/overall_r3_v1.json', 'w'), ensure_ascii=False, separators=(',', ':'))
lgk = {x[0]: x[1] for x in NEW}
T = collections.defaultdict(list)
for k, d in out.items():
    vs = sorted([v[0] for v in d.values()], reverse=True); T[lgk[k]].append(sum(vs[:11]) / 11)
for l, t in T.items(): print(l, 'média', round(sum(t)/len(t)), 'melhor', round(max(t)), 'max', max(v[0] for k, d in out.items() if lgk[k] == l for v in d.values()))
