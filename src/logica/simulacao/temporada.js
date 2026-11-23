// A temporada simulada do clube do plano: composição da liga, calendário, rodadas, estatísticas e previsão.
//
// Estado salvo (localStorage "plantel:sim" = { "<clube>": estado }; nada vai para o plantel:v2):
//   v                    versão do formato (2; um estado da versão 1 é refeito)
//   semente              semente do sorteio ("Re-simular" troca)
//   rodadaAtual          quantas rodadas já foram jogadas
//   liga                 liga em que o clube joga (pode ser outra, se ele subiu ou caiu)
//   composicao           { lg, clubes, entram, saem, substituido }
//   pendenciasResolvidas { "<id do par>": { modo, movem, detalhe, projecao } }
//   escolhas             { "<id do par>": { modo: "simular"|"escolher", sel: [clubes] } }
//   substitui            time criado do zero: clube que ele substitui na liga (null = o mais fraco)
//   avisos               textos (ex.: "subiu para a Série A")
//   agenda, chaves, grupos  rodadas geradas até agora (com a etapa de cada uma), confrontos dos mata-matas e grupos
//                        (ver formatos.js); as rodadas de cada etapa só existem depois que ela começa
//   atual                projeção da temporada atual da liga do clube: { lg, linhas: [[clube, pontos finais, jogos]] }
//   resultados           [rodada: [[casa, fora, gols casa, gols fora, eventos: [[minuto, lado, autor, assistência]]]]]
//                        (jogos do seu clube: + subs [[minuto, lado, sai, entra]] + cartões [[minuto, lado, id]])
//   estatisticas         { "<id do jogador>": [jogos, gols, assistências, soma das notas × 10, clube] } (todas as competições)
//   estatComp            { "liga"|"<copa>": { mesmo formato } } (por competição)
//   previsao             { "<clube>": { pos, titulo, queda, acesso } } (300 temporadas rápidas)
//   copas                { "<copa>": { part, selo, agenda, chaves, grupos, resultados } } (ver copas.js)
//   finais               finais pendentes de 2026 resolvidas: { "<id>": { modo, vence, vice, placar } }
//   escolhasFinais       { "<id>": clube campeão escolhido } ("Escolher campeão")
//   previsaoCopas        { "<copa>": { "<clube>": chance de título (%) } }
//   dataAtual            quantas "datas" do calendário integrado (rodadas da liga e jogos das copas) já foram jogadas
//   mercadoIA            janela da IA (ver mercadoIA.js): { semente, transf: [[id, clube novo]], resto } ou null
//                        ("Clubes da IA contratam" desligado). resto = a fase 2 (resto do mundo) já entrou na lista.
//   mercadoAtivo         o interruptor "Clubes da IA contratam"; mercadoSemente: semente da janela ("Refazer janela";
//                        null = derivada da semente da temporada)
//   assinatura           "impressão digital" do plano quando a temporada começou (para avisar que o elenco mudou)
import { D } from "../dados.js";
import { FORMS } from "../constantes.js";
import { compatibilidade } from "../compatibilidade.js";
import { misturar, novaSemente, rngDe } from "./aleatorio.js";
import { jogarPartida, sortearPlacar } from "./motor.js";
import { escalarClube, escalarPlano, forcaRapida, idsDoPlano } from "./escalar.js";
import { comporLiga, contextoProjecao, ligaNaTemporada, movimentos, pares, projecaoAtual, resolverPendencias, rotuloLiga, zonasDaLiga } from "./composicao.js";
import { classificacao, confronto, esqueletoDe, fecharRodada, garantirRodada, tabelaDe, tabelasDoSplit, titulos } from "./formatos.js";
import { campeaoCopa, classificarCopas, copasDaLiga, defCopa, esqueletoCopa, fecharRodadaCopa, garantirRodadaCopa, ligasComCopa, nomeCopa, participantesDe, posicoesCopa, resolverFinais } from "./copas.js";
import { elencoDepois, janelaDaTemporada, proibidosDoPlano } from "./mercadoIA.js";
import { narrarJogo, narrarPenaltis } from "./narracao.js";
import { disputarPenaltis, ladoDosPenaltis } from "./penaltis.js";
import { short } from "../formato.js";

export const VERSAO = 5;
export const N_PREVISAO = 300;

// ---------- Salvar ----------
const CHAVE = "plantel:sim";
function lerTudo() {
  try { const x = JSON.parse(localStorage.getItem(CHAVE)); return x && typeof x === "object" ? x : {}; } catch (e) { return {}; }
}
export const lerSim = (k) => { const e = lerTudo()[k]; return e && e.v === VERSAO ? e : null; };
export function salvarSim(k, estado) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ ...lerTudo(), [k]: estado })); } catch (e) { /* sem espaço: segue sem salvar */ }
}
export function apagarSim(k) {
  try { const t = lerTudo(); delete t[k]; localStorage.setItem(CHAVE, JSON.stringify(t)); } catch (e) { /* segue */ }
}

