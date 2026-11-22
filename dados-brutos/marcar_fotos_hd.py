# Marca as fotos HD dos jogadores no data.json (campo hd, o último de cada jogador).
#
# Rodar na raiz do projeto, quando chegarem fotos novas em public/img/players/:
#     python dados-brutos/marcar_fotos_hd.py
# O build_final.py também chama este script no fim, então as fotos não se perdem ao gerar o data.json de novo.
#
# Como funciona:
#   - dados-brutos/fotos-ids.json e dados-brutos/rodada3/fotos-ids-3.json: {"<clube>": {"<nome exato>": <ID Sofascore>}}
#   - se public/img/players/<ID>.webp existe, o jogador ganha hd = ID; se o ID está lá mas o arquivo não, hd = 0;
#   - jogador que não está no fotos-ids.json fica como está.
#   - Nome repetido no mesmo clube (ex.: dois "Danilo" no Botafogo): o nome não diz de quem é a foto, então
#     usa o ID de cada um pela posição no elenco (kept.json para as ligas originais, ids_sofascore_novas*.json
#     para as novas). Sem ID, fica sem foto.
import json, os
from collections import Counter

def ler(f): return json.load(open(f, encoding='utf-8'))

PASTA = 'public/img/players'
# {clube: {nome exato: ID Sofascore}}: rodadas 0 a 2 em fotos-ids.json; rodada 3 em rodada3/fotos-ids-3.json
ARQS_IDS = ['dados-brutos/fotos-ids.json', 'dados-brutos/rodada3/fotos-ids-3.json']

def fotos_existentes():
    return {int(f[:-5]) for f in os.listdir(PASTA) if f.endswith('.webp') and f[:-5].isdigit()} if os.path.isdir(PASTA) else set()

def ids_por_posicao():
    """{clube: [ID Sofascore de cada jogador, na ordem do elenco]} (0 = sem ID)"""
    ids = {}
    for arq in ['dados-brutos/ids_sofascore_novas.json', 'dados-brutos/ids_sofascore_novas_2.json', 'dados-brutos/rodada3/ids_sofascore_novas_3.json']:
        if os.path.exists(arq): ids.update(ler(arq))
    if os.path.exists('dados-brutos/all_pre.json') and os.path.exists('dados-brutos/kept.json'):
        pre = ler('dados-brutos/all_pre.json'); kept = ler('dados-brutos/kept.json')
        for c in pre['clubs']:
            ids[c['k']] = [kept[p[7]] if p[7] >= 0 else 0 for p in c['p']]
    return ids

def marcar(clubs):
    """Grava o hd de cada jogador (muda a lista clubs no lugar)."""
    fotos = {}
    for arq in ARQS_IDS:
        if os.path.exists(arq): fotos.update(ler(arq))
    if not fotos: return
    tem = fotos_existentes(); pos = ids_por_posicao()
    for c in clubs:
        mapa = fotos.get(c['k'], {})
        repetidos = Counter(p[1] for p in c['p'])
        for i, p in enumerate(c['p']):
            if p[1] not in mapa: continue
            sid = mapa[p[1]]
            if repetidos[p[1]] > 1:
                lista = pos.get(c['k'], [])
                sid = lista[i] if i < len(lista) else 0
            p[9] = sid if sid in tem else 0

def relatorio(leagues, clubs):
    por_liga = {l['k']: [0, 0] for l in leagues}
    for c in clubs:
        for p in c['p']:
            por_liga[c['lg']][1] += 1
            if p[9]: por_liga[c['lg']][0] += 1
    print('Fotos HD por liga (com foto / jogadores):')
    for l in leagues:
        com, tot = por_liga[l['k']]
        print(f"  {l['k']:<5} {com:>5} / {tot:<5} {com * 100 // tot if tot else 0:>3}%")
    com = sum(v[0] for v in por_liga.values()); tot = sum(v[1] for v in por_liga.values())
    print(f'  TOTAL {com} / {tot} ({com * 100 // tot}%)')

if __name__ == '__main__':
    d = ler('public/data.json')
    marcar(d['clubs'])
    json.dump(d, open('public/data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    relatorio(d['leagues'], d['clubs'])
