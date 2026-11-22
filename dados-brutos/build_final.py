import json,os,sys
def ler(f): return json.load(open(f,encoding='utf-8'))
pre=ler('dados-brutos/all_pre.json');local=ler('dados-brutos/local.json');kept=ler('dados-brutos/kept.json')
st=ler('dados-brutos/stats2.json') if os.path.exists('dados-brutos/stats2.json') else None
# Imagens em alta resolução já baixadas (por baixar_imagens.py). Só ganha "hd" quem tem o arquivo.
def tem(pasta): return {int(f[:-5]) for f in os.listdir(pasta) if f.endswith('.webp')} if os.path.isdir(pasta) else set()
HD_P=tem('public/img/players');HD_T=tem('public/img/teams')
LGN={'ENG':['Premier League','Inglaterra','Inglaterra'],'ESP':['LaLiga','Espanha','Espanha'],'ITA':['Serie A','Itália','Itália'],'GER':['Bundesliga','Alemanha','Alemanha'],'FRA':['Ligue 1','França','França'],'BRA':['Brasileirão Série A','Brasil','Brasil'],'BRB':['Brasileirão Série B','Brasil','Brasil'],'ARG':['Liga Argentina','Argentina','Argentina'],'SAU':['Liga Saudita','Arábia Saudita','Arábia Saudita'],'USA':['MLS','EUA e Canadá','Estados Unidos']}
order=['BRA','BRB','ENG','ESP','ITA','GER','FRA','ARG','SAU','USA']
# div = divisão da liga no país (1 = primeira, 2 = segunda)
leagues=[{'k':k,'n':LGN[k][0],'pais':LGN[k][1],'nat':LGN[k][2],'season':pre['leagues'][k]['season'],'div':2 if k=='BRB' else 1} for k in order]

# ---- Ligas novas (já vêm no formato final) ----
#   rodada 1 (20/11/2026): 16 ligas, dados-brutos/novas_ligas.json
#   rodada 2 (20/11/2026): 20 ligas, dados-brutos/novas_ligas_2.json
#   rodada 3 (21/11/2026): 20 ligas, dados-brutos/rodada3/novas_ligas_3.json (jogadores já com estatísticas)
NOVAS_ARQS=['dados-brutos/novas_ligas.json','dados-brutos/novas_ligas_2.json','dados-brutos/rodada3/novas_ligas_3.json']
NOVAS={'leagues':[],'clubs':[]}
for arq in NOVAS_ARQS:
    x=ler(arq);NOVAS['leagues']+=x['leagues'];NOVAS['clubs']+=x['clubs']
# Correções:
# nomes iguais a outras ligas (ficaria ambíguo no filtro do Mercado)
NOME_LIGA={'AUT':'Bundesliga Austríaca','SUI':'Super League Suíça','GRE':'Super League Grega',
           'UAE':'Pro League dos Emirados','SRB':'Superliga Sérvia','UKR':'Premier Liga Ucraniana','RUS':'Premier Liga Russa',
           'EGY':'Premier League Egípcia','RSA':'Premiership Sul-Africana','CRC':'Primera División da Costa Rica'}
# ligas que vão de julho/agosto a maio (não são ano fechado)
TEMPORADA={'MEX':'26/27',  # Liga MX: Apertura + Clausura
           'JPN':'26/27'}  # J1 League: mudou para o calendário europeu a partir de 2026/27
# "nat" precisa ser escrito igual à nacionalidade dos jogadores (para contar estrangeiros)
NAT={'PER':'Perú','POL':'Polónia','CZE':'República Checa','ROU':'Roménia','QAT':'Qatar','PER2':'Perú','SVN':'Eslovénia'}
for l in NOVAS['leagues']:
    leagues.append({'k':l['k'],'n':NOME_LIGA.get(l['k'],l['n']),'pais':l['pais'],'nat':NAT.get(l['k'],l['nat']),'season':TEMPORADA.get(l['k'],l['season']),'div':l['div']})
# Ordem das ligas (filtros do Mercado): por continente e país, 1ª divisão antes da 2ª
ORDEM=['BRA','BRB','BRC','ARG','ARG2','COL','COL2','URU','CHI','CHI2','PAR','ECU','PER','PER2','BOL','VEN',
       'MEX','USA','USL','CAN','CRC','HON',
       'ENG','ENG2','ESP','ESP2','ITA','ITA2','GER','GER2','FRA','FRA2','POR','NED','BEL','TUR','SCO','AUT','SUI','GRE','DEN','NOR',
       'SWE','POL','CZE','CRO','SRB','UKR','ROU','RUS','ISR','HUN','SVK','BUL','CYP','SVN',
       'SAU','JPN','KOR','CHN','QAT','UAE',
       'EGY','MAR','RSA','AUS']
leagues.sort(key=lambda l:ORDEM.index(l['k']))
clubs=[]
for c in pre['clubs']:
    ps=[]
    for p in c['p']:
        g=p[7];sp=local.get(str(g),-1) if g>=0 else -1
        s=None
        if st is not None and g>=0:
            x=st[g]
            if x and x[0]>0: s=x[:4]
            elif x and x[0]==0: s=[0,0,0,0]
        hd=kept[g] if g>=0 and kept[g] in HD_P else 0
        ps.append([p[0],p[1],p[2],p[3],p[4],p[5],p[6],sp,s,hd])
    clubs.append({'k':c['k'],'lg':c['lg'],'n':c['n'],'coach':c['coach'],'c':c['c'],'c2':c['c2'],'hd':c['sid'] if c['sid'] in HD_T else 0,'p':ps})
