import json,unicodedata,re,datetime as dt
t=json.load(open('raw/tm_new2.json'));s=json.load(open('raw/sofa_new2.json'))
def nz(x): return re.sub(r'[^a-z ]',' ',unicodedata.normalize('NFD',x.lower()).encode('ascii','ignore').decode())
STOP={'fc','cf','ca','club','sc','ac','de','cd','aa','ec','afc','ssc','as','us','rc','sv','vfb','vfl','tsg','fk','sd','ud','rcd','cs','sa','atletico','clube','football','calcio','la','del','y','and','the','ss','acf','bc','ogc','stade','olympique','sk','if','bk','kv','krc','fc','cp','sl','spor','kulubu','fcsb','ik','bv','ksc','rsc','vv','sporting','de','cf','club','real','united','city','town'}
def tk(x): return set(w for w in nz(x).split() if len(w)>1 and w not in STOP)
def d(x):
    try: return dt.date.fromisoformat(x).toordinal()
    except: return None
POS={'Goleiro':'GOL','Zagueiro':'ZAG','Lateral Esq.':'LE','Lateral Dir.':'LD','Volante':'VOL','Meia Central':'MC','Meia Ofensivo':'MEI','Meia Direita':'MD','Meia Esquerda':'ME','Ponta-Esquerda':'PE','Ponta-Direita':'PD','Seg. Atacante':'SA','Centroavante':'CA','Meio-Campo':'MC','Defensores':'ZAG','Atacante':'CA','Defensor':'ZAG'}
by={}
for c in t['clubs']: by.setdefault(c['lg'],[]).append(c)
out=[];miss=[];unk=set();np=0;nm_=0
for st in s['teams']:
    sd=[d(p[2]) for p in st['p'] if d(p[2])];best=None
    for c in by.get(st['lg'],[]):
        if c.get('_u'): continue
        cd=[d(p[4]) for p in c['p'] if d(p[4])]
        ov=sum(1 for x in cd if any(abs(x-y)<=1 for y in sd));nm=len(tk(st['n'])&tk(c['n']))
        sc=ov+nm*4
        if not best or sc>best[0]: best=(sc,c,ov,nm)
    if not best or not (best[2]>=8 or (best[3]>=1 and best[2]>=2)): miss.append((st['lg'],st['n'],best and (best[1]['n'],best[2],best[3]))); continue
    c=best[1];c['_u']=1;sp=st['p'];used=set();sf=[None]*len(c['p'])
    for i,p in enumerate(c['p']):
        pd=d(p[4]);cands=[]
        for j,q in enumerate(sp):
            if j in used: continue
            qd=d(q[2]);dd=abs(pd-qd) if pd and qd else 99
            nm=len(set(nz(p[2]).split())&set(nz(q[1]).split()))+(3 if nz(p[2]).strip()==nz(q[1]).strip() else 0)
            if nm>0 and dd<=4: cands.append((-nm,dd,j))
        if cands: j=min(cands)[2];used.add(j);sf[i]=j
    for i,p in enumerate(c['p']):
        if sf[i] is not None: continue
        pd=d(p[4]);cands=[j for j,q in enumerate(sp) if j not in used and pd and d(q[2]) and abs(pd-d(q[2]))<=1]
        if len(cands)==1: used.add(cands[0]);sf[i]=cands[0]
    for i,p in enumerate(c['p']):
        if sf[i] is not None: continue
        cands=[j for j,q in enumerate(sp) if j not in used and nz(q[1]).strip()==nz(p[2]).strip()]
        if len(cands)==1: used.add(cands[0]);sf[i]=cands[0]
    ps=[]
    for i,p in enumerate(c['p']):
        if p[3] not in POS: unk.add(p[3])
        j=sf[i];np+=1;nm_+=j is not None
        # o último campo guarda o ID Sofascore (para fotos/estatísticas futuras); hd fica 0 até a foto existir
        ps.append([p[1],p[2],POS.get(p[3],'MC'),p[4],p[5],round(p[6],3),p[7],-1,None,0, sp[j][0] if j is not None else 0])
    out.append({'k':'T'+str(st['id']),'lg':st['lg'],'n':st['n'],'coach':st['coach'],'c':st['c'][0] or '#555555','c2':st['c'][1] or '#ffffff','ci':-1,'hd':st['id'],'tm':int(c['id']),'p':ps})
print('teams',len(out),'miss',miss);print('players',np,'matched',nm_,round(nm_/np*100,1),'%');print('unknown pos',unk)
for lg in s['lg']:
    cs=[c for c in out if c['lg']==lg];top=max(cs,key=lambda c:max(p[5] for p in c['p']))
    print(lg,len(cs),sum(len(c['p']) for c in cs),'top',top['n'],max(p[5] for p in top['p']), 'zero',sum(1 for c in cs for p in c['p'] if not p[5]))
json.dump(out,open('raw/new_clubs2.json','w'),ensure_ascii=False,separators=(',',':'))
