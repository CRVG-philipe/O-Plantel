import json,os,sys
pre=json.load(open('dados-brutos/all_pre.json'));local=json.load(open('dados-brutos/local.json'))
st=json.load(open('dados-brutos/stats2.json')) if os.path.exists('dados-brutos/stats2.json') else None
LGN={'ENG':['Premier League','Inglaterra','Inglaterra'],'ESP':['LaLiga','Espanha','Espanha'],'ITA':['Serie A','Itália','Itália'],'GER':['Bundesliga','Alemanha','Alemanha'],'FRA':['Ligue 1','França','França'],'BRA':['Brasileirão Série A','Brasil','Brasil'],'BRB':['Brasileirão Série B','Brasil','Brasil'],'ARG':['Liga Argentina','Argentina','Argentina'],'SAU':['Liga Saudita','Arábia Saudita','Arábia Saudita'],'USA':['MLS','EUA e Canadá','Estados Unidos']}
order=['BRA','BRB','ENG','ESP','ITA','GER','FRA','ARG','SAU','USA']
leagues=[{'k':k,'n':LGN[k][0],'pais':LGN[k][1],'nat':LGN[k][2],'season':pre['leagues'][k]['season']} for k in order]
clubs=[]
for ci,c in enumerate(pre['clubs']):
    ps=[]
    for p in c['p']:
        g=p[7];sp=local.get(str(g),-1) if g>=0 else -1
        s=None
        if st is not None and g>=0:
            x=st[g]
            if x and x[0]>0: s=x[:4]
            elif x and x[0]==0: s=[0,0,0,0]
        ps.append([p[0],p[1],p[2],p[3],p[4],p[5],p[6],sp,s])
    clubs.append({'k':c['k'],'lg':c['lg'],'n':c['n'],'coach':c['coach'],'c':c['c'],'c2':c['c2'],'ci':ci,'p':ps})
json.dump({'leagues':leagues,'clubs':clubs,'updated':'20/11/2026'},open('site/data.json','w'),ensure_ascii=False,separators=(',',':'))
print(os.path.getsize('site/data.json')//1024,'KB', 'stats' if st else 'no stats')