// Velocidade do jogo ao vivo ("1x", "2x", "4x" ou "8x"), guardada à parte em "plantel:velocidade"
export const VELOCIDADES = { "1x": 1000, "2x": 500, "4x": 250, "8x": 110 }; // milissegundos por minuto de jogo
export function lerVelocidade() {
  try { const v = localStorage.getItem("plantel:velocidade"); return VELOCIDADES[v] ? v : "4x"; } catch (e) { return "4x"; }
}
export function salvarVelocidade(v) {
  try { localStorage.setItem("plantel:velocidade", v); } catch (e) { /* segue */ }
}

// "Impressão digital" do plano: elenco planejado, titulares, reservas e formação
export const assinaturaDoPlano = (plano) =>
  String(misturar([...idsDoPlano(plano)].sort().join(","), JSON.stringify(plano.xi || {}), JSON.stringify(plano.res || {}), plano.form || "", D.CL[plano.club]?.lg || ""));

// ---------- Preparar ----------
// Monta a composição: resolve as pendências da liga do clube (e da liga nova, se ele subir ou cair).
// Time criado do zero entra no lugar de um clube da liga escolhida (substitui, ou o mais fraco).
export function prepararTemporada(plano, semente, escolhas = {}, substitui = null, escolhasFinais = {}) {
  const k = plano.club, c = D.CL[k], criado = !!c?.criado, L0 = c.lg;
  const ctx = contextoProjecao(semente, escolhas); // as mesmas tabelas projetadas para a composição e para as copas
  let resolvidas = resolverPendencias([L0], semente, escolhas, ctx);
  let lg = criado ? L0 : ligaNaTemporada(k, resolvidas);
  const avisos = [];
  if (lg === null) {
    avisos.push(`O ${c.n} cai para uma divisão que não está no site. Nesta versão, ele joga a ${rotuloLiga(L0)} mesmo assim.`);
    lg = L0;
  } else if (lg !== L0) {
    resolvidas = resolverPendencias([L0, lg], semente, escolhas, ctx);
    const subiu = D.LG[lg].div < D.LG[L0].div;
    avisos.push(`O ${c.n} ${subiu ? "subiu" : "caiu"} para a ${D.LG[lg].n}: a temporada simulada é a ${rotuloLiga(lg)}.`);
  }
  const composicao = comporLiga(lg, resolvidas);
  if (criado) {
    const fracos = composicao.clubes.map((x) => ({ x, f: escalarClube(x, lg).forca })).sort((a, b) => a.f - b.f);
    const alvo = substitui && composicao.clubes.includes(substitui) ? substitui : fracos[0]?.x;
    composicao.clubes = alvo ? composicao.clubes.map((x) => (x === alvo ? k : x)) : [...composicao.clubes, k];
    composicao.substituido = alvo || null;
  } else if (!composicao.clubes.includes(k)) composicao.clubes.push(k);
  // Tabela real de hoje da liga do clube e como ela termina (a mesma projeção usada nas vagas de acesso/rebaixamento)
  const proj = projecaoAtual(L0, semente, ctx);
  const atual = proj ? { lg: L0, linhas: proj.map((l) => [l.k, l.pts, l.j]) } : null;
  const cop = prepararCopas(lg, composicao, semente, escolhas, ctx, escolhasFinais);
  return { liga: lg, composicao, pendenciasResolvidas: resolvidas, avisos, atual, ...cop };
}

// Copas da liga do clube (copas.json, "por_liga"): finais pendentes de 2026, composição das ligas envolvidas
// (para saber quem caiu e quem joga as copas nacionais) e a classificação de cada copa.
function prepararCopas(lg, composicao, semente, escolhas, ctx, escolhasFinais) {
  const ids = copasDaLiga(lg);
  if (!ids.length) return { copas: {}, finais: {} };
  const ligas = new Set();
  for (const id of ids) {
    const def = defCopa(id);
    if (id === "LIB" || id === "SUD") Object.keys(def.vagas_por_pais || {}).forEach((x) => ligas.add(x));
    if (id === "CDB") ["BRA", "BRB", "BRC"].forEach((x) => ligas.add(x));
    (def.participantes?.ligas || []).forEach((x) => ligas.add(x));
  }
  const resolv = resolverPendencias([...ligas].filter((x) => D.LG[x]), semente, escolhas, ctx);
  const caem = new Set(pares().filter((p) => p.tipo !== "acesso").flatMap((p) => movimentos(p, resolv)));
  const finais = ids.includes("LIB") || ids.includes("SUD") ? resolverFinais(semente, escolhasFinais) : {};
  const part = classificarCopas(ids, {
    tabela: (x) => (D.LG[x] ? ctx.tabela(x) : []),
    clubes2027: (x) => (x === lg ? composicao.clubes : D.LG[x] ? comporLiga(x, resolv).clubes : []),
    rebaixado: (k) => caem.has(k),
    finais,
  });
  const copas = Object.fromEntries(Object.entries(part).map(([id, p]) => [id, { part: p, agenda: [], chaves: {}, grupos: {}, resultados: [] }]));
  return { copas, finais };
}

// Times da temporada: o seu pelo plano; os outros pelo elenco atual (sem quem o seu plano contratou) ou, com a janela
// da IA, pelo elenco depois dela
export function montarTimes(plano, clubes, lg, mercado = null) {
  const fora = idsDoPlano(plano), times = {};
  for (const k of clubes) times[k] = timeDe(plano, k, lg, fora, mercado);
  return times;
}
export const timeDe = (plano, k, lg, fora, mercado) =>
  k === plano.club ? escalarPlano(plano, k) : escalarClube(k, lg, fora, mercado ? elencoDepois(k, mercado) : null);
