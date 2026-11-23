// A temporada simulada do clube do plano: composição da liga, calendário, rodadas, estatísticas e previsão.
//
// Estado salvo (localStorage "plantel:sim" = { "<clube>": estado }; nada vai para o plantel:v2):
//   v                    versão do formato (1)
//   semente              semente do sorteio ("Re-simular" troca)
//   rodadaAtual          quantas rodadas já foram jogadas
//   liga                 liga em que o clube joga (pode ser outra, se ele subiu ou caiu)
//   composicao           { lg, clubes, entram, saem, substituido }
//   pendenciasResolvidas { "<id do par>": { modo, movem, detalhe, projecao } }
//   escolhas             { "<id do par>": { modo: "simular"|"escolher", sel: [clubes] } }
//   substitui            time criado do zero: clube que ele substitui na liga (null = o mais fraco)
//   avisos               textos (ex.: "subiu para a Série A")
//   resultados           [rodada: [[casa, fora, gols casa, gols fora, eventos: [[minuto, lado, autor, assistência]]]]]
//   estatisticas         { "<id do jogador>": [jogos, gols, assistências, soma das notas × 10, clube] }
//   previsao             { "<clube>": { pos, titulo, queda, acesso } } (300 temporadas rápidas)
//   assinatura           "impressão digital" do plano quando a temporada começou (para avisar que o elenco mudou)
import { D } from "../dados.js";
import { FORMS } from "../constantes.js";
import { compatibilidade } from "../compatibilidade.js";
import { embaralhar, misturar, novaSemente, rngDe } from "./aleatorio.js";
import { gerarCalendario } from "./calendario.js";
import { jogarPartida } from "./motor.js";
import { escalarClube, escalarPlano, idsDoPlano } from "./escalar.js";
import { comporLiga, ligaNaTemporada, resolverPendencias, rotuloLiga, zonasDaLiga } from "./composicao.js";
import { tabelaDosResultados, temporadaRapida } from "./tabela.js";

export const VERSAO = 1;
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

// "Impressão digital" do plano: elenco planejado, titulares, reservas e formação
export const assinaturaDoPlano = (plano) =>
  String(misturar([...idsDoPlano(plano)].sort().join(","), JSON.stringify(plano.xi || {}), JSON.stringify(plano.res || {}), plano.form || "", D.CL[plano.club]?.lg || ""));

