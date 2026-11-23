// Mercado da IA (versão simples, 23/11/2026): no começo da temporada simulada, os clubes da IA fazem algumas
// contratações realistas de jogadores de outros clubes do mundo. Nada além disso: sem vendas por iniciativa própria,
// dispensas, renovações, aposentadorias, propostas ao usuário ou evolução.
//
// Uma janela só, antes da 1ª rodada, com a semente da simulação (mesma semente = mesmas contratações):
//   Fase 1 (na hora): os clubes que jogam a temporada simulada (a liga do usuário e as copas dela), com os da liga do
//          usuário primeiro. É ela que muda os elencos usados pela previsão e pelo motor.
//   Fase 2 (Web Worker, depois de a tela abrir): o resto do mundo. Para não mudar os elencos da temporada depois da
//          previsão, ela não compra jogadores dos clubes da fase 1.
//
// Regras de cada clube comprador:
//   - De 0 a 4 contratações (média ~2): mais quando o caixa é grande em relação ao valor do elenco e quando há posições
//     fracas. Caixa = a estimativa do site (caixaSugerido: média do valor dos elencos da liga). Gasto total ≤ caixa.
//   - Posição: o grupo onde há menos de 2 jogadores ou onde o titular é mais fraco em relação à média dos titulares.
//   - Reforço: melhor que esse titular ou, no mínimo, um reserva bom (overall ≥ média dos titulares − 3).
//   - Valor de mercado entre 3% e 25% do valor do elenco do comprador; preço = valor de mercado.
//   - Clube de origem com elenco de no máximo 1,5× o valor do elenco do comprador.
//   - Conservador (pedido de 23/11/2026, mais rígido que a regra "o melhor só sai para liga mais forte"): o melhor
//     jogador da origem nunca sai; o 2º e o 3º melhores só saem para um clube de elenco mais valioso, de liga igual ou
//     mais forte; e o reforço não passa de média dos titulares do comprador + 5.
//   - Preferência pela afinidade entre as ligas (a mesma do "Recomendados" do Mercado) e por idade entre 20 e 31.
//   - Limite de estrangeiros (regras-estrangeiros.json): clube já no limite só contrata quem não ocupa vaga.
//   - Proibidos: o elenco do clube do usuário, quem o usuário contratou no plano, emprestados e quem já mudou de clube.
import { D } from "../dados.js";
import { embaralhar, rngDe } from "./aleatorio.js";
import { forcaRapida, jogadoresDo } from "./escalar.js";
import { ehEstrangeiro, regraDaLiga } from "../estrangeiros.js";
import { afinidade } from "../afinidade.js";
import { elencoAtual } from "../elenco.js";
import { caixaSugerido } from "../times.js";
import { ovrDe } from "./motor.js";

export const MAX_CONTRATACOES = 4;
export const FAIXA_VALOR = [0.03, 0.25]; // valor do reforço ÷ valor do elenco do comprador
export const MAIS_RICO = 1.5; // valor do elenco da origem ÷ valor do elenco do comprador (máximo)
export const TETO_OVR = 5; // o reforço tem no máximo a média dos titulares do comprador + 5
const RODADAS = MAX_CONTRATACOES;
// Grupos de posição e quantos titulares cada um tem (4-3-3)
export const GRUPOS = { GOL: ["GOL"], ZAG: ["ZAG"], LAT: ["LD", "LE"], MEIO: ["VOL", "MC", "MEI"], PONTA: ["PE", "PD", "ME", "MD"], ATA: ["CA", "SA"] };
const TITULARES = { GOL: 1, ZAG: 2, LAT: 2, MEIO: 3, PONTA: 2, ATA: 1 };
const GRUPO_DE = Object.fromEntries(Object.entries(GRUPOS).flatMap(([g, ps]) => ps.map((p) => [p, g])));
export const grupoDe = (pos) => GRUPO_DE[pos] || "MEIO";