// Times de todas as competições: os da liga (com a regra de estrangeiros dela) e, sob demanda, os das copas
function timesDoMundo(plano, estado) {
  const m = estado.mercadoIA || null;
  const times = montarTimes(plano, estado.composicao.clubes, estado.liga, m), fora = idsDoPlano(plano);
  const t = (k) => (times[k] ??= timeDe(plano, k, D.CL[k]?.lg, fora, m));
  return { t, forca: (k) => t(k).forca };
}
// Time de um clube na temporada simulada (para o painel do elenco): a liga dele nesta temporada e a janela da IA
export const timeNaTemporada = (estado, plano, k) =>
  timeDe(plano, k, estado.composicao.clubes.includes(k) ? estado.liga : D.CL[k]?.lg, idsDoPlano(plano), estado.mercadoIA || null);

// ---------- Copas e calendário integrado ----------
export const copasDe = (estado) => Object.keys(estado.copas || {}).filter((id) => defCopa(id));
const cacheEsqCopa = new Map();
export function esqCopa(estado, id) {
  const chave = `${estado.semente}|${id}|${JSON.stringify(estado.copas[id].part)}`;
  if (!cacheEsqCopa.has(chave)) { if (cacheEsqCopa.size > 60) cacheEsqCopa.clear(); cacheEsqCopa.set(chave, esqueletoCopa(id, estado.copas[id].part)); }
  return cacheEsqCopa.get(chave);
}
const esqsDe = (estado) => Object.fromEntries(copasDe(estado).map((id) => [id, esqCopa(estado, id)]));
const mundoDe = (estado, copas, forca, esq = esqsDe(estado)) => ({ copas, esq, semente: estado.semente, forca });

// Datas da temporada: as rodadas da liga e as rodadas de cada copa, na ordem do calendário ("calendario" do copas.json:
// 0 = 1ª rodada da liga, 1 = última). Cada data é { c: "liga" | "<copa>", r }.
const cacheDatas = new Map();
export function datasDe(estado) {
  const E = esqueleto(estado), ids = copasDe(estado);
  const chave = `${estado.semente}|${estado.liga}|${E.total}|${ids.map((id) => id + esqCopa(estado, id).total).join(",")}`;
  if (cacheDatas.has(chave)) return cacheDatas.get(chave);
  const itens = Array.from({ length: E.total }, (_, r) => ({ c: "liga", r, p: (r + 0.5) / E.total, o: 0 }));
  ids.forEach((id, oi) => posicoesCopa(esqCopa(estado, id)).forEach((p, r) => itens.push({ c: id, r, p, o: oi + 1 })));
  itens.sort((a, b) => a.p - b.p || a.o - b.o || a.r - b.r);
  const datas = itens.map(({ c, r }) => ({ c, r }));
  if (cacheDatas.size > 40) cacheDatas.clear();
  cacheDatas.set(chave, datas);
  return datas;
}
export const totalDatas = (estado) => datasDe(estado).length;
export const nomeCompeticao = (estado, c) => (c === "liga" ? rotuloLiga(estado.liga) : nomeCopa(c));
export const nomeDaRodadaCopa = (estado, id, r) => esqCopa(estado, id).nomes[r] || `Rodada ${r + 1}`;
// Nome de uma data: "Rodada 12" (liga) ou "Copa do Brasil 2027 · Oitavas (ida)"
export const nomeDaData = (estado, d) => { const x = datasDe(estado)[d]; return !x ? "" : x.c === "liga" ? nomeDaRodada(estado, x.r) : `${nomeCopa(x.c)} · ${nomeDaRodadaCopa(estado, x.c, x.r)}`; };
// Resultados e jogos de uma competição
export const resultadosDe = (estado, c) => (c === "liga" ? estado.resultados : estado.copas[c]?.resultados || []);
const copiaCopas = (estado) => Object.fromEntries(Object.entries(estado.copas || {}).map(([id, x]) => [id, { ...x, agenda: [...x.agenda], chaves: structuredClone(x.chaves), grupos: { ...x.grupos }, resultados: [...x.resultados] }]));
// Jogos de uma rodada de copa (gerados agora, numa cópia, se a fase anterior já acabou); null = ainda sem confrontos
export function jogosDaRodadaCopa(estado, id, r) {
  const c = estado.copas[id];
  if (c.agenda[r]) return c.agenda[r].jogos;
  if (c.resultados.length < r) return null;
  return garantirRodadaCopa(id, r, mundoDe(estado, copiaCopas(estado), forcaRapida));
}
// Jogos de uma data (da liga ou de uma copa)
export const jogosDaData = (estado, d) => { const x = datasDe(estado)[d]; return !x ? null : x.c === "liga" ? jogosDaRodada(estado, x.r) : jogosDaRodadaCopa(estado, x.c, x.r); };
// Próxima data em que o clube joga (olhando só o que já dá para saber): { d, jogo } ou null
export function proximoJogo(estado, k) {
  const datas = datasDe(estado);
  for (let d = estado.dataAtual || 0; d < datas.length; d++) {
    const jogos = jogosDaData(estado, d);
    if (!jogos) return { d, jogo: null };
    const jogo = jogos.find(([a, b]) => a === k || b === k);
    if (jogo) return { d, jogo };
  }
  return null;
}
// Título de cada copa e a chance de título do clube (previsão)
export const campeaoDe = (estado, id) => campeaoCopa(estado.copas[id], esqCopa(estado, id));

