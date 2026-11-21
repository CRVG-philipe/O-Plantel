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

// Filtro "Só quem cabe no caixa" do Mercado: ligado por padrão; guarda só se a pessoa mudar.
// Chave separada ("plantel:caixa", valor "1" ou "0") para não mexer no formato dos planos.
const CHAVE_CAIXA = "plantel:caixa";
export function lerFiltroCaixa() {
  try {
    return localStorage.getItem(CHAVE_CAIXA) !== "0";
  } catch (e) {
    return true;
  }
}
export function salvarFiltroCaixa(ligado) {
  try {
    localStorage.setItem(CHAVE_CAIXA, ligado ? "1" : "0");
  } catch (e) {
    // segue sem salvar
  }
}
