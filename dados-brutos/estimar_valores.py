# Estima o valor de mercado de quem está sem valor no Transfermarkt (valor 0 no data.json).
#
# Rodar na raiz do projeto, DEPOIS do build_final.py:
#     python dados-brutos/estimar_valores.py
# Gera public/valores-estimados.json: { "<clube>": { "<nome>|<nascimento>": valor_em_€mi } }.
# O data.json não muda: o site lê os dois e usa o estimado só quando o valor real é 0.
#
# Modelo (simples, de propósito):
#   1. Valor-base = mediana dos valores reais por faixa de idade (até 21, 22–25, 26–29, 30–32, 33+)
#      × setor (GOL, defesa, meio, ataque), na liga de referência. Faixa com poucos jogadores: mediana da idade.
#   2. Fatores de jogos na temporada (stats[0]) e de nota (stats[3]): para cada faixa, a mediana de
#      valor real ÷ valor-base dos jogadores de referência nessa faixa (limitado entre 0,4 e 2,5).
#      Sem estatísticas: fator 1.
#   3. Série C (BRC): referência = Série B com valor, multiplicada pela razão mediana(BRC real) ÷ mediana(BRB real);
#      com poucos valores reais na Série C (menos de 50), usa 0,35. Limites: € 0,05 a 1,5 mi.
#   4. Outras ligas: referência = a própria liga (ou a de cima do mesmo país, se tiver menos de 60 valores reais),
#      limitada ao percentil 75 dos valores reais da própria liga (mínimo € 0,05 mi).
#   Tudo arredondado para € 0,05 mi.
import json, os, sys
from collections import defaultdict
from statistics import median

def ler(f): return json.load(open(f, encoding='utf-8'))

HOJE = (2026, 11, 20)  # data dos dados
SETOR = {'GOL': 'gol', 'ZAG': 'def', 'LD': 'def', 'LE': 'def', 'VOL': 'mei', 'MC': 'mei', 'MEI': 'mei', 'MD': 'mei', 'ME': 'mei',
         'PE': 'ata', 'PD': 'ata', 'SA': 'ata', 'CA': 'ata'}
LIGA_DE_CIMA = {'BRB': 'BRA', 'BRC': 'BRB', 'ENG2': 'ENG', 'ESP2': 'ESP', 'ITA2': 'ITA', 'GER2': 'GER', 'FRA2': 'FRA'}
MIN_REFERENCIA = 60      # valores reais mínimos para a liga servir de referência para si mesma
MIN_SERIE_C = 50         # valores reais mínimos na Série C para usar a razão calculada
RAZAO_SERIE_C = 0.35     # razão Série C ÷ Série B quando há poucos dados
LIMITES_SERIE_C = (0.05, 1.5)

def idade(dob):
    if not dob: return None
    a, m, d = map(int, dob.split('-'))
    return HOJE[0] - a - ((HOJE[1], HOJE[2]) < (m, d))

def faixa_idade(a):
    if a is None: return None
    return '≤21' if a <= 21 else '22-25' if a <= 25 else '26-29' if a <= 29 else '30-32' if a <= 32 else '33+'

def faixa_jogos(st):
    if not st: return None
    j = st[0]
    return '0' if j == 0 else '1-9' if j < 10 else '10-19' if j < 20 else '20-29' if j < 30 else '30+'

def faixa_nota(st):
    if not st or not st[0] or not st[3]: return None
    r = st[3]
    return '<6,5' if r < 6.5 else '6,5-6,8' if r < 6.8 else '6,8-7,1' if r < 7.1 else '7,1+'

def arred(v): return round(round(v / 0.05) * 0.05, 2)