// Esqueleto do formato da liga (etapas e rodadas; ver formatos.js), fixo para a semente e os clubes
export const esqueleto = (estado) => esqueletoDe(estado.liga, estado.composicao.clubes, estado.semente);
export const totalRodadas = (estado) => esqueleto(estado).total;
export const nomeDaRodada = (estado, r) => esqueleto(estado).nomes[r] || `Rodada ${r + 1}`;
export const etapaDaRodada = (estado, r) => esqueleto(estado).etapas.find((e) => e.inicio <= r && r < e.inicio + e.rodadas) || null;
export const sorteioDe = (estado) => Object.fromEntries(estado.composicao.clubes.map((k) => [k, misturar(estado.semente, "sorteio", k)]));
// Cópia das partes da temporada que o motor de formatos mexe (para olhar rodadas futuras sem estragar o estado)
const copiaSt = (estado) => ({ agenda: [...(estado.agenda || [])], chaves: structuredClone(estado.chaves || {}), grupos: { ...(estado.grupos || {}) }, resultados: estado.resultados });
// Jogos de uma rodada (já gerada, ou gerada agora se a fase anterior já acabou); null = ainda sem confrontos definidos
export function jogosDaRodada(estado, r) {
  if (estado.agenda?.[r]) return estado.agenda[r].jogos;
  return garantirRodada(copiaSt(estado), esqueleto(estado), r, sorteioDe(estado));
}

// Estado novo (antes da 1ª rodada), já com a previsão (liga e copas)
// semPrevisaoCopas = true: a previsão das copas (a parte mais demorada) fica para depois (a tela calcula logo em seguida)
// mercadoAtivo: "Clubes da IA contratam"; mercadoSemente: semente só da janela ("Refazer janela"; null = a da temporada)
export function criarEstado(plano, { semente = novaSemente(), escolhas = {}, substitui = null, escolhasFinais = {}, semPrevisaoCopas = false,
  mercadoAtivo = true, mercadoSemente = null } = {}) {
  const prep = prepararTemporada(plano, semente, escolhas, substitui, escolhasFinais);
  const estado = {
    v: VERSAO, semente, rodadaAtual: 0, dataAtual: 0, liga: prep.liga, composicao: prep.composicao, pendenciasResolvidas: prep.pendenciasResolvidas,
    escolhas, substitui, escolhasFinais, avisos: prep.avisos, atual: prep.atual, agenda: [], chaves: {}, grupos: {}, resultados: [],
    copas: prep.copas, finais: prep.finais, estatisticas: {}, estatComp: {}, assinatura: assinaturaDoPlano(plano),
    mercadoAtivo: mercadoAtivo !== false, mercadoSemente,
  };
  // Janela da IA (antes da previsão), fase 1: os clubes da IA que jogam a temporada (liga e copas). A fase 2 (o resto do
  // mundo) vem depois, pelo Web Worker (ver completarJanela)
  estado.mercadoIA = estado.mercadoAtivo ? rodarMercado(estado, plano) : null;
  estado.previsao = calcularPrevisao(estado, montarTimes(plano, estado.composicao.clubes, estado.liga, estado.mercadoIA));
  estado.previsaoCopas = semPrevisaoCopas ? null : calcularPrevisaoCopas(estado, plano);
  return estado;
}

// Clubes da IA que jogam a temporada simulada (liga e copas): eles compram na fase 1 da janela
export const clubesDaTemporada = (estado, k) =>
  [...new Set([...estado.composicao.clubes, ...copasDe(estado).flatMap((id) => participantesDe(id, estado.copas[id].part))])].filter((x) => x !== k && D.CL[x] && !D.CL[x].criado);
const sementeDaJanela = (estado) => estado.mercadoSemente ?? misturar(estado.semente, "mercado");

// Janela da IA, fase 1 (mesma semente = mesmas transferências)
export function rodarMercado(estado, plano) {
  const lg = estado.liga, naLiga = new Set(estado.composicao.clubes);
  return janelaDaTemporada({ semente: sementeDaJanela(estado), plano, liga: lg, ativos: clubesDaTemporada(estado, plano.club), ligaDe: (x) => (naLiga.has(x) ? lg : D.CL[x].lg) });
}
// Pedido da fase 2 (o resto do mundo), para janelaDoResto / o Web Worker
export const pedidoDoResto = (estado, plano) => ({
  semente: sementeDaJanela(estado), proibidos: proibidosDoPlano(plano), k0: plano.club, ativos: clubesDaTemporada(estado, plano.club), transf: estado.mercadoIA.transf,
});
// Junta a fase 2 ao estado, se a janela ainda for a mesma do pedido (base = a lista "transf" que foi no pedido)
export function juntarResto(estado, base, novas) {
  const m = estado.mercadoIA;
  if (!m || m.resto || m.transf !== base) return estado;
  return { ...estado, mercadoIA: { ...m, transf: [...m.transf, ...novas], resto: true } };
}

