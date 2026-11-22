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

// Times criados do zero ("Criar time do zero"): chave separada, para não mexer no formato dos planos.
//   "plantel:times" = { "<k>": { n, sigla, c, c2, modelo, lg, caixa } }, com k começando por "U" (ex.: "U1732212345").
// O plano de cada um fica em "plantel:v2", como o de qualquer clube, com club = "<k>".
const CHAVE_TIMES = "plantel:times";
export function lerTimes() {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE_TIMES));
    return t && typeof t === "object" ? t : {};
  } catch (e) {
    return {};
  }
}
export function salvarTimes(times) {
  try {
    localStorage.setItem(CHAVE_TIMES, JSON.stringify(times));
  } catch (e) {
    // segue sem salvar
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
// Critério do "Escalar sozinho" na aba Time: "v" (valor de mercado, o padrão) ou "o" (overall).
// Chave separada ("plantel:escalar"), também fora dos planos.
const CHAVE_ESCALAR = "plantel:escalar";
export function lerCriterioEscalar() {
  try {
    return localStorage.getItem(CHAVE_ESCALAR) === "o" ? "o" : "v";
  } catch (e) {
    return "v";
  }
}
export function salvarCriterioEscalar(c) {
  try {
    localStorage.setItem(CHAVE_ESCALAR, c);
  } catch (e) {
    // segue sem salvar
  }
}

export function salvarFiltroCaixa(ligado) {
  try {
    localStorage.setItem(CHAVE_CAIXA, ligado ? "1" : "0");
  } catch (e) {
    // segue sem salvar
  }
}