# Clubes das ligas novas: jogadores ainda sem foto (-1), sem estatísticas (None) e sem foto HD (0).
# O ID Sofascore de cada jogador está em dados-brutos/ids_sofascore_novas.json e ids_sofascore_novas_2.json (mesma ordem do elenco).
for c in NOVAS['clubs']:
    clubs.append({'k':c['k'],'lg':c['lg'],'n':c['n'],'coach':c['coach'],'c':c['c'],'c2':c['c2'],'hd':c['hd'] if c['hd'] in HD_T else 0,'p':c['p']})

# ---- Estatísticas coletadas depois (por nome do jogador, clube a clube) ----
#   bloco 1 (21/11/2026): MEX, POR, BEL, SCO, NOR, NED, TUR, DEN, SUI, GRE, AUT, ENG2, ESP2, ITA2, GER2, FRA2
#   e os jogadores da ARG e da SAU que estavam sem estatísticas.
#   bloco 2 (21/11/2026): COL, URU, CHI, PAR, ECU, PER, BRC, SWE, POL, CZE, CRO, SRB, UKR, ROU, RUS, JPN, KOR, CHN, QAT, UAE
#   Formato: {"stats": {"<clube>": {"<nome exato>": [jogos, gols, assist, nota]}}}. [0,0,0,0] = não entrou em campo.
#   Os dados brutos, por ID Sofascore, estão em stats_sofascore_bloco1.json e stats_sofascore_bloco2.json
#   ([jogos, gols, assist, nota, nº de competições]).
#   Nome repetido no mesmo clube (ex.: dois "João Pedro" no Brusque): o nome não diz de quem são os números,
#   então usa o ID Sofascore de cada um (ids_sofascore_novas*.json) e os dados brutos. Sem ID, fica como está.
STATS_ARQS=[('dados-brutos/estatisticas_bloco1.json','dados-brutos/stats_sofascore_bloco1.json'),
            ('dados-brutos/estatisticas_bloco2.json','dados-brutos/stats_sofascore_bloco2.json')]
IDS={}
for arq in ['dados-brutos/ids_sofascore_novas.json','dados-brutos/ids_sofascore_novas_2.json']: IDS.update(ler(arq))
por_k={c['k']:c for c in clubs}
for arq,arq_bruto in STATS_ARQS:
    if not os.path.exists(arq): continue
    bruto=ler(arq_bruto) if os.path.exists(arq_bruto) else {}
    atualizados=nao_achados=pelo_id=0
    for k,nomes in ler(arq)['stats'].items():
        c=por_k.get(k)
        if not c: nao_achados+=len(nomes); continue
        for nome,s in nomes.items():
            iguais=[i for i,p in enumerate(c['p']) if p[1]==nome]
            if not iguais: nao_achados+=1
            elif len(iguais)==1: c['p'][iguais[0]][8]=s; atualizados+=1
            else:
                for i in iguais:
                    sid=IDS[k][i] if k in IDS and i<len(IDS[k]) else 0
                    x=bruto.get(str(sid)) if sid else None
                    if x: c['p'][i][8]=x[:4] if x[0]>0 else [0,0,0,0]; atualizados+=1; pelo_id+=1
    print(arq,'| jogadores atualizados:',atualizados,'(nome repetido, resolvido pelo ID:',pelo_id,') | nomes não encontrados:',nao_achados)
# ---- Fotos HD dos jogadores (fotos-ids.json + public/img/players/), pelo mesmo script que roda sozinho ----
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from marcar_fotos_hd import marcar,relatorio
marcar(clubs)

# ---- Correções pontuais de foto e estatísticas (por último, para valer sobre tudo) ----
#   correcoes_jogadores.json: [{k, nome, nascimento, hd, stats}]. O jogador é achado por clube + nome + nascimento,
#   para não confundir dois jogadores de mesmo nome no mesmo clube (ex.: os dois "Danilo" do Botafogo).
CORRECOES='dados-brutos/correcoes_jogadores.json'
if os.path.exists(CORRECOES):
    HD_P=tem('public/img/players')  # de novo: podem ter chegado fotos
    corrigidos=0;faltando=[]
    for it in ler(CORRECOES):
        c=por_k.get(it['k'])
        achados=[p for p in c['p'] if p[1]==it['nome'] and p[3]==it['nascimento']] if c else []
        if len(achados)!=1: faltando.append(f"{it['k']} {it['nome']} {it['nascimento']} ({len(achados)} achados)"); continue
        p=achados[0]
        if it.get('stats') is not None: p[8]=it['stats']
        p[9]=it['hd'] if it.get('hd') in HD_P else 0
        corrigidos+=1
    print(CORRECOES,'| corrigidos:',corrigidos,'| não encontrados:',len(faltando),*faltando)
json.dump({'leagues':leagues,'clubs':clubs,'updated':'20/11/2026'},open('public/data.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(os.path.getsize('public/data.json')//1024,'KB', 'stats' if st else 'no stats')
print('fotos HD:',sum(1 for c in clubs for p in c['p'] if p[9]),'de',sum(len(c['p']) for c in clubs),'| escudos HD:',sum(1 for c in clubs if c['hd']),'de',len(clubs))
relatorio(leagues,clubs)
