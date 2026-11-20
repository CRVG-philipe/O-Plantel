// Salva e lê os planos no navegador (localStorage).
// A chave e o formato são os mesmos da versão antiga, para ninguém perder o que montou:
//   { plans: { "<clube>": plano, ... }, last: "<último clube aberto>" }
const CHAVE = "plantel:v2";

export function lerPlanos() {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(CHAVE)) || {};
  } catch (e) {
    db = {};
  }
  db.plans = db.plans || {};
  return db;
}

export function salvarPlanos(db) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch (e) {
    // navegador sem espaço ou em modo privado: segue sem salvar
  }
}
