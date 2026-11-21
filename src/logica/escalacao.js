// Regras do time titular e dos reservas. Estas funções ALTERAM o plano recebido
// (por isso o app sempre passa uma cópia do plano para elas).
//
// Reservas: campo novo do plano, "res" = { "<índice da vaga>": [id do 1º reserva, id do 2º reserva] }.
// Planos antigos não têm o campo (tudo funciona sem ele). Regras:
//   - até 2 reservas por vaga (banco de até 22);
//   - ninguém é titular e reserva ao mesmo tempo, nem reserva de duas vagas;
//   - só quem está no elenco planejado (não vale emprestado fora, vendido, liberado ou devolvido).
import { FORMS, ORDER } from "./constantes.js";
import { compatibilidade } from "./compatibilidade.js";
import { elencoAtual, jogador } from "./elenco.js";

export const MAX_RESERVAS = 2;

// Passadas para preencher vagas: posição principal → outras ideais → boa → improvisado da tabela
const PASSADAS = [0, 1, 2, 3];
// Quantas posições servem bem (ideal ou boa) numa vaga: vagas mais difíceis são preenchidas primeiro
const opcoesBoas = (vaga) => ORDER.filter((pos) => compatibilidade(vaga, pos).ordem <= 2).length;

// Critérios do "Escalar sozinho": "v" = maior valor de mercado (desempate: overall);
// "o" = maior overall (desempate: valor; quem não tem overall, como jogador criado, fica por último)
export const CRITERIOS = { v: "valor de mercado", o: "overall" };
const COMPARAR = {
  v: (a, b) => b.v - a.v || (b.ovr ?? 0) - (a.ovr ?? 0),
  o: (a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || b.v - a.v,
};

// Em qual passada o jogador entra na vaga: a "ordem" de compatibilidade, com uma exceção no meio-campo.
// VOL ↔ MC e MEI ↔ MC disputam a vaga de igual para igual com o dono da posição (passada 0):
// ganha quem tiver mais valor (ou overall). Nas outras vagas, a posição de origem vem primeiro.
const MEIO = { VOL: ["MC"], MC: ["VOL", "MEI"], MEI: ["MC"] };
export const passada = (vaga, pos) => (MEIO[vaga]?.includes(pos) ? 0 : compatibilidade(vaga, pos).ordem);

// O melhor (pelo critério) que serve na vaga nessa passada
function melhorPara(sq, usados, vaga, ordem, criterio = "v") {
  return sq.filter((p) => !usados.has(p.id) && passada(vaga, p.pos) === ordem).sort(COMPARAR[criterio] || COMPARAR.v)[0];
}

// Monta o time do zero: em cada vaga, o melhor jogador que serve (pelo valor ou pelo overall), do mais compatível
// para o menos. Começa pelas vagas mais difíceis de preencher. Não escala ninguém fora da tabela de compatibilidade.
export function escalarSozinho(plano, criterio = "v") {
  const sq = elencoAtual(plano), usados = new Set(), sl = FORMS[plano.form];
  plano.xi = {};
  const ord = sl.map((s, i) => i).sort((a, b) => opcoesBoas(sl[a][0]) - opcoesBoas(sl[b][0]));
  for (const ordem of PASSADAS)
    for (const i of ord) {
      if (plano.xi[i]) continue;
      const c = melhorPara(sq, usados, sl[i][0], ordem, criterio);
      if (c) { plano.xi[i] = c.id; usados.add(c.id); }
    }
  arrumarPosicoes(plano);
}

// Com os 11 já escolhidos, troca dois titulares de vaga quando os dois ficam mais perto da posição de origem
// (ex.: VOL escalado na vaga de MC e MC na de VOL → cada um volta para a sua). Ninguém entra nem sai do time.
function arrumarPosicoes(plano) {
  const sl = FORMS[plano.form], ord = (i, id) => compatibilidade(sl[i][0], jogador(plano, id).pos).ordem;
  for (let mudou = true, voltas = 0; mudou && voltas < 20; voltas++) {
    mudou = false;
    for (const i in plano.xi)
      for (const j in plano.xi) {
        const a = plano.xi[i], b = plano.xi[j];
        if (+i < +j && ord(i, b) + ord(j, a) < ord(i, a) + ord(j, b)) { plano.xi[i] = b; plano.xi[j] = a; mudou = true; }
      }
  }
}

// Se alguém do time saiu do elenco (vendido, por exemplo), tira ele e preenche o buraco.
// Também arruma os reservas (ver limparReservas).
export function completarTime(plano) {
  const sq = elencoAtual(plano), ids = new Set(sq.map((p) => p.id));
  let saiu = false;
  for (const i in plano.xi) if (!ids.has(plano.xi[i])) { delete plano.xi[i]; saiu = true; }
  if (saiu) {
    const usados = new Set([...Object.values(plano.xi), ...todosReservas(plano)]), sl = FORMS[plano.form];
    for (const ordem of PASSADAS)
      sl.forEach(([r], i) => {
        if (plano.xi[i]) return;
        const c = melhorPara(sq, usados, r, ordem);
        if (c) { plano.xi[i] = c.id; usados.add(c.id); }
      });
  }
  limparReservas(plano);
}

// Quando alguém é contratado: entra numa vaga vazia em que seja "ideal",
// ou no lugar do titular menos valioso dessas vagas (se valer mais que ele).
export function encaixarNoTime(plano, p) {
  const sl = FORMS[plano.form];
  let w = null;
  sl.forEach(([r], j) => {
    if (compatibilidade(r, p.pos).nivel !== "ideal") return;
    const c = plano.xi[j] && jogador(plano, plano.xi[j]);
    if (!c) { if (w === null || plano.xi[w]) w = j; return; }
    if (c.v < p.v && (w === null || (plano.xi[w] && jogador(plano, plano.xi[w]).v > c.v))) w = j;
  });
  if (w !== null) plano.xi[w] = p.id;
}

// ---------- Força do time ----------
// Média de overall dos titulares (só conta quem tem overall). Devolve { media (1 casa), n } ou null sem ninguém.
export function forcaDoTime(plano) {
  const ovrs = Object.values(plano.xi).map((id) => jogador(plano, id)?.ovr).filter((o) => o != null);
  if (!ovrs.length) return null;
  return { media: Math.round((ovrs.reduce((s, o) => s + o, 0) / ovrs.length) * 10) / 10, n: ovrs.length };
}

// Força "antes do plano": o elenco original (sem vendas, contratações nem empréstimos mexidos),
// escalado sozinho na mesma formação do plano (e pelo mesmo critério, para a comparação ser justa)
export function forcaAntes(plano, criterio = "v") {
  const P = { club: plano.club, budget: plano.budget, st: {}, ins: [], form: plano.form, xi: {}, custom: [] };
  escalarSozinho(P, criterio);
  return forcaDoTime(P);
}

// ---------- Reservas ----------
export const reservasDa = (plano, i) => (plano.res || {})[i] || [];
export const todosReservas = (plano) => Object.values(plano.res || {}).flat();
export const totalReservas = (plano) => todosReservas(plano).length;

// Dá para pôr este jogador como reserva desta vaga? Devolve o motivo se não der (ou null se der).
export function motivoSemReserva(plano, i, id) {
  if (reservasDa(plano, i).length >= MAX_RESERVAS) return "A vaga já tem 2 reservas.";
  if (Object.values(plano.xi).includes(id)) return "Já é titular.";
  if (todosReservas(plano).includes(id)) return "Já é reserva de outra vaga.";
  if (!elencoAtual(plano).some((p) => p.id === id)) return "Não está no elenco planejado.";
  return null;
}

// Põe um reserva na vaga (se as regras deixarem). Devolve true se entrou.
export function adicionarReserva(plano, i, id) {
  if (motivoSemReserva(plano, i, id)) return false;
  plano.res = plano.res || {};
  plano.res[i] = [...reservasDa(plano, i), id];
  return true;
}

export function removerReserva(plano, id) {
  for (const k in plano.res || {}) {
    plano.res[k] = plano.res[k].filter((x) => x !== id);
    if (!plano.res[k].length) delete plano.res[k];
  }
}

// Troca titular ↔ reserva: o reserva vira titular da vaga e o titular toma o lugar dele no banco
export function promover(plano, i, id) {
  const lista = reservasDa(plano, i), titular = plano.xi[i];
  const k = lista.indexOf(id);
  if (k < 0) return;
  const nova = [...lista];
  if (titular) nova[k] = titular; else nova.splice(k, 1);
  plano.xi[i] = id;
  plano.res[i] = nova;
  if (!nova.length) delete plano.res[i];
}

// Troca os titulares das vagas i e j de lugar. Se uma das vagas está vazia, o outro só muda de vaga.
export function trocarTitulares(plano, i, j) {
  if (i === j) return;
  const a = plano.xi[i], b = plano.xi[j];
  if (b) plano.xi[i] = b; else delete plano.xi[i];
  if (a) plano.xi[j] = a; else delete plano.xi[j];
}

// Troca o titular da vaga i com um reserva (de qualquer vaga): o reserva vira titular da vaga i e o titular
// fica no lugar dele no banco. Devolve false se o id não é reserva.
export function trocarComReserva(plano, i, id) {
  for (const k in plano.res || {}) {
    const pos = plano.res[k].indexOf(id);
    if (pos < 0) continue;
    const titular = plano.xi[i];
    plano.xi[i] = id;
    if (titular) plano.res[k][pos] = titular;
    else { plano.res[k].splice(pos, 1); if (!plano.res[k].length) delete plano.res[k]; }
    return true;
  }
  return false;
}

// Ao trocar de formação: cada vaga que continua existindo (mesma posição, na mesma ordem: 2º ZAG → 2º ZAG)
// leva seus reservas; os das vagas que sumiram ficam livres.
export function moverReservas(plano, formAntiga, formNova) {
  if (!plano.res) return;
  const antes = FORMS[formAntiga], depois = FORMS[formNova];
  const ocorrencia = (vagas, i) => vagas.slice(0, i).filter((v) => v[0] === vagas[i][0]).length;
  const novo = {};
  for (const k in plano.res) {
    const i = +k;
    if (!antes[i]) continue;
    const j = depois.findIndex((v, jj) => v[0] === antes[i][0] && ocorrencia(depois, jj) === ocorrencia(antes, i));
    if (j >= 0) novo[j] = plano.res[k];
  }
  plano.res = novo;
}

// Arruma os reservas depois de qualquer mudança: tira quem saiu do elenco, quem virou titular,
// quem está repetido, vagas que não existem na formação e o que passar de 2 por vaga.
export function limparReservas(plano) {
  if (!plano.res) return;
  const noElenco = new Set(elencoAtual(plano).map((p) => p.id));
  const titulares = new Set(Object.values(plano.xi));
  const vistos = new Set(), n = FORMS[plano.form].length;
  for (const k of Object.keys(plano.res).sort((a, b) => a - b)) {
    const lista = +k < n ? plano.res[k].filter((id) => noElenco.has(id) && !titulares.has(id) && !vistos.has(id)).slice(0, MAX_RESERVAS) : [];
    lista.forEach((id) => vistos.add(id));
    if (lista.length) plano.res[k] = lista; else delete plano.res[k];
  }
}