// ---------- Simular ----------
// Joga as datas do calendário integrado (rodadas da liga e jogos das copas) até a data "ate" (sem incluir).
// Cada jogo tem a sua própria semente (semente + competição + rodada + jogo): simular data a data ou tudo de uma vez
// dá o mesmo resultado. Devolve um estado novo.
export function simularDatas(estado, plano, ate) {
  const datas = datasDe(estado), fim = Math.min(ate, datas.length);
  const inicio = estado.dataAtual || 0;
  if (inicio >= fim) return estado;
  const novo = { ...estado, ...copiaSt(estado), resultados: [...estado.resultados], copas: copiaCopas(estado), estatisticas: { ...estado.estatisticas },
    estatComp: Object.fromEntries(Object.entries(estado.estatComp || {}).map(([c, s]) => [c, { ...s }])) };
  const E = esqueleto(estado), mundoT = timesDoMundo(plano, estado);
  const forcaLiga = Object.fromEntries(estado.composicao.clubes.map((k) => [k, mundoT.forca(k)]));
  // Disputa por pênaltis com os titulares de cada time (penaltis.js), com a semente da etapa e do confronto
  const sorteio = sorteioDe(estado);
  const penaltis = (...semente) => (e, i, a, b) => disputarPenaltis(rngDe(...semente, e, i), ladoDosPenaltis(mundoT.t(a)), ladoDosPenaltis(mundoT.t(b)));
  const mundo = mundoDe(estado, novo.copas, forcaRapida);
  const jogar = (c, r, jogos, semente) => jogos.map(([x, y, neutro], i) => {
    const jogo = jogarPartida(rngDe(...semente, i), mundoT.t(x), mundoT.t(y), !!neutro);
    const comp = (novo.estatComp[c] ??= {});
    for (const [id, lado, g, a, nota] of jogo.jogadores) {
      for (const alvo of [novo.estatisticas, comp]) {
        const s = alvo[id] ? [...alvo[id]] : [0, 0, 0, 0, lado ? y : x];
        s[0]++; s[1] += g; s[2] += a; s[3] += Math.round(nota * 10);
        alvo[id] = s;
      }
    }
    // Jogos do seu clube guardam também as substituições e os cartões (para o jogo ao vivo; saves antigos não têm cartões)
    return x === plano.club || y === plano.club ? [x, y, jogo.gc, jogo.gf, jogo.eventos, jogo.subs, jogo.cartoes] : [x, y, jogo.gc, jogo.gf, jogo.eventos];
  });
  for (let d = inicio; d < fim; d++) {
    const { c, r } = datas[d];
    if (c === "liga") {
      const jogos = garantirRodada(novo, E, r, sorteio);
      if (!jogos) break;
      novo.resultados.push(jogar("liga", r, jogos, [estado.semente, r]));
      fecharRodada(novo, E, r, forcaLiga, penaltis(estado.semente, "penaltis"));
      novo.rodadaAtual = r + 1;
    } else {
      const jogos = garantirRodadaCopa(c, r, mundo);
      if (!jogos) break;
      novo.copas[c].resultados.push(jogar(c, r, jogos, [estado.semente, "copa", c, r]));
      fecharRodadaCopa(c, r, mundo, penaltis(estado.semente, "penaltis", c));
    }
    novo.dataAtual = d + 1;
  }
  return novo;
}

// Joga até a rodada "ate" da liga (inclusive as datas de copa que vêm antes dela). ate ≥ total = até o fim de tudo.
export function simularAte(estado, plano, ate) {
  const datas = datasDe(estado), total = esqueleto(estado).total;
  if (ate >= total) return simularDatas(estado, plano, datas.length);
  const d = datas.findIndex((x) => x.c === "liga" && x.r === ate - 1);
  return d < 0 ? estado : simularDatas(estado, plano, d + 1);
}

// Joga data a data até o próximo jogo do clube (inclusive). Devolve { estado, d } (d = data do jogo; null se não houver mais)
export function jogarProximoJogo(estado, plano) {
  const total = totalDatas(estado), k = plano.club;
  let e = estado;
  while ((e.dataAtual || 0) < total) {
    const d = e.dataAtual || 0;
    e = simularDatas(e, plano, d + 1);
    if (e.dataAtual === d) break;
    const x = datasDe(e)[d], jogos = resultadosDe(e, x.c)[x.r] || [];
    if (jogos.some(([a, b]) => a === k || b === k)) return { estado: e, d };
  }
  return { estado: e, d: null };
}

// Classificação principal (anual / split / fase de pontos) e os títulos da temporada
export const tabelaAtual = (estado) => classificacao(estado, esqueleto(estado), sorteioDe(estado));
export const titulosDe = (estado) => titulos(estado, esqueleto(estado), sorteioDe(estado));

