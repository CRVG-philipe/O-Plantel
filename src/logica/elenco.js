// Regras do elenco: quem fica, quem sai, quem chega, alertas e o texto do resumo.
//
// Um "plano" tem este formato (igual ao que já está salvo no navegador):
//   club    chave do clube ("T42")
//   budget  orçamento inicial em € mi (null = ainda não definido)
//   st      situação de quem sai: { "<id>": { s: "vende"|"empresta"|"libera", fee } }
//   ins     chegadas: [{ id, type: "compra"|"emprestimo"|"livre", fee }]
//   form    formação ("4-3-3")
//   xi      time titular: { "<vaga>": "<id do jogador>" }
//   custom  jogadores criados pelo usuário
//   emp     (campo novo, pode faltar em planos antigos) escolhas sobre empréstimos:
//           { "<id>": { s: "devolver"|"comprar"|"vender"|"voltar", fee } }; sem escolha = continua emprestado.
//           Recebidos por empréstimo: devolver (sai, sem dinheiro) ou comprar (paga o valor, fica).
//           Emprestados a outros clubes: vender (entra o valor) ou voltar (volta ao elenco e conta em tudo).
import { D } from "./dados.js";
import { FORMS, NEED } from "./constantes.js";
import { short } from "./formato.js";
import { dinheiro, calcularDinheiro } from "./dinheiro.js";

export function novoPlano(k) {
  return { club: k, budget: null, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] };
}

// Acha um jogador pelo id: da base de dados ou criado pelo usuário
export function jogador(plano, id) {
  return D.BYID[id] || plano.custom.find((c) => c.id === id);
}

// Situação de um jogador do clube ("fica" se não foi mexido)
export const situacao = (plano, id) => plano.st[id] || { s: "fica" };

// ---------- Empréstimos ----------
// Escolha sobre um empréstimo ("manter" se não foi mexido). Planos antigos não têm o campo "emp".
export const situacaoEmp = (plano, id) => (plano.emp || {})[id] || { s: "manter" };
// Recebido por empréstimo: está no elenco do clube, mas o dono é outro
export const recebido = (plano, p) => !!(p && p.emp && p.club === plano.club && p.emp.de.k !== plano.club);
// Emprestados a outros clubes: [{ p, para: {k, n}, ate, contrato }]
export const emprestadosFora = (plano) =>
  (D.EMP[plano.club]?.out || []).map((o) => ({ ...o, p: D.BYID[o.id] })).filter((o) => o.p);
// Ids dos emprestados a outros clubes (para saber qual painel abrir)
export const ehEmprestadoFora = (plano, id) => (D.EMP[plano.club]?.out || []).some((o) => o.id === id);
// Listas para o resumo e o topo
const comEscolha = (plano, s) => Object.entries(plano.emp || {}).filter(([, x]) => x.s === s).map(([id, x]) => ({ p: D.BYID[id], x })).filter((m) => m.p);
export const voltam = (plano) => comEscolha(plano, "voltar");
export const devolvidos = (plano) => comEscolha(plano, "devolver");
export const comprados = (plano) => comEscolha(plano, "comprar");
export const vendidosFora = (plano) => comEscolha(plano, "vender");

// Elenco original do clube (antes de qualquer mudança)
export const elencoOriginal = (plano) => D.ALL.filter((p) => p.club === plano.club);

// Elenco planejado: quem fica (sem os recebidos devolvidos) + quem chega + quem volta de empréstimo.
// Quem está emprestado a outro clube não conta (nem no total, nem na idade, nem na escalação), a menos que volte.
export function elencoAtual(plano) {
  return D.ALL.filter((p) => p.club === plano.club && situacao(plano, p.id).s === "fica" && situacaoEmp(plano, p.id).s !== "devolver")
    .concat(plano.ins.map((m) => jogador(plano, m.id)))
    .concat(voltam(plano).map((m) => m.p));
}

// Quem sai: [{ p: jogador, x: { s, fee } }]
export function saidas(plano) {
  return Object.entries(plano.st).filter(([, x]) => x.s !== "fica").map(([id, x]) => ({ p: D.BYID[id], x }));
}

// Contagem do card "chegam · saem" do topo
export const nChegam = (plano) => plano.ins.length + voltam(plano).length;
export const nSaem = (plano) => saidas(plano).length + devolvidos(plano).length + vendidosFora(plano).length;

// Pontos de atenção da aba Resumo
export function alertas(plano) {
  const m = calcularDinheiro(plano), sq = elencoAtual(plano), a = [];
  const L = D.LG[D.CL[plano.club].lg];
  if (m.caixa < 0) a.push(`O caixa está negativo em ${dinheiro(-m.caixa)}.`);
  NEED.forEach(([l, ps, min]) => {
    const n = sq.filter((p) => ps.includes(p.pos)).length;
    if (n < min) a.push(`${l}: ${n} no elenco, o recomendado é ${min}.`);
  });
  const e = sq.filter((p) => p.end26 && p.club === plano.club).length;
  if (e) a.push(`${e} ${e > 1 ? "jogadores que ficam têm" : "jogador que fica tem"} contrato acabando antes de ${L.plan}.`);
  const vazias = FORMS[plano.form].filter((s, i) => !plano.xi[i]).length;
  if (vazias) a.push(`${vazias} ${vazias > 1 ? "posições do time titular estão vazias" : "posição do time titular está vazia"}.`);
  return a;
}

// Texto do botão "Copiar resumo"
export function textoDoPlano(plano) {
  const c = D.CL[plano.club], m = calcularDinheiro(plano), o = saidas(plano);
  const xi = FORMS[plano.form].map((s, i) => (plano.xi[i] ? short(jogador(plano, plano.xi[i]).n) : "?"));
  const chegam = plano.ins.map((mv) => {
    const p = jogador(plano, mv.id);
    return "+ " + p.n + " (" + p.pos + ") " + (mv.type === "emprestimo" ? "empréstimo" : mv.fee ? dinheiro(mv.fee) : "grátis");
  }).concat(voltam(plano).map(({ p }) => "+ " + p.n + " (" + p.pos + ") volta de empréstimo"))
    .concat(comprados(plano).map(({ p, x }) => "= " + p.n + " (" + p.pos + ") comprado " + dinheiro(+x.fee || 0)))
    .join("\n") || "ninguém";
  const saem = o.map(({ p, x }) => "− " + p.n + " (" + { vende: "venda " + dinheiro(+x.fee || 0), empresta: "empréstimo", libera: "liberado" }[x.s] + ")")
    .concat(devolvidos(plano).map(({ p }) => "− " + p.n + " (devolvido ao " + p.emp.de.n + ")"))
    .concat(vendidosFora(plano).map(({ p, x }) => "− " + p.n + " (venda " + dinheiro(+x.fee || 0) + ", estava emprestado)"))
    .join("\n") || "ninguém";
  return `${c.n} ${D.LG[c.lg].plan} (planejado no Plantel)\nOrçamento ${dinheiro(plano.budget || 0)} · caixa final ${dinheiro(m.caixa)}\n\nCHEGAM\n${chegam}\n\nSAEM\n${saem}\n\nTIME (${plano.form})\n${xi[0]}; ${xi.slice(1, 5).join(", ")}; ${xi.slice(5).join(", ")}`;
}
