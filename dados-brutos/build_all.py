import json,unicodedata,re,datetime as dt,base64
import os
VAL=json.load(open('dados-brutos/val.json')) if os.path.exists('dados-brutos/val.json') else {}
t=json.load(open('dados-brutos/tm_all.json'));s=json.load(open('dados-brutos/sofa_all.json'));extra=json.load(open('dados-brutos/tm_extra.json'))
clubs=t['clubs']+extra
def nz(x): return re.sub(r'[^a-z ]',' ',unicodedata.normalize('NFD',x.lower()).encode('ascii','ignore').decode())
STOP={'fc','cf','ca','club','sc','ac','de','cd','aa','ec','afc','ssc','as','us','rc','sv','vfb','vfl','tsg','fk','sd','ud','rcd','cs','sa','atletico','clube','futebol','esporte','esportes','regatas','football','calcio','la','del','y','and','the','fbpa','ss','acf','bc','ogc','losc','stade','olympique'}
def tk(x): return set(w for w in nz(x).split() if len(w)>1 and w not in STOP)
def d(x):
    try: return dt.date.fromisoformat(x).toordinal()
    except: return None
POS={'Goleiro':'GOL','Zagueiro':'ZAG','Lateral Esq.':'LE','Lateral Dir.':'LD','Volante':'VOL','Meia Central':'MC','Meia Ofensivo':'MEI','Meia Direita':'MD','Meia Esquerda':'ME','Ponta-Esquerda':'PE','Ponta-Direita':'PD','Seg. Atacante':'SA','Centroavante':'CA','Meio-Campo':'MC','Defensores':'ZAG'}
by_lg={}
for c in clubs: by_lg.setdefault(c['lg'],[]).append(c)
out=[];mask=[];kept=[];usedc=set();miss_team=[]
for st in s['teams']:
    sd=[d(p[2]) for p in st['p'] if d(p[2])]
    best=None
    for c in by_lg.get(st['lg'],[]):
        if c['id'] in usedc: continue
        cd=[d(p[4]) for p in c['p'] if d(p[4])]
        ov=sum(1 for x in cd if any(abs(x-y)<=1 for y in sd))
        nm=len(tk(st['n'])&tk(c['n']))
        sc=ov+nm*4
        if not best or sc>best[0]: best=(sc,c,ov,nm)
    if not best or not (best[2]>=8 or (best[3]>=1 and best[2]>=2)):
        miss_team.append(st['n']); mask+= [0]*len(st['p']); continue
    c=best[1];usedc.add(c['id'])
    sp=st['p'];usedp=set();sofa_for=[None]*len(c['p'])
    # pass1 name+date
    for i,p in enumerate(c['p']):
        pd=d(p[4]);cands=[]
        for j,q in enumerate(sp):
            if j in usedp: continue
            qd=d(q[2]);dd=abs(pd-qd) if pd and qd else 99
            nm=len(set(nz(p[2]).split())&set(nz(q[1]).split()))+(3 if nz(p[2]).strip()==nz(q[1]).strip() else 0)
            if nm>0 and dd<=4: cands.append((-nm,dd,j))
        if cands: j=min(cands)[2];usedp.add(j);sofa_for[i]=j
    for i,p in enumerate(c['p']):
        if sofa_for[i] is not None: continue
        pd=d(p[4]);cands=[j for j,q in enumerate(sp) if j not in usedp and pd and d(q[2]) and abs(pd-d(q[2]))<=1]
        if len(cands)==1: usedp.add(cands[0]);sofa_for[i]=cands[0]
    # pass3: exact name only
    for i,p in enumerate(c['p']):
        if sofa_for[i] is not None: continue
        cands=[j for j,q in enumerate(sp) if j not in usedp and nz(q[1]).strip()==nz(p[2]).strip()]
        if len(cands)==1: usedp.add(cands[0]);sofa_for[i]=cands[0]
    keepidx={j:k for k,j in enumerate(sorted(usedp))}
    mask+=[1 if j in usedp else 0 for j in range(len(sp))]
    base=len(kept); kept+= [sp[j][0] for j in sorted(usedp)]
    ps=[]
    for i,p in enumerate(c['p']):
        j=sofa_for[i]
        ps.append([p[1],p[2],POS.get(p[3],'MC'),p[4],p[5],(VAL[p[0]]/1000 if p[0] in VAL else round(p[6],3)),p[7], (base+keepidx[j]) if j is not None else -1])
    out.append({'k':'T'+str(st['id']),'sid':st['id'],'tm':c['id'],'lg':st['lg'],'n':st['n'],'coach':st['coach'],'c':st['c'][0] or '#555555','c2':st['c'][1] or '#ffffff','p':ps})
print('teams',len(out),'missing',miss_team)
print('players',sum(len(c['p']) for c in out),'with sofa',sum(1 for c in out for p in c['p'] if p[7]>=0),'kept',len(kept),'mask',len(mask))
bits=bytearray((len(mask)+7)//8)
for i,b in enumerate(mask):
    if b: bits[i//8]|=1<<(i%8)
open('dados-brutos/mask.b64','w').write(base64.b64encode(bytes(bits)).decode())
json.dump({'leagues':s['lg'],'clubs':out},open('dados-brutos/all_pre.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(kept,open('dados-brutos/kept.json','w'))