// ---------- O que a aba Tabela mostra ----------
// Lista de "vistas" (o seletor de fase): [{ id, nome, blocos }]. Cada bloco é
//   { tipo: "tabela", titulo, linhas, zonas (faixas por linha ou null) } · { tipo: "chave", titulo, fases } · { tipo: "aviso", texto }
export function vistasTabela(estado) {
  const E = esqueleto(estado), st = estado, s = sorteioDe(estado);
  const zonas = zonasDaLiga(estado.liga, estado.composicao.clubes.length);
  // inicio = posição do 1º da tabela na classificação (no split, o grupo de baixo começa no 7º)
  const tab = (titulo, linhas, comZonas = false, inicio = 0) => ({ tipo: "tabela", titulo, linhas, inicio, zonas: comZonas ? zonas.slice(inicio) : null });
  const porGrupos = (etapas, grupos) => grupos.map((g) => tab(g.nome, tabelaDe(st, E, etapas, g.clubes, s)));
  const nomeMata = (id) => E.mata[id].cfg.nome || "Mata-mata";
  const chave = (id) => ({
    tipo: "chave", titulo: nomeMata(id),
    fases: E.mata[id].etapas.map((i) => {
      const e = E.etapas[i], ch = st.chaves[i];
      return { nome: e.curto, idaVolta: e.jogos === "ida_volta", definida: !!ch, confrontos: ch ? ch.pares.map((_, j) => confronto(st, E, e, j)) : [], passam: ch ? ch.passam.map(([k]) => k) : [] };
    }),
  });
  const aguarde = (texto) => ({ tipo: "aviso", texto });
  const cls = classificacao(st, E, s), vistas = [];
  if (E.torneios.length) {
    E.torneios.forEach((t) => {
      const blocos = t.grupos ? porGrupos(t.pontos, t.grupos) : [tab("Classificação", tabelaDe(st, E, t.pontos, null, s))];
      if (t.quad != null) blocos.push(...(st.grupos[t.quad] ? st.grupos[t.quad].map((g) => tab(g.nome, tabelaDe(st, E, [t.quad], g.clubes, s))) : [aguarde("Os quadrangulares saem da tabela ao fim da fase de pontos.")]));
      t.matas.forEach((id) => blocos.push(chave(id)));
      vistas.push({ id: t.id, nome: t.nome, blocos });
    });
    vistas.push({ id: "anual", nome: "Anual", blocos: [tab("Tabela anual (soma dos torneios)", cls, true)] });
    E.liga.matas.forEach((id) => vistas.push({ id: "m" + id, nome: nomeMata(id), blocos: [chave(id)] }));
    return vistas;
  }
  const L = E.liga;
  if (E.partes.length) {
    E.partes.forEach((p, pi) => {
      const blocos = [tab(p.nome, tabelaDe(st, E, [p.etapa], null, s))];
      if (p.mata != null) blocos.push(chave(p.mata));
      vistas.push({ id: "p" + pi, nome: p.nome, blocos });
    });
    vistas.push({ id: "anual", nome: "Anual", blocos: [tab("Tabela anual", cls, true)] });
  } else if (L.grupos) {
    vistas.push({ id: "pontos", nome: "Fase de pontos", blocos: [...porGrupos(L.pontos, L.grupos), tab("Geral", cls, true)] });
  } else {
    const temMais = L.split != null || L.quad != null || L.matas.length > 0;
    vistas.push({ id: "pontos", nome: temMais ? "Fase de pontos" : "Classificação", blocos: [tab(null, L.split != null ? tabelaDe(st, E, L.pontos, null, s) : cls, L.split == null)] });
  }
  if (L.split != null) {
    const gs = tabelasDoSplit(st, E, L.split, s);
    vistas.push({ id: "split", nome: "Split", blocos: gs ? gs.map((g) => tab(g.nome, g.linhas, true, g.de - 1)) : [aguarde("Os grupos do split saem da tabela ao fim da fase de pontos.")] });
  }
  if (L.quad != null) {
    const gs = st.grupos[L.quad];
    vistas.push({ id: "quad", nome: E.etapas[L.quad].fase.nome || "Grupos", blocos: gs ? gs.map((g) => tab(g.nome, tabelaDe(st, E, [L.quad], g.clubes, s))) : [aguarde("Os grupos saem da tabela ao fim da fase de pontos.")] });
  }
  L.matas.filter((id) => !E.partes.some((p) => p.mata === id)).forEach((id) => vistas.push({ id: "m" + id, nome: nomeMata(id), blocos: [chave(id)] }));
  return vistas;
}

// Vista da fase que está acontecendo (a da próxima rodada; no fim, a classificação principal)
export function vistaAtual(estado, vistas) {
  const E = esqueleto(estado), r = estado.rodadaAtual;
  if (r === 0) return vistas[0]?.id;
  if (r >= E.total) return (vistas.find((v) => v.id === "anual") || vistas.find((v) => v.id === "split") || vistas[0])?.id;
  const e = E.etapas.find((x) => x.inicio <= r && r < x.inicio + x.rodadas);
  const ids = vistas.map((v) => v.id);
  const cand = e.tipo === "mata" ? [E.partes.find((p) => p.mata === e.mg) ? "p" + E.partes.findIndex((p) => p.mata === e.mg) : null, e.esc !== "liga" ? e.esc : null, "m" + e.mg]
    : e.tipo === "split" ? ["split"] : e.tipo === "grupos" ? [e.esc !== "liga" ? e.esc : "quad"]
      : [e.parte != null ? "p" + e.parte : null, e.esc !== "liga" ? e.esc : null, "pontos"];
  return cand.find((c) => c && ids.includes(c)) || vistas[0]?.id;
}

