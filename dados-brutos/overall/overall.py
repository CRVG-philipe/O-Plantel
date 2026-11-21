"""Overall v2: mistura mercado (valor+idade) e desempenho (nota, jogos, gols/assist., atributos, força da liga).
Peso do desempenho cresce com os jogos: w = min(0.8, jogos/(jogos+12)).
Entrada: players_all.json, attrs.json  Saída: overall.json (+ relatório de diferenças)"""
import json, math, statistics as stt, datetime as dt, collections, os, sys, bisect
BASE = sys.argv[1] if len(sys.argv) > 1 else 'dados-brutos/overall/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'public/overall.json'
P = json.load(open(BASE + ('players_all_fix.json' if os.path.exists(BASE + 'players_all_fix.json') else 'players_all.json'), encoding='utf-8'))
A = json.load(open(BASE + 'attrs.json', encoding='utf-8')) if os.path.exists(BASE + 'attrs.json') else {}
HOJE = dt.date(2026, 11, 21)
def idade(n):
    try: return (HOJE - dt.date.fromisoformat(n)).days / 365.25
    except: return 26
def setor(p): return 'G' if p == 'GOL' else 'D' if p in ('ZAG','LE','LD') else 'M' if p in ('VOL','MC','MEI','ME','MD') else 'F'

club_vals = collections.defaultdict(list); club_lg = {}
for k, lg, *_r in P: club_lg[k] = lg
for x in P:
    if x[5]: club_vals[x[0]].append(x[5])
lg_s = collections.defaultdict(list)
for k, vs in club_vals.items():
    lg_s[club_lg[k]].append(stt.mean(math.log10(v + .02) for v in sorted(vs, reverse=True)[:15]))
LG = {l: stt.mean(v) for l, v in lg_s.items()}
lg_vals = collections.defaultdict(list)
for x in P:
    if x[5]: lg_vals[x[1]].append(x[5])
def q(v, p): v = sorted(v); return v[int(p * (len(v) - 1))] if v else .1
def fator_idade(a):
    return 1.7 if a < 20 else 1.35 if a < 22 else 1.12 if a < 24 else 1.0 if a < 30 else .8 if a < 32 else .6 if a < 34 else .45
PESOS = {'F': [.35,.25,.10,.05,.25], 'M': [.15,.25,.20,.15,.25], 'D': [.05,.15,.30,.40,.10], 'G': [.35,.20,.15,.15,.15]}
ALVO = [(0,45),(.05,51),(.2,57),(.5,63),(.8,69),(.95,75),(.99,81),(.998,86),(1,91)]
def alvo(p):
    for (p0,o0),(p1,o1) in zip(ALVO, ALVO[1:]):
        if p <= p1: return o0 + (o1-o0)*(p-p0)/(p1-p0)
    return 91

R = []
for x in P:
    k, lg, nome, pos, nasc, v, s, sid = x
    sec = setor(pos); a = idade(nasc); est = 0
    if not v: est = 1; v = q(lg_vals.get(lg, []), .2) or .05
    va = v / fator_idade(a) * (1.6 if sec == 'G' else 1.15 if sec == 'D' else 1)
    m = math.log10(va + .02)
    at = A.get(str(sid)) if sid else None
    R.append(dict(x=x, sec=sec, est=est, m=m, s=s, at=at, idade=a))

# z dos atributos dentro de (liga, setor)
grp = collections.defaultdict(list)
for r in R:
    if r['at']:
        w = PESOS['G' if r['at'][0] == 'G' else r['sec']]
        r['az'] = sum(wi*ai for wi, ai in zip(w, r['at'][1:])); grp[(r['x'][1], r['sec'])].append(r['az'])
for r in R:
    g = grp.get((r['x'][1], r['sec']), [])
    r['z'] = (r['az'] - stt.mean(g)) / (stt.pstdev(g) or 1) if r.get('az') is not None and len(g) > 8 else 0

# mercado -> overall por percentil (inclui pequeno ajuste de nota como antes)
for r in R:
    s = r['s']; mk = r['m']
    if s and s[0] and s[3]:
        mk += .3 * (s[3] - 6.85) * s[0] / (s[0] + 12)
    r['mk'] = mk + .08 * r['z']
ordm = sorted(R, key=lambda r: r['mk'])
for i, r in enumerate(ordm): r['ovr_m'] = alvo(i / (len(R) - 1))

# desempenho (só para quem tem nota e >= 5 jogos)
lgmax = max(LG.values()); lgmin = min(LG.values())
# nota média por setor (titulares) para comparar goleiro com goleiro, zagueiro com zagueiro...
sec_nt = collections.defaultdict(list); sec_ct = collections.defaultdict(list)
for r in R:
    s = r['s']
    if s and s[0] >= 15 and s[3]:
        sec_nt[r['sec']].append(s[3]); sec_ct[r['sec']].append((s[1] + .7 * s[2]) / s[0])
NT = {k: stt.mean(v) for k, v in sec_nt.items()}; CT = {k: stt.mean(v) for k, v in sec_ct.items()}
for r in R:
    s = r['s']; r['pf'] = None
    if s and s[0] >= 5 and s[3]:
        jg, gl, asi, nt = s[:4]
        contrib = (gl + .7 * asi) / jg - CT[r['sec']]
        bonus = {'F': .35, 'M': .6, 'D': 1.0, 'G': 0}[r['sec']] * contrib
        forca = (LG.get(r['x'][1], lgmin) - lgmin) / (lgmax - lgmin)
        r['pf'] = (nt - NT[r['sec']]) * 1.0 + bonus + 1.6 * forca + .12 * r['z']
# alinha a escala do desempenho com a do mercado entre os titulares (>=15 jogos)
base = [r for r in R if r['pf'] is not None and r['s'][0] >= 15]
pfs = sorted(r['pf'] for r in base); oms = sorted(r['ovr_m'] for r in base)
def map_pf(v):
    i = bisect.bisect_left(pfs, v); i = min(max(i, 0), len(pfs) - 1)
    return oms[i]
for r in R:
    if r['pf'] is None: r['ovr'] = r['ovr_m']; r['w'] = 0; continue
    r['ovr_p'] = map_pf(r['pf'])
    jg = r['s'][0]; w = min(.8, jg / (jg + 12)); r['w'] = w
    if r['ovr_p'] < r['ovr_m']:          # desempenho abaixo do mercado: pesa menos (nota baixa em pouco tempo é ruído; goleiro de time grande trabalha pouco)
        w *= .25 if r['sec'] == 'G' else .4
    r['w'] = w
    r['ovr'] = w * r['ovr_p'] + (1 - w) * r['ovr_m']

out = collections.defaultdict(dict)
for r in R:
    x = r['x']; at = r['at']
    out[x[0]][x[2] + '|' + x[4]] = [max(40, min(92, round(r['ovr']))), r['est'], {'tipo': 'G' if at[0] == 'G' else 'L', 'v': at[1:]} if at else None]
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump([[r['x'][0], r['x'][1], r['x'][2], r['x'][3], round(r['idade']), r['x'][5], r['s'], round(r['ovr_m']), round(r.get('ovr_p') or 0), round(r['ovr'])] for r in R], open(BASE + 'overall_debug.json', 'w', encoding='utf-8'), ensure_ascii=False)
