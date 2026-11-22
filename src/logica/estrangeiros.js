// Limite de estrangeiros por liga (public/regras-estrangeiros.json, carregado em D.ESTRANGEIROS).
//
// Formato do arquivo: { padrao: {...}, ligas: { "<liga>": {...} }, ue: ["Alemanha", ...] }. Em cada regra:
//   relacionados  máximo de estrangeiros entre titulares + reservas (aba Time)
//   campo         máximo entre os 11 titulares
//   inscritos     máximo no elenco (só aviso: contratar é livre)
//   tipo          "extracomunitario" = só conta quem não tem nacionalidade de um país da lista "ue"
//   confirmado    false = valor de referência, ainda não conferido em regulamento ("regra aproximada")
//   nota          de onde veio a regra (aparece no aviso)
// Campo ausente ou null = sem limite. Liga fora de "ligas" usa "padrao".
//
// Quem é estrangeiro: a nacionalidade (campo 6 do jogador) é diferente do país da liga (campo "nat" da liga).
// Dupla nacionalidade ("Bolívia/Argentina"): se um dos países é o da liga, não conta. Jogador sem nacionalidade
// (criado pelo usuário) não conta.
import { D } from "./dados.js";
import { elencoAtual, jogador } from "./elenco.js";
import { todosReservas } from "./escalacao.js";
import { norm } from "./formato.js";
import { nacionalidades } from "./nacionalidades.js";

// Os nomes dos países são comparados sem acento, porque o arquivo de regras usa a grafia do Brasil ("Polônia",
// "Romênia") e os jogadores, a de Portugal ("Polónia", "Roménia"). "Tcheca" e "Checa" são o mesmo país.
const APELIDOS_PAIS = { "republica tcheca": "republica checa", tchequia: "republica checa" };
const chavePais = (n) => { const k = norm(String(n || "").trim()); return APELIDOS_PAIS[k] || k; };

let cacheUE = { de: null, set: new Set() };
function paisesUE() {
  const lista = D.ESTRANGEIROS?.ue;
  if (cacheUE.de !== lista) cacheUE = { de: lista, set: new Set((lista || []).map(chavePais)) };
  return cacheUE.set;
}

// Regra da liga, com todos os campos preenchidos (null = sem limite)
export function regraDaLiga(lg) {
  const R = D.ESTRANGEIROS || {};
  const r = R.ligas?.[lg] || R.padrao || {};
  return {
    relacionados: r.relacionados ?? null,
    campo: r.campo ?? null,
    inscritos: r.inscritos ?? null,
    tipo: r.tipo === "extracomunitario" ? "extracomunitario" : "todos",
    confirmado: r.confirmado !== false,
    nota: r.nota || "",
  };
}

// A liga tem algum limite (relacionados, em campo ou inscritos)?
export const temLimite = (regra) => regra.relacionados != null || regra.campo != null || regra.inscritos != null;

// O jogador conta como estrangeiro num clube da liga "lg"?
export function ehEstrangeiro(p, lg) {
  const L = D.LG[lg];
  const nats = nacionalidades(p?.nat).map(chavePais);
  if (!L || !nats.length) return false;
  if (nats.includes(chavePais(L.nat))) return false;
  if (regraDaLiga(lg).tipo === "extracomunitario") {
    const ue = paisesUE();
    if (nats.some((n) => ue.has(n))) return false;
  }
  return true;
}

// Conta os estrangeiros do plano: em campo (titulares), relacionados (titulares + reservas) e no elenco planejado.
// "excede" diz qual limite foi passado.
export function contarEstrangeiros(plano) {
  const lg = D.CL[plano.club].lg, regra = regraDaLiga(lg);
  const est = (id) => ehEstrangeiro(jogador(plano, id), lg);
  const campo = Object.values(plano.xi).filter(est).length;
  const relacionados = campo + todosReservas(plano).filter(est).length;
  const elenco = elencoAtual(plano).filter((p) => ehEstrangeiro(p, lg)).length;
  const passa = (n, lim) => lim != null && n > lim;
  return {
    lg, regra, campo, relacionados, elenco,
    excede: { relacionados: passa(relacionados, regra.relacionados), campo: passa(campo, regra.campo), inscritos: passa(elenco, regra.inscritos) },
  };
}

// Texto da regra para os avisos: "até 9 entre titulares e reservas · CBF, Manual de Competições 2026"
export function textoRegra(regra) {
  const partes = [];
  if (regra.relacionados != null) partes.push(`até ${regra.relacionados} entre titulares e reservas`);
  if (regra.campo != null) partes.push(`até ${regra.campo} em campo`);
  if (regra.inscritos != null) partes.push(`até ${regra.inscritos} inscritos no elenco`);
  let t = partes.length ? partes.join(", ") : "sem limite";
  if (regra.tipo === "extracomunitario") t += " (só contam os de fora da UE)";
  if (regra.nota) t += " · " + regra.nota;
  return t;
}

// Vagas de estrangeiro que sobram (para a lista de escolha de jogadores na aba Time).
// "naVaga" = id de quem está na vaga agora (titular ou reserva): se ele é estrangeiro e for trocado, a vaga dele fica livre.
// titular = true quando a escolha é de titular (aí o limite "em campo" também vale).
export function vagasDeEstrangeiro(plano, { naVaga = null, titular = true } = {}) {
  const c = contarEstrangeiros(plano);
  const sai = naVaga && ehEstrangeiro(jogador(plano, naVaga), c.lg) ? 1 : 0;
  const saiDoCampo = sai && titular && Object.values(plano.xi).includes(naVaga) ? 1 : 0;
  return {
    regra: c.regra,
    relacionados: c.regra.relacionados != null ? c.regra.relacionados - c.relacionados + sai : null,
    campo: titular && c.regra.campo != null ? c.regra.campo - c.campo + saiDoCampo : null,
  };
}
