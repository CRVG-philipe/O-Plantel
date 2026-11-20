import json,os,sys
def ler(f): return json.load(open(f,encoding='utf-8'))
pre=ler('dados-brutos/all_pre.json');local=ler('dados-brutos/local.json');kept=ler('dados-brutos/kept.json')
st=ler('dados-brutos/stats2.json') if os.path.exists('dados-brutos/stats2.json') else None
# Imagens em alta resolução já baixadas (por baixar_imagens.py). Só ganha "hd" quem tem o arquivo.
def tem(pasta): return {int(f[:-5]) for f in os.listdir(pasta) if f.endswith('.webp')} if os.path.isdir(pasta) else set()
HD_P=tem('public/img/players');HD_T=tem('public/img/teams')
LGN={'ENG':['Premier League','Inglaterra','Inglaterra'],'ESP':['LaLiga','Espanha','Espanha'],'ITA':['Serie A','Itália','Itália'],'GER':['Bundesliga','Alemanha','Alemanha'],'FRA':['Ligue 1','França','França'],'BRA':['Brasileirão Série A','Brasil','Brasil'],'BRB':['Brasileirão Série B','Brasil','Brasil'],'ARG':['Liga Argentina','Argentina','Argentina'],'SAU':['Liga Saudita','Arábia Saudita','Arábia Saudita'],'USA':['MLS','EUA e Canadá','Estados Unidos']}
order=['BRA','BRB','ENG','ESP','ITA','GER','FRA','ARG','SAU','USA']
leagues=[{'k':k,'n':LGN[k][0],'pais':LGN[k][1],'nat':LGN[k][2],'season':pre['leagues'][k]['season']} for k in order]
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
json.dump({'leagues':leagues,'clubs':clubs,'updated':'20/11/2026'},open('public/data.json','w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print(os.path.getsize('public/data.json')//1024,'KB', 'stats' if st else 'no stats')
print('fotos HD:',sum(1 for c in clubs for p in c['p'] if p[9]),'de',sum(len(c['p']) for c in clubs),'| escudos HD:',sum(1 for c in clubs if c['hd']),'de',len(clubs))