// ---------- Preparar ----------
// Monta a composição: resolve as pendências da liga do clube (e da liga nova, se ele subir ou cair).
// Time criado do zero entra no lugar de um clube da liga escolhida (substitui, ou o mais fraco).
export function prepararTemporada(plano, semente, escolhas = {}, substitui = null) {
  const k = plano.club, c = D.CL[k], criado = !!c?.criado, L0 = c.lg;
  let resolvidas = resolverPendencias([L0], semente, escolhas);
  let lg = criado ? L0 : ligaNaTemporada(k, resolvidas);
  const avisos = [];
  if (lg === null) {
    avisos.push(`O ${c.n} cai para uma divisão que não está no site. Nesta versão, ele joga a ${rotuloLiga(L0)} mesmo assim.`);
    lg = L0;
  } else if (lg !== L0) {
    resolvidas = resolverPendencias([L0, lg], semente, escolhas);
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
  return { liga: lg, composicao, pendenciasResolvidas: resolvidas, avisos };
}

// Times da temporada: o seu pelo plano; os outros pelo elenco atual (sem quem o seu plano contratou)
export function montarTimes(plano, clubes, lg) {
  const fora = idsDoPlano(plano), times = {};
  for (const k of clubes) times[k] = k === plano.club ? escalarPlano(plano) : escalarClube(k, lg, fora);
  return times;
}

// Calendário fixo para a semente: a ordem dos clubes é sorteada e o método do círculo faz o resto
export const calendarioDe = (estado) => gerarCalendario(embaralhar(rngDe(estado.semente, "calendario"), estado.composicao.clubes));
export const totalRodadas = (estado) => calendarioDe(estado).length;
export const sorteioDe = (estado) => Object.fromEntries(estado.composicao.clubes.map((k) => [k, misturar(estado.semente, "sorteio", k)]));

// Estado novo (antes da 1ª rodada), já com a previsão
export function criarEstado(plano, { semente = novaSemente(), escolhas = {}, substitui = null } = {}) {
  const prep = prepararTemporada(plano, semente, escolhas, substitui);
  const estado = {
    v: VERSAO, semente, rodadaAtual: 0, liga: prep.liga, composicao: prep.composicao, pendenciasResolvidas: prep.pendenciasResolvidas,
    escolhas, substitui, avisos: prep.avisos, resultados: [], estatisticas: {}, assinatura: assinaturaDoPlano(plano),
  };
  estado.previsao = calcularPrevisao(estado, montarTimes(plano, estado.composicao.clubes, estado.liga));
  return estado;
}

// ---------- Simular ----------
// Joga as rodadas até "ate" (sem passar do fim). Cada jogo tem a sua própria semente (semente + rodada + jogo),
// então simular rodada a rodada ou tudo de uma vez dá o mesmo resultado. Devolve um estado novo.
export function simularAte(estado, plano, ate) {
  const cal = calendarioDe(estado), fim = Math.min(ate, cal.length);
  if (estado.rodadaAtual >= fim) return estado;
  const novo = { ...estado, resultados: [...estado.resultados], estatisticas: { ...estado.estatisticas } };
  const times = montarTimes(plano, estado.composicao.clubes, estado.liga);
  for (let r = estado.rodadaAtual; r < fim; r++) {
    novo.resultados.push(cal[r].map(([c, f], i) => {
      const jogo = jogarPartida(rngDe(estado.semente, r, i), times[c], times[f]);
      for (const [id, lado, g, a, nota] of jogo.jogadores) {
        const s = novo.estatisticas[id] ? [...novo.estatisticas[id]] : [0, 0, 0, 0, lado ? f : c];
        s[0]++; s[1] += g; s[2] += a; s[3] += Math.round(nota * 10);
        novo.estatisticas[id] = s;
      }
      return [c, f, jogo.gc, jogo.gf, jogo.eventos];
    }));
  }
  novo.rodadaAtual = fim;
  return novo;
}

export const tabelaAtual = (estado) => tabelaDosResultados(estado.composicao.clubes, estado.resultados, sorteioDe(estado));

// ---------- Previsão ----------
// 300 temporadas rápidas (só placares). Para cada clube: posição média, chance de título, de cair e de subir.
export function calcularPrevisao(estado, times, n = N_PREVISAO) {
  const clubes = estado.composicao.clubes, cal = calendarioDe(estado);
  const forca = Object.fromEntries(clubes.map((k) => [k, times[k].forca]));
  const zonas = zonasDaLiga(estado.liga, clubes.length);
  const soma = {}, titulo = {}, queda = {}, acesso = {};
  clubes.forEach((k) => { soma[k] = 0; titulo[k] = 0; queda[k] = 0; acesso[k] = 0; });
  const rng = rngDe(estado.semente, "previsao");
  for (let s = 0; s < n; s++) {
    temporadaRapida(rng, clubes, forca, cal).forEach((k, i) => {
      soma[k] += i + 1;
      if (i === 0) titulo[k]++;
      if (zonas[i]?.tipo === "queda") queda[k]++;
      if (zonas[i]?.tipo === "acesso") acesso[k]++;
    });
  }
  const pct = (x) => Math.round((x / n) * 1000) / 10;
  return Object.fromEntries(clubes.map((k) => [k, { pos: Math.round((soma[k] / n) * 10) / 10, titulo: pct(titulo[k]), queda: pct(queda[k]), acesso: pct(acesso[k]), forca: Math.round(forca[k] * 10) / 10 }]));
}

// ---------- Estatísticas ----------
// Jogador pelo id (da base ou criado no plano)
export const jogadorSim = (plano, id) => D.BYID[id] || (plano.custom || []).find((c) => c.id === id) || null;
// Linhas de estatística: [{ p, k, j, g, a, nota }]
export function linhasEstatisticas(estado, plano) {
  return Object.entries(estado.estatisticas).map(([id, [j, g, a, s, k]]) => ({ p: jogadorSim(plano, id), id, k, j, g, a, nota: j ? s / 10 / j : 0 })).filter((x) => x.p);
}
// Mínimo de jogos para entrar em "melhores notas" e na seleção: 30% das rodadas jogadas
export const minimoJogos = (estado) => Math.max(1, Math.ceil(estado.rodadaAtual * 0.3));

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