// ---------- Jogo ao vivo ----------
// Lance a lance de um jogo já simulado (rodada r, jogo i da competição): ver narracao.js. A semente é própria do jogo
// ("lances"), então o mesmo jogo tem sempre a mesma narração. Devolve { lances, acrescimos, base } ou null.
export function jogoAoVivo(estado, plano, r, i, comp = "liga") {
  const jogo = resultadosDe(estado, comp)[r]?.[i];
  if (!jogo) return null;
  const fora = idsDoPlano(plano);
  const naLiga = (k) => estado.composicao.clubes.includes(k);
  const times = [jogo[0], jogo[1]].map((k) => timeDe(plano, k, naLiga(k) ? estado.liga : D.CL[k]?.lg, fora, estado.mercadoIA || null));
  const rng = comp === "liga" ? rngDe(estado.semente, "lances", r, i) : rngDe(estado.semente, "lances", comp, r, i);
  return narrarJogo(rng, jogo, times, (id) => jogadorSim(plano, id), (k) => nomeClube(k));
}
// Disputa por pênaltis que decidiu o confronto deste jogo (se ele foi o último do confronto e terminou nos pênaltis), do
// ponto de vista do jogo: { placar: [casa, fora], cob: [[lado (0 casa), id, 1|0]], vence } ou null
export function penaltisDoJogo(estado, comp, r, i) {
  const E = comp === "liga" ? esqueleto(estado) : esqCopa(estado, comp);
  const e = E.etapas.find((x) => x.inicio <= r && r < x.inicio + x.rodadas);
  if (!e || (e.tipo !== "mata" && e.tipo !== "ko") || r !== e.inicio + e.rodadas - 1) return null;
  const ch = comp === "liga" ? estado.chaves?.[e.i] : estado.copas?.[comp]?.chaves?.[e.i];
  const pen = ch?.pen?.[i], jogo = resultadosDe(estado, comp)[r]?.[i];
  if (!pen || !jogo) return null;
  const casaEhA = jogo[0] === ch.pares[i][0];
  return {
    placar: casaEhA ? pen.placar : [pen.placar[1], pen.placar[0]],
    cob: pen.cob.map(([l, id, ok]) => [casaEhA ? l : 1 - l, id, ok]),
    vence: ch.vence?.[i] || null,
  };
}
// Lance a lance com a disputa por pênaltis no fim (se houve), para o jogo ao vivo
export function jogoAoVivoCompleto(estado, plano, r, i, comp = "liga") {
  const narr = jogoAoVivo(estado, plano, r, i, comp);
  const pen = narr && penaltisDoJogo(estado, comp, r, i);
  if (!pen) return narr ? { ...narr, pen: null } : null;
  const jogo = resultadosDe(estado, comp)[r][i];
  const rng = rngDe(estado.semente, "lances-pen", comp, r, i);
  const naLiga = (k) => estado.composicao.clubes.includes(k);
  const fora = idsDoPlano(plano);
  const times = [jogo[0], jogo[1]].map((k) => timeDe(plano, k, naLiga(k) ? estado.liga : D.CL[k]?.lg, fora, estado.mercadoIA || null));
  const goleiro = (lado) => { const g = times[lado].onze.find((x) => x.p?.pos === "GOL")?.p; return g ? short(g.n) : "o goleiro"; };
  const fim = narr.lances.find((x) => x.marco === "fim");
  const lances = narr.lances.map((x) => (x === fim ? { ...x, txt: `Fim do tempo normal: ${nomeClube(jogo[0])} ${jogo[2]} × ${jogo[3]} ${nomeClube(jogo[1])}. A decisão vai para os pênaltis!` } : x));
  return { ...narr, lances: [...lances, ...narrarPenaltis(rng, pen, (id) => jogadorSim(plano, id), (k) => nomeClube(k), jogo[0], jogo[1], goleiro)], pen };
}
// Só os lances (sem os marcos de começo, intervalo e fim), em ordem
export const narracao = (estado, plano, r, i, comp = "liga") => (jogoAoVivo(estado, plano, r, i, comp)?.lances || []).filter((x) => x.tipo !== "marco");
// ---------- Previsão ----------
// 300 temporadas rápidas (só placares), com o formato real da liga (fases, split, playoffs, torneios).
// Para cada clube: posição média na classificação, chance de título pela regra "campeao" (nas ligas com dois campeões,
// uma chance por torneio, em "titulos"), risco de cair e chance de subir (pelas faixas).
export function calcularPrevisao(estado, times, n = N_PREVISAO) {
  const clubes = estado.composicao.clubes, E = esqueleto(estado);
  const forca = Object.fromEntries(clubes.map((k) => [k, times[k].forca]));
  const zonas = zonasDaLiga(estado.liga, clubes.length);
  const soma = {}, queda = {}, acesso = {}, tit = {};
  clubes.forEach((k) => { soma[k] = 0; queda[k] = 0; acesso[k] = 0; tit[k] = []; });
  const rng = rngDe(estado.semente, "previsao"), sorte = () => rng();
  let nomes = [];
  for (let s = 0; s < n; s++) {
    const st = { agenda: [], chaves: {}, grupos: {}, resultados: [] };
    const sorteio = Object.fromEntries(clubes.map((k) => [k, rng()]));
    for (let r = 0; r < E.total; r++) {
      const jogos = garantirRodada(st, E, r, sorteio);
      if (!jogos) break;
      st.resultados.push(jogos.map(([c, f, neutro]) => { const [a, b] = sortearPlacar(rng, forca[c], forca[f], !!neutro); return [c, f, a, b]; }));
      fecharRodada(st, E, r, forca, sorte);
    }
    classificacao(st, E, sorteio).forEach((l, i) => {
      soma[l.k] += i + 1;
      if (zonas[i]?.tipo === "queda") queda[l.k]++;
      if (zonas[i]?.tipo === "acesso") acesso[l.k]++;
    });
    const t = titulos(st, E, sorteio).filter((x) => !x.extra);
    nomes = t.map((x) => x.nome);
    t.forEach((x, j) => { if (x.k) tit[x.k][j] = (tit[x.k][j] || 0) + 1; });
  }
  const pct = (x) => Math.round(((x || 0) / n) * 1000) / 10;
  return Object.fromEntries(clubes.map((k) => [k, {
    pos: Math.round((soma[k] / n) * 10) / 10, titulo: pct(tit[k][0]), ...(nomes.length > 1 ? { titulos: nomes.map((nome, j) => ({ nome, pct: pct(tit[k][j]) })) } : {}),
    queda: pct(queda[k]), acesso: pct(acesso[k]), forca: Math.round(forca[k] * 10) / 10,
  }]));
}

