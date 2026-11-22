import json,collections
O=json.load(open('raw/overall_r3_v1.json'));lg={x[0]:x[1] for x in json.load(open('raw/players_r3.json'))}
ALVO={'ARG2':62,'BOL':60,'VEN':61,'COL2':58,'PER2':56,'CHI2':58,'EGY':64,'MAR':64,'RSA':63,'AUS':63,'ISR':64,'HUN':64,'SVK':62,'BUL':63,'CYP':64,'SVN':61,'CAN':57,'CRC':60,'HON':58,'USL':61}
def avg(L,a):
  t=[]
  for k,d in O.items():
    if lg[k]!=L: continue
    v=sorted([x[0]+a for x in d.values()],reverse=True);t.append(sum(v[:11])/11)
  return sum(t)/len(t)
shift={}
for L,t in ALVO.items():
  best=min([i/4 for i in range(-24,25)],key=lambda a:abs(avg(L,a)-t));shift[L]=best
out={k:{nm:[max(40,min(92,round(v[0]+shift[lg[k]]))),0,v[2]] for nm,v in d.items()} for k,d in O.items()}
json.dump(out,open('raw/overall_r3.json','w'),ensure_ascii=False,separators=(',',':'))
print(shift)