class Modelo:
    """Mediana por idade × setor e fatores de jogos e nota, ajustados nos jogadores com valor real."""
    def __init__(self, jogadores):
        com = [j for j in jogadores if j['v'] > 0]
        por_celula, por_idade = defaultdict(list), defaultdict(list)
        for j in com:
            por_celula[(j['faixa'], j['setor'])].append(j['v'])
            por_idade[j['faixa']].append(j['v'])
        self.geral = median(j['v'] for j in com)
        self.celula = {k: median(v) for k, v in por_celula.items() if len(v) >= 5}
        self.idade = {k: median(v) for k, v in por_idade.items() if len(v) >= 5}
        # Fatores: primeiro jogos, depois nota sobre o que sobrou
        self.f_jogos = self._fator(com, faixa_jogos, lambda j: self.base(j))
        self.f_nota = self._fator(com, faixa_nota, lambda j: self.base(j) * self.f_jogos.get(faixa_jogos(j['st']), 1))
    def base(self, j):
        return self.celula.get((j['faixa'], j['setor'])) or self.idade.get(j['faixa']) or self.geral
    def _fator(self, com, faixa, previsto):
        grupos = defaultdict(list)
        for j in com:
            f = faixa(j['st'])
            if f: grupos[f].append(j['v'] / previsto(j))
        return {f: min(2.5, max(0.4, median(r))) for f, r in grupos.items() if len(r) >= 8}
    def prever(self, j):
        return self.base(j) * self.f_jogos.get(faixa_jogos(j['st']), 1) * self.f_nota.get(faixa_nota(j['st']), 1)

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    d = ler('public/data.json')
    por_liga = defaultdict(list)
    for c in d['clubs']:
        for p in c['p']:
            a = idade(p[3])
            por_liga[c['lg']].append({'clube': c['k'], 'clube_n': c['n'], 'n': p[1], 'dob': p[3], 'pos': p[2], 'v': p[5] or 0,
                                      'st': p[8], 'idade': a, 'faixa': faixa_idade(a), 'setor': SETOR.get(p[2], 'mei')})
    reais = {lg: [j['v'] for j in js if j['v'] > 0] for lg, js in por_liga.items()}
    saida = defaultdict(dict)
    resumo = []
    exemplos_c = []
    for l in d['leagues']:
        lg = l['k']; js = por_liga[lg]
        sem = [j for j in js if not j['v']]
        if not sem: continue
        if lg == 'BRC':
            # Série C: modelo da Série B (com valor) × razão Série C ÷ Série B
            ref = 'BRB'
            modelo = Modelo(por_liga['BRB'])
            if len(reais['BRC']) >= MIN_SERIE_C: razao = median(reais['BRC']) / median(reais['BRB'])
            else: razao = RAZAO_SERIE_C
            lo, hi = LIMITES_SERIE_C
            print(f"Série C: {len(reais['BRC'])} valores reais (mediana € {median(reais['BRC'])} mi) contra {len(reais['BRB'])} da Série B "
                  f"(mediana € {median(reais['BRB'])} mi) → razão usada {razao:.2f}" + (" (poucos dados)" if razao == RAZAO_SERIE_C else ""))
        else:
            ref = lg if len(reais[lg]) >= MIN_REFERENCIA or lg not in LIGA_DE_CIMA else LIGA_DE_CIMA[lg]
            modelo = Modelo(por_liga[ref])
            razao = 1 if ref == lg else median(reais[lg]) / median(reais[ref]) if reais[lg] else RAZAO_SERIE_C
            r = sorted(reais[lg])
            lo, hi = 0.05, max(0.05, r[int(len(r) * 0.75)]) if r else (0.05, 1.5)
        for j in sem:
            v = min(hi, max(lo, arred(modelo.prever(j) * razao)))
            saida[j['clube']][f"{j['n']}|{j['dob']}"] = v
            if lg == 'BRC': exemplos_c.append((j, v))
        resumo.append((lg, len(sem), len(js), ref, hi))

    json.dump(saida, open('public/valores-estimados.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('\nValores estimados por liga (sem valor / jogadores · referência · teto):')
    for lg, n, tot, ref, hi in resumo: print(f'  {lg:<5} {n:>4} / {tot:<4} · ref {ref:<4} · teto € {hi} mi')
    print(f'  TOTAL {sum(r[1] for r in resumo)} valores estimados em {len(resumo)} ligas → public/valores-estimados.json '
          f'({os.path.getsize("public/valores-estimados.json") // 1024} KB)')
    print('\n5 exemplos da Série C:')
    exemplos_c.sort(key=lambda x: -x[1])
    for j, v in [exemplos_c[0], exemplos_c[len(exemplos_c) // 4], exemplos_c[len(exemplos_c) // 2], exemplos_c[3 * len(exemplos_c) // 4], exemplos_c[-1]]:
        st = j['st']; s = f"{st[0]} jogos, nota {st[3]}" if st else "sem estatísticas"
        print(f"  {j['n']} ({j['clube_n']}, {j['pos']}, {j['idade']} anos, {s}) → ~€ {v} mi")

if __name__ == '__main__':
    main()