// ---------- Dados de apoio (em cache; refeitos quando os dados são recarregados) ----------
let cache = { de: null };
function apoio() {
  if (cache.de === D.ALL) return cache;
  // Candidatos por grupo de posição e por liga, cada lista do mais barato para o mais caro
  const porGrupo = Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, new Map()]));
  for (const p of D.ALL) {
    if (!(p.v > 0) || p.emp || !D.CL[p.club] || D.CL[p.club].criado) continue;
    const m = porGrupo[grupoDe(p.pos)], lg = D.CL[p.club].lg;
    if (!m.has(lg)) m.set(lg, []);
    m.get(lg).push(p);
  }
  Object.values(porGrupo).forEach((m) => m.forEach((l) => l.sort((a, b) => a.v - b.v)));
  cache = { de: D.ALL, porGrupo, valor: new Map(), caixa: new Map(), liga: new Map(), ordem: new Map() };
  return cache;
}
// Valor do elenco do clube no data.json
export function valorDoElenco(k) {
  const c = apoio();
  if (!c.valor.has(k)) c.valor.set(k, jogadoresDo(k).reduce((s, p) => s + (p.v || 0), 0));
  return c.valor.get(k);
}
// Caixa do clube: a estimativa que o site usa (média do valor dos elencos da liga)
export function caixaDaIA(lg) {
  const c = apoio();
  if (!c.caixa.has(lg)) c.caixa.set(lg, caixaSugerido(lg));
  return c.caixa.get(lg);
}
function forcaDaLiga(lg) {
  const c = apoio();
  if (!c.liga.has(lg)) {
    const l = D.CLUBS.filter((x) => x.lg === lg).map((x) => forcaRapida(x.k));
    c.liga.set(lg, l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
  }
  return c.liga.get(lg);
}
// Ligas de origem em ordem de afinidade para a liga do comprador: [[liga, afinidade]]
function ligasPorAfinidade(lg) {
  const c = apoio();
  if (!c.ordem.has(lg)) c.ordem.set(lg, Object.keys(D.LG).map((x) => [x, afinidade(lg, x)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  return c.ordem.get(lg);
}
// Primeiro índice da lista (ordenada por valor) com valor ≥ v
function inicio(lista, v) {
  let a = 0, b = lista.length;
  while (a < b) { const m = (a + b) >> 1; if (lista[m].v < v) a = m + 1; else b = m; }
  return a;
}

// Ids que a IA não pode levar: o elenco original do clube do usuário e tudo o que está no plano (inclui as compras)
export function proibidosDoPlano(plano) {
  return [...new Set([...jogadoresDo(plano.club).map((p) => p.id), ...elencoAtual(plano).filter(Boolean).map((p) => p.id), ...(plano.ins || []).map((x) => x.id)])];
}

// ---------- Motor da janela ----------
// compradores: clubes que compram ("primeiro" = os que escolhem antes em todas as rodadas); bloqueados: clubes de quem
// não se compra; antes: transferências da fase anterior (para montar os elencos). Devolve [[id, para], ...].
function rodar({ semente, rotulo, compradores, primeiro = [], ligaDe, proibidos, bloqueados, antes = [] }) {
  const rng = rngDe(semente, "janela", rotulo);
  const { porGrupo } = apoio();
  const P = (id) => D.BYID[id];
  const movidos = new Set(antes.map((t) => t[0]));
  const elencos = new Map(), melhor = new Map();
  // Elenco de cada clube (Set de ids), sem quem o usuário contratou
  const elenco = (k) => {
    if (!elencos.has(k)) elencos.set(k, new Set(jogadoresDo(k).filter((p) => !proibidos.has(p.id)).map((p) => p.id)));
    return elencos.get(k);
  };
  for (const [id, para] of antes) { const p = P(id); if (p) { elenco(p.club).delete(id); elenco(para).add(id); } }
  // Os 3 maiores overalls do elenco atual do clube (do maior para o menor)
  const melhoresDe = (k) => {
    if (!melhor.has(k)) melhor.set(k, [...elenco(k)].map((id) => ovrDe(P(id))).sort((a, b) => b - a).slice(0, 3));
    return melhor.get(k);
  };

  // Situação de um clube: média dos titulares e os grupos em ordem de carência
  const situacao = (k) => {
    const sq = [...elenco(k)].map(P).filter(Boolean), por = {};
    for (const g of Object.keys(GRUPOS)) por[g] = [];
    for (const p of sq) por[grupoDe(p.pos)].push(ovrDe(p));
    const tits = {};
    let soma = 0, n = 0;
    for (const g of Object.keys(GRUPOS)) {
      const l = por[g].sort((a, b) => b - a).slice(0, TITULARES[g]);
      tits[g] = l.length < TITULARES[g] ? 0 : l[l.length - 1]; // o titular mais fraco do grupo (0 = falta titular)
      l.forEach((x) => { soma += x; n++; });
    }
    const M = n ? soma / n : 60;
    // Carência: falta gente (menos de 2, ou menos que os titulares) ou titular abaixo da média dos titulares
    const lista = Object.keys(GRUPOS).map((g) => ({ g, tit: tits[g], falta: por[g].length < Math.max(2, TITULARES[g]), gap: tits[g] - M }))
      .sort((a, b) => (b.falta - a.falta) || (a.gap - b.gap));
    const carentes = lista.filter((x) => x.falta || x.gap < -2).length;
    return { M, lista, carentes, sq };
  };

  const info = new Map();
  for (const k of compradores) {
    const lg = ligaDe(k), vE = valorDoElenco(k), caixa = caixaDaIA(lg), s = situacao(k);
    // Quantas contratações o clube quer: mais com caixa grande (em relação ao elenco) e com posições fracas
    const folga = vE > 0 ? Math.min(2, caixa / vE) : 0;
    const alvo = Math.max(0, Math.min(MAX_CONTRATACOES, Math.round(0.6 + 0.45 * Math.min(3, s.carentes) + 0.45 * folga + (rng() - 0.5) * 2.4)));
    info.set(k, { lg, vE, caixa, gasto: 0, feitas: 0, alvo, porGrupo: {}, desistiu: false });
  }

  const transf = [];
  function tentar(k) {
    const I = info.get(k), { M, lista, sq } = situacao(k);
    const regra = regraDaLiga(I.lg), limite = regra.inscritos ?? regra.relacionados ?? Infinity;
    const noLimite = sq.filter((p) => ehEstrangeiro(p, I.lg)).length >= limite;
    const forcaK = forcaDaLiga(I.lg);
    const min = FAIXA_VALOR[0] * I.vE, max = Math.min(FAIXA_VALOR[1] * I.vE, I.caixa - I.gasto);
    if (max < min || max <= 0) return false;
    // O grupo mais carente; se não houver reforço possível, o seguinte (até o 3º; no máximo 2 contratações por grupo)
    for (const { g, tit } of lista.slice(0, 3)) {
      if ((I.porGrupo[g] || 0) >= 2) continue;
      const piso = Math.min(tit + 1, M - 3);
      // Os 3 melhores candidatos (nota = afinidade das ligas 45% + idade 25% + ganho sobre o titular 30%). As ligas vão
      // da maior afinidade para a menor; para quando nenhuma liga seguinte consegue passar o 3º colocado.
      const top3 = [];
      for (const [lgDe, af] of ligasPorAfinidade(I.lg)) {
        if (top3.length === 3 && top3[2].nota >= 0.45 * af + 0.55) break;
        const L = porGrupo[g].get(lgDe);
        if (!L) continue;
        const naoMaisFraca = forcaK >= forcaDaLiga(lgDe);
        for (let i = inicio(L, min); i < L.length && L[i].v <= max; i++) {
          const p = L[i], de = p.club, o = ovrDe(p);
          if (o < piso || o > M + TETO_OVR || de === k || movidos.has(p.id) || proibidos.has(p.id) || bloqueados.has(de)) continue;
          if (valorDoElenco(de) > MAIS_RICO * I.vE) continue;
          // O melhor da origem nunca sai; o 2º e o 3º só para clube mais rico, de liga igual ou mais forte
          const top = melhoresDe(de);
          if (o >= top[0]) continue;
          if (o >= (top[2] ?? 0) && !(naoMaisFraca && I.vE > valorDoElenco(de))) continue;
          if (noLimite && ehEstrangeiro(p, I.lg)) continue;
          const nota = 0.45 * af + 0.25 * (p.a >= 20 && p.a <= 31 ? 1 : 0.2) + 0.3 * Math.min(1, Math.max(0, o - tit) / 6);
          if (top3.length === 3 && nota <= top3[2].nota) continue;
          top3.push({ p, nota });
          top3.sort((a, b) => b.nota - a.nota || a.p.id.localeCompare(b.p.id));
          if (top3.length > 3) top3.pop();
        }
      }
      if (!top3.length) continue;
      const { p } = top3[Math.floor(rng() * top3.length)];
      // Fechou: o jogador sai da origem e entra no comprador (preço = valor de mercado)
      elenco(p.club).delete(p.id); melhor.delete(p.club);
      elenco(k).add(p.id); melhor.delete(k);
      movidos.add(p.id);
      I.gasto += p.v; I.feitas++; I.porGrupo[g] = (I.porGrupo[g] || 0) + 1;
      transf.push([p.id, k]);
      return true;
    }
    return false;
  }

  // Rodadas: em cada uma, cada clube que ainda quer reforço tenta 1 contratação (os "primeiro" escolhem antes)
  const antesDeTodos = compradores.filter((k) => primeiro.includes(k)), outros = compradores.filter((k) => !primeiro.includes(k));
  for (let r = 0; r < RODADAS; r++) {
    for (const k of [...embaralhar(rng, antesDeTodos), ...embaralhar(rng, outros)]) {
      const I = info.get(k);
      if (I.feitas >= I.alvo || I.desistiu) continue;
      if (!tentar(k)) I.desistiu = true;
    }
  }
  return transf;
}

// Fase 1: os clubes da IA que jogam a temporada (liga + copas). liga = liga do usuário (os clubes dela escolhem antes)
export function janelaDaTemporada({ semente, plano, liga, ativos, ligaDe }) {
  const proibidos = new Set(proibidosDoPlano(plano));
  const transf = rodar({ semente, rotulo: "temporada", compradores: ativos, primeiro: ativos.filter((k) => ligaDe(k) === liga), ligaDe, proibidos, bloqueados: new Set([plano.club]) });
  return { semente, transf, resto: false };
}

// Fase 2: o resto do mundo (no Web Worker; também funciona direto, como nos testes). Não compra dos clubes da fase 1
// nem do clube do usuário. Devolve só as transferências novas.
export function janelaDoResto({ semente, proibidos, k0, ativos, transf }) {
  const fase1 = new Set([...ativos, k0]);
  const compradores = D.CLUBS.map((c) => c.k).filter((k) => !fase1.has(k) && !D.CL[k].criado);
  return rodar({ semente, rotulo: "resto", compradores, ligaDe: (k) => D.CL[k].lg, proibidos: new Set(proibidos), bloqueados: fase1, antes: transf });
}

// ---------- Leitura ----------
// Diferenças de elenco: { k: { e: Set(chegaram), s: Set(saíram) } } (em cache por mercado)
const cacheDifs = new WeakMap();
export function difsDoMercado(mercado) {
  if (!mercado?.transf) return {};
  if (cacheDifs.has(mercado)) return cacheDifs.get(mercado);
  const difs = {}, de = (k) => (difs[k] ??= { e: new Set(), s: new Set() });
  for (const [id, para] of mercado.transf) {
    const p = D.BYID[id];
    if (!p || !D.CL[para]) continue;
    de(p.club).s.add(id);
    de(para).e.add(id);
  }
  cacheDifs.set(mercado, difs);
  return difs;
}
// Elenco de um clube depois da janela (lista de jogadores)
export function elencoDepois(k, mercado) {
  const base = jogadoresDo(k), dif = difsDoMercado(mercado)[k];
  if (!dif) return base;
  return [...base.filter((p) => !dif.s.has(p.id)), ...[...dif.e].map((id) => D.BYID[id]).filter(Boolean)];
}
// Ids de quem chegou ao clube nesta janela (selo "Novo")
export const chegaram = (k, mercado) => difsDoMercado(mercado)[k]?.e || new Set();
// Transferências para a tela: [{ id, p, de, para, valor }], da mais cara para a mais barata
export function listaTransferencias(mercado) {
  if (!mercado?.transf) return [];
  return mercado.transf.map(([id, para]) => { const p = D.BYID[id]; return p && D.CL[para] ? { id, p, de: p.club, para, valor: p.v } : null; })
    .filter(Boolean).sort((a, b) => b.valor - a.valor || a.id.localeCompare(b.id));
}
// Gasto de cada clube na janela: { k: [gasto, caixa, contratações] }
export function gastosDaJanela(mercado) {
  const g = {};
  for (const t of listaTransferencias(mercado)) {
    const x = (g[t.para] ??= [0, caixaDaIA(D.CL[t.para].lg), 0]);
    x[0] += t.valor; x[2]++;
  }
  return g;
}

// ---------- Web Worker ----------
// Dados que o worker precisa (enviados uma vez): ligas, clubes, regras de estrangeiros e os jogadores (só os campos usados)
export function dadosParaWorker() {
  return {
    LG: D.LG, ESTRANGEIROS: D.ESTRANGEIROS,
    CLUBS: D.CLUBS.map((c) => [c.k, c.lg, c.n]),
    ALL: D.ALL.map((p) => [p.id, p.club, p.lg, p.pos, p.v, p.ovr ?? null, p.a, p.nat, p.emp ? 1 : 0]),
  };
}
// No worker: monta o D mínimo com esses dados
export function montarDadosNoWorker(d) {
  D.LG = d.LG; D.ESTRANGEIROS = d.ESTRANGEIROS;
  D.CLUBS = d.CLUBS.map(([k, lg, n]) => ({ k, lg, n }));
  D.CL = Object.fromEntries(D.CLUBS.map((c) => [c.k, c]));
  D.ALL = d.ALL.map(([id, club, lg, pos, v, ovr, a, nat, emp]) => ({ id, club, lg, pos, v, ovr, a, nat, emp: !!emp }));
  D.BYID = Object.fromEntries(D.ALL.map((p) => [p.id, p]));
}