// Copas: 300 temporadas rápidas (só placares), na ordem do calendário (a Sul-Americana depende da Libertadores, a Europa
// League da Champions). Devolve { "<copa>": { "<clube>": chance de título em % } }.
export function calcularPrevisaoCopas(estado, plano, n = N_PREVISAO) {
  const ids = copasDe(estado);
  if (!ids.length) return {};
  const datas = datasDe(estado).filter((x) => x.c !== "liga");
  const mundoT = timesDoMundo(plano, estado);
  const fc = {};
  const forcaJogo = (k) => (fc[k] ??= mundoT.forca(k));
  const rng = rngDe(estado.semente, "previsao-copas"), sorte = () => rng();
  const conta = Object.fromEntries(ids.map((id) => [id, {}])), esq = esqsDe(estado);
  for (let s = 0; s < n; s++) {
    const copas = Object.fromEntries(ids.map((id) => [id, { part: estado.copas[id].part, agenda: [], chaves: {}, grupos: {}, resultados: [] }]));
    const mundo = mundoDe(estado, copas, forcaRapida, esq);
    for (const { c, r } of datas) {
      const jogos = garantirRodadaCopa(c, r, mundo);
      if (!jogos) continue;
      copas[c].resultados.push(jogos.map(([x, y, neutro]) => { const [a, b] = sortearPlacar(rng, forcaJogo(x), forcaJogo(y), !!neutro); return [x, y, a, b]; }));
      fecharRodadaCopa(c, r, mundo, sorte);
    }
    for (const id of ids) { const k = campeaoCopa(copas[id], mundo.esq[id]); if (k) conta[id][k] = (conta[id][k] || 0) + 1; }
  }
  return Object.fromEntries(ids.map((id) => [id, Object.fromEntries(Object.entries(conta[id]).map(([k, x]) => [k, Math.round((x / n) * 1000) / 10]))]));
}

// ---------- Estatísticas ----------
// Jogador pelo id (da base ou criado no plano)
export const jogadorSim = (plano, id) => D.BYID[id] || (plano.custom || []).find((c) => c.id === id) || null;
// Linhas de estatística: [{ p, k, j, g, a, nota }]. comp = "total" (todas as competições), "liga" ou o id de uma copa.
const estatDe = (estado, comp) => (comp && comp !== "total" ? estado.estatComp?.[comp] || {} : estado.estatisticas);
export function linhasEstatisticas(estado, plano, comp = "total") {
  return Object.entries(estatDe(estado, comp)).map(([id, [j, g, a, s, k]]) => ({ p: jogadorSim(plano, id), id, k, j, g, a, nota: j ? s / 10 / j : 0 })).filter((x) => x.p);
}
// Mínimo de jogos para entrar em "melhores notas" e na seleção: 30% dos jogos de quem mais jogou
// (com playoffs e copas, nem todo clube joga todas as rodadas)
export const minimoJogos = (estado, comp = "total") => Math.max(1, Math.ceil(Math.max(0, ...Object.values(estatDe(estado, comp)).map((s) => s[0])) * 0.3));

// Seleção da temporada: 4-3-3 com as melhores notas (cada vaga só aceita quem é ideal nela)
export function selecaoDaTemporada(estado, plano) {
  const min = minimoJogos(estado);
  const pool = linhasEstatisticas(estado, plano).filter((x) => x.j >= min).sort((a, b) => b.nota - a.nota || b.g - a.g);
  const usados = new Set();
  return FORMS["4-3-3"].map(([vaga]) => {
    const x = pool.find((y) => !usados.has(y.id) && compatibilidade(vaga, y.p.pos).ordem <= 1);
    if (x) usados.add(x.id);
    return { vaga, x: x || null };
  });
}

// Nome curto do clube na tela
export const nomeClube = (k) => D.CL[k]?.n || k;
