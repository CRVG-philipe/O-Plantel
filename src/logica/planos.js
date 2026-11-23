// Vários planos do mesmo clube (23/11/2026). "plantel:v2" continua { plans: { <id>: plano }, last: <id> }:
//   o 1º plano de cada clube tem id = chave do clube (como sempre foi: planos antigos continuam iguais);
//   os outros têm id "<clube>~2", "<clube>~3"... O plano em si não muda (club, budget, st, ins, form, xi, custom...);
//   campo opcional novo: nome ("Plano 2", "Sem o Arrascaeta"...). Sem nome, aparece "Plano N" (N do id).
export const numeroDoId = (id) => { const m = /~(\d+)$/.exec(String(id)); return m ? +m[1] : 1; };

// Planos de um clube: [[id, plano], ...], na ordem (Plano 1, Plano 2...)
export const planosDoClube = (db, k) =>
  Object.entries(db.plans || {}).filter(([, p]) => p && p.club === k).sort((a, b) => numeroDoId(a[0]) - numeroDoId(b[0]));

// Próximo id livre para um plano novo do clube (o próprio clube, se ainda não tem plano)
export function novoIdDePlano(db, k) {
  if (!db.plans?.[k]) return k;
  for (let n = 2; ; n++) if (!db.plans[`${k}~${n}`]) return `${k}~${n}`;
}

export const nomeDoPlano = (id, p) => (p?.nome && p.nome.trim()) || `Plano ${numeroDoId(id)}`;

// Qual plano abrir ao escolher um clube: o último aberto, se for dele; senão o 1º; null se não tem nenhum
export function idParaAbrir(db, k) {
  const l = planosDoClube(db, k);
  if (!l.length) return null;
  return l.some(([id]) => id === db.last) ? db.last : l[0][0];
}
