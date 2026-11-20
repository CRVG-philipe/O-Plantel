// Moeda escolhida e cotação do euro, guardadas no navegador.
//   plantel:moeda    "EUR" | "BRL" | "USD"
//   plantel:cotacao  { BRL, USD, data: "AAAA-MM-DD" }  (a última buscada com sucesso)
import { COTACAO_RESERVA, MOEDAS } from "./dinheiro.js";

const CHAVE_MOEDA = "plantel:moeda";
const CHAVE_COTACAO = "plantel:cotacao";

// API Frankfurter (dados do Banco Central Europeu). Usamos o endereço .dev/v1 porque o antigo
// (api.frankfurter.app) redireciona para cá sem liberar o acesso pelo navegador (CORS).
export const URL_COTACAO = "https://api.frankfurter.dev/v1/latest?from=EUR&to=BRL,USD";

export function lerMoeda() {
  try {
    const m = localStorage.getItem(CHAVE_MOEDA);
    return MOEDAS[m] ? m : "EUR";
  } catch (e) {
    return "EUR";
  }
}

export function salvarMoeda(m) {
  try { localStorage.setItem(CHAVE_MOEDA, m); } catch (e) { /* segue sem salvar */ }
}

const valida = (c) => c && c.BRL > 0 && c.USD > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.data || "");

// Última cotação salva; se não houver, a de reserva
export function lerCotacaoSalva() {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_COTACAO));
    if (valida(c)) return { BRL: c.BRL, USD: c.USD, data: c.data, fonte: "BCE" };
  } catch (e) { /* ignora e usa a reserva */ }
  return COTACAO_RESERVA;
}

// Busca a cotação do dia e guarda no navegador. Se falhar, lança erro (quem chamou mantém a anterior).
export async function buscarCotacao() {
  const r = await fetch(URL_COTACAO);
  if (!r.ok) throw new Error("cotação: resposta " + r.status);
  const j = await r.json();
  const c = { BRL: j?.rates?.BRL, USD: j?.rates?.USD, data: j?.date };
  if (!valida(c)) throw new Error("cotação: resposta inesperada");
  try { localStorage.setItem(CHAVE_COTACAO, JSON.stringify(c)); } catch (e) { /* segue sem salvar */ }
  return { ...c, fonte: "BCE" };
}
