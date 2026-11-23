// Mercado da IA: a janela de transferências dos outros clubes antes da temporada simulada (e, se ligada, uma janela no
// meio dela). Só mexe nos clubes da IA que jogam a temporada (a liga do usuário e as copas); o resto do mundo só vende.
// O elenco do plano do usuário nunca é mexido: a IA faz propostas e ele decide.
//
// Passo a passo (tudo com a semente do mercado: mesma semente = mesmas transferências):
//   1. Contratos e aposentadoria: contrato que acaba antes da temporada → 45% renova (+15% se tiver mais de 30 anos,
//      +15% se o overall estiver abaixo da média do elenco), senão fica livre. Aposentadoria: 36–37 anos 25%, 38+ 60%.
//   2. Carências de cada clube: grupos de posição com menos de 2 jogadores "bons" (overall ≥ média dos 11 titulares − 4;
//      no gol, menos de 2 goleiros) e a posição de um titular que saiu.
//   3. 4 rodadas de compras: em cada rodada, cada clube tenta no máximo 1 compra para a maior carência (sem carência,
//      às vezes um reforço). Alvos: jogadores de outros clubes ou livres que sejam bons para ele e caibam no orçamento,
//      na ordem da afinidade entre as ligas (a mesma do "Recomendados" do Mercado) e do ganho de overall por euro.
//      Preço = valor × 1,1 a 1,5 (mais caro se o vendedor for de liga mais forte ou tiver contrato longo); livre = 0.
//      Chance de o negócio sair: maior se o comprador for de liga mais forte; menor para o melhor jogador do vendedor,
//      para quem chegou nesta janela, quando o vendedor ficaria sem 2 jogadores no grupo e quando o vendedor é bem mais
//      forte que o comprador (o jogador não quer "descer").
//   4. Fechamento: menos de 2 goleiros ou menos de 22 jogadores → contrata livres; mais de 30 → dispensa os mais fracos.
//   5. Propostas pelos jogadores do usuário (até 3) e evolução dos jogadores (opcional).
import { D } from "../dados.js";
import { embaralhar, rngDe } from "./aleatorio.js";
import { forcaRapida, jogadoresDo } from "./escalar.js";
import { ehEstrangeiro, regraDaLiga } from "../estrangeiros.js";
import { afinidade } from "../afinidade.js";
import { elencoAtual } from "../elenco.js";
import { ovrDe } from "./motor.js";

// Interruptores (todos guardados no estado da temporada): ativo = "Clubes da IA contratam"; propostas = "Receber
// propostas"; meio = "Janela do meio"; evolucao = "Evolução entre temporadas"
export const OPCOES_MERCADO = { ativo: true, propostas: true, meio: false, evolucao: false };
export const GRUPOS = { GOL: ["GOL"], ZAG: ["ZAG"], LAT: ["LD", "LE"], MEIO: ["VOL", "MC", "MEI"], PONTA: ["PE", "PD", "ME", "MD"], ATA: ["CA", "SA"] };
const GRUPO_DE = Object.fromEntries(Object.entries(GRUPOS).flatMap(([g, ps]) => ps.map((p) => [p, g])));
export const grupoDe = (pos) => GRUPO_DE[pos] || "MEIO";
export const MIN_ELENCO = 22, MAX_ELENCO = 30, MAX_MOV = 5, RODADAS = 4;
// Tipos de transferência (guardados como letra, para o "plantel:sim" não crescer à toa)
export const TIPOS = { c: "compra", l: "livre", r: "renovação", a: "aposentadoria", d: "dispensa" };

const media = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const top11 = (ps) => media(ps.map(ovrDe).sort((a, b) => b - a).slice(0, 11));
// Força de cada liga (média da força rápida dos clubes), para "liga mais forte"
const cacheLiga = new Map();
function forcaLiga(lg) {
  if (!cacheLiga.has(lg)) cacheLiga.set(lg, media(D.CLUBS.filter((c) => c.lg === lg).map((c) => forcaRapida(c.k))));
  return cacheLiga.get(lg);
}
// Meses de contrato a partir da data dos dados ("20/11/2026")
function mesesDeContrato(ctr) {
  if (!ctr) return 0;
  const [, mes, ano] = (D.DATA?.updated || "01/11/2026").split("/").map(Number);
  return (+ctr.slice(0, 4) - ano) * 12 + (+ctr.slice(5, 7) - mes);
}

// Roda a janela. ativos = clubes da IA da temporada simulada (sem o do usuário); ligaDe(k) = liga do clube na temporada.
// respostas = { "<id>|<clube>": "recusada" | "contra-recusada" } (propostas já respondidas não voltam).
export function rodarJanela({ semente, plano, liga, ativos, ligaDe, opcoes = OPCOES_MERCADO, respostas = {} }) {
  const rng = rngDe(semente, "mercado");
  const k0 = plano.club;
  const doUsuario = new Set(elencoAtual(plano).filter(Boolean).map((p) => p.id));
  const P = (id) => D.BYID[id];
  const elencos = new Map(), clubeAtual = new Map(); // elenco de cada clube (Set de ids) e o clube de cada jogador que mudou
  const elenco = (k) => {
    if (!elencos.has(k)) elencos.set(k, new Set(jogadoresDo(k).filter((p) => !doUsuario.has(p.id)).map((p) => p.id)));
    return elencos.get(k);
  };
  const ativosSet = new Set(ativos);
  const info = {}; // por clube ativo: orçamento, gasto, vendas, chegadas, saídas, grupos que perderam titular
  for (const k of ativos) {
    const sq = [...elenco(k)].map(P);
    info[k] = { orc: Math.round(0.25 * sq.reduce((s, p) => s + (p.v || 0), 0) * 100) / 100, extra: 0, gasto: 0, vendas: 0, chegadas: 0, saidas: 0, perdeu: new Set(), chegou: new Set(), tentou: new Set() };
  }
  // extra = preço das vendas que o usuário combinou com o clube (o negócio já está fechado, então a verba vem junto)
  const disponivel = (k) => info[k].orc + info[k].extra + 0.6 * info[k].vendas - info[k].gasto;
  const transf = []; // { id, de, para, valor, tipo }
  const livres = new Map(); // id → { preco, de, t (índice da transferência de saída) }
  let noMeio = false; // true durante a janela do meio

  // Jogadores que o usuário vendeu no plano: vão para o clube de destino (se houver) ou ficam livres com o valor da venda
  for (const [id, x] of Object.entries(plano.st || {})) {
    const p = P(id);
    if (!p || (x.s !== "vende" && x.s !== "libera")) continue;
    const preco = x.s === "vende" ? +x.fee || 0 : 0;
    if (x.para && ativosSet.has(x.para)) {
      elenco(x.para).add(id); clubeAtual.set(id, x.para);
      info[x.para].gasto += preco; info[x.para].extra += preco; info[x.para].chegadas++; info[x.para].chegou.add(id);
      transf.push({ id, de: k0, para: x.para, valor: preco, tipo: "c" });
    } else livres.set(id, { preco, de: k0, t: transf.push({ id, de: k0, para: null, valor: preco, tipo: "l" }) - 1 });
  }

  // 1. Contratos e aposentadoria (só nos clubes ativos; emprestados ficam como estão)
  for (const k of ativos) {
    const sq = [...elenco(k)].map(P), m = media(sq.map(ovrDe));
    for (const p of sq) {
      if (p.emp) continue;
      const aposenta = p.a >= 38 ? rng() < 0.6 : p.a >= 36 ? rng() < 0.25 : false;
      if (aposenta) { elenco(k).delete(p.id); transf.push({ id: p.id, de: k, para: null, valor: 0, tipo: "a" }); continue; }
      if (!p.end26) continue;
      const renova = rng() < 0.45 + (p.a > 30 ? 0.15 : 0) + (ovrDe(p) < m ? 0.15 : 0);
      if (renova) transf.push({ id: p.id, de: k, para: k, valor: 0, tipo: "r" });
      else { elenco(k).delete(p.id); livres.set(p.id, { preco: 0, de: k, t: transf.push({ id: p.id, de: k, para: null, valor: 0, tipo: "l" }) - 1 }); }
    }
  }

  // Candidatos por grupo de posição, do maior overall para o menor (todos os jogadores do site + os livres)
  const porGrupo = Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, []]));
  for (const p of D.ALL) if (!doUsuario.has(p.id)) porGrupo[grupoDe(p.pos)].push(p);
  Object.values(porGrupo).forEach((l) => l.sort((a, b) => ovrDe(b) - ovrDe(a)));
  const aposentados = new Set(transf.filter((t) => t.tipo === "a").map((t) => t.id));
  const clubeDo = (p) => (livres.has(p.id) ? null : clubeAtual.get(p.id) ?? (D.CL[p.club] ? p.club : null));

  const carencias = (k) => {
    const sq = [...elenco(k)].map(P), M = top11(sq), bons = {};
    for (const g of Object.keys(GRUPOS)) bons[g] = 0;
    for (const p of sq) { const g = grupoDe(p.pos); if (g === "GOL" || ovrDe(p) >= M - 4) bons[g]++; }
    const lista = Object.keys(GRUPOS).filter((g) => bons[g] < 2 || info[k]?.perdeu.has(g)).sort((a, b) => bons[a] - bons[b]);
    return { M, lista, bons };
  };

  // Uma tentativa de compra do clube k para o grupo g. Devolve true se contratou.
  function tentar(k, g, M, reforco = false) {
    const lgK = ligaDe(k), regra = regraDaLiga(lgK), limEst = regra.relacionados ?? Infinity;
    const sq = [...elenco(k)].map(P), estrangeiros = sq.filter((p) => ehEstrangeiro(p, lgK)).length;
    const alvoMin = reforco ? M + 1 : M - 4, alvoMax = M + 7, verba = disponivel(k);
    const cands = [];
    for (const p of porGrupo[g]) {
      const o = ovrDe(p);
      if (o > alvoMax) continue;
      if (o < alvoMin) break;
      // Emprestados não são vendidos pelo clube onde estão (inclusive os do usuário emprestados a outros clubes)
      if (aposentados.has(p.id) || doUsuario.has(p.id) || info[k].tentou.has(p.id) || (p.emp && !livres.has(p.id))) continue;
      const de = clubeDo(p);
      if (de === k || de === k0) continue; // nem do próprio clube, nem do clube do usuário (emprestados por ele)
      const livre = livres.has(p.id);
      if (!livre && !de) continue;
      const preco = livre ? livres.get(p.id).preco : Math.max(0.1, Math.min((p.v || 0) * 1.5, (p.v || 0) * (1.1 + (forcaLiga(D.CL[de].lg) > forcaLiga(lgK) + 1 ? 0.2 : 0) + (mesesDeContrato(p.ctr) > 24 ? 0.2 : 0))));
      if (preco > verba) continue;
      const est = ehEstrangeiro(p, lgK);
      if (est && estrangeiros >= limEst + 3) continue; // no limite: não deixa passar de vagas + 3
      if (!livre && de && info[de] && (info[de].saidas >= MAX_MOV || elenco(de).size <= MIN_ELENCO)) continue;
      const origem = livre ? D.CL[livres.get(p.id).de]?.lg || lgK : D.CL[de].lg;
      const ganho = Math.max(0.5, o - (M - 4));
      // Jogador de um clube bem mais forte dificilmente aceita descer (pesa na escolha e na chance)
      const desce = !livre && forcaRapida(de) > M + 4;
      const nota = 0.6 * afinidade(lgK, origem) + 0.4 * Math.min(1, ganho / Math.max(preco, 0.3) / 6) - (est && estrangeiros >= limEst ? 0.25 : 0) - (desce ? 0.2 : 0) + rng() * 0.1;
      cands.push({ p, de, preco, livre, nota, desce });
      if (cands.length >= 40) break;
    }
    if (!cands.length) return false;
    cands.sort((a, b) => b.nota - a.nota);
    const c = cands[Math.min(cands.length - 1, Math.floor(rng() * Math.min(3, cands.length)))];
    info[k].tentou.add(c.p.id);
    // Chance de o negócio sair
    let chance = 0.9;
    if (!c.livre) {
      const vend = [...elenco(c.de)].map(P), gv = grupoDe(c.p.pos), Mv = top11(vend);
      const melhor = vend.every((x) => ovrDe(x) <= ovrDe(c.p));
      const ficaSem2 = vend.filter((x) => x.id !== c.p.id && grupoDe(x.pos) === gv && (gv === "GOL" || ovrDe(x) >= Mv - 4)).length < 2;
      chance = 0.55 + (forcaLiga(lgK) > forcaLiga(D.CL[c.de].lg) + 1 ? 0.2 : 0) + (c.preco >= (c.p.v || 0) * 1.4 ? 0.1 : 0)
        - (melhor ? 0.35 : 0) - (info[c.de]?.chegou.has(c.p.id) ? 0.45 : 0) - (ficaSem2 ? 0.3 : 0) - (c.desce ? 0.35 : 0);
    }
    if (rng() >= Math.min(0.95, Math.max(0.05, chance))) return false;
    // Fechou: muda de clube
    const id = c.p.id;
    if (c.livre) {
      const l = livres.get(id);
      livres.delete(id);
      // Na pré-temporada, a saída dele ganha o destino; na janela do meio, vira uma transferência nova (livre → clube)
      if (!noMeio) { transf[l.t].para = k; transf[l.t].valor = c.preco; }
      else transf.push({ id, de: l.de, para: k, valor: c.preco, tipo: "l" });
    } else {
      elenco(c.de).delete(id);
      transf.push({ id, de: c.de, para: k, valor: Math.round(c.preco * 100) / 100, tipo: "c" });
      if (info[c.de]) {
        info[c.de].vendas += c.preco; info[c.de].saidas++;
        const Mv = top11([...elenco(c.de)].map(P));
        if (ovrDe(c.p) >= Mv) info[c.de].perdeu.add(grupoDe(c.p.pos)); // o vendedor repõe na vez dele
      }
    }
    elenco(k).add(id); clubeAtual.set(id, k);
    info[k].gasto += c.preco; info[k].chegadas++; info[k].chegou.add(id); info[k].perdeu.delete(g);
    return true;
  }

  // 3. Rodadas de compras: os clubes da liga do usuário primeiro, depois os outros (ordem sorteada a cada rodada)
  const rodadas = (n) => {
    const daLiga = ativos.filter((k) => ligaDe(k) === liga);
    for (let r = 0; r < n; r++) {
      const ordem = [...embaralhar(rng, ativos.filter((k) => daLiga.includes(k))), ...embaralhar(rng, ativos.filter((k) => !daLiga.includes(k)))];
      for (const k of ordem) {
        if (info[k].chegadas >= MAX_MOV || elenco(k).size >= MAX_ELENCO) continue;
        const { M, lista } = carencias(k);
        if (lista.length) tentar(k, lista[0], M);
        else if (rng() < 0.35) tentar(k, Object.keys(GRUPOS).filter((g) => g !== "GOL")[Math.floor(rng() * 5)], M, true);
      }
    }
  };
  rodadas(RODADAS);

  // 4. Fechamento: goleiros, mínimo e máximo de jogadores
  // Livres que cabem no orçamento do clube (quase todos custam 0; os vendidos pelo usuário custam o valor da venda)
  const melhorLivre = (k, filtro) => [...livres.keys()].map(P).filter((p) => p && filtro(p) && livres.get(p.id).preco <= disponivel(k)).sort((a, b) => ovrDe(b) - ovrDe(a))[0];
  const contratarLivre = (k, p) => {
    const l = livres.get(p.id);
    livres.delete(p.id); transf[l.t].para = k; transf[l.t].valor = l.preco; info[k].gasto += l.preco;
    elenco(k).add(p.id); clubeAtual.set(p.id, k); info[k].chegou.add(p.id);
  };
  for (const k of ativos) {
    const goleiros = () => [...elenco(k)].map(P).filter((p) => p.pos === "GOL").length;
    for (let t = 0; t < 3 && goleiros() < 2; t++) { const p = melhorLivre(k, (x) => x.pos === "GOL"); if (!p) break; contratarLivre(k, p); }
    for (let t = 0; t < 30 && elenco(k).size < MIN_ELENCO; t++) {
      const { lista } = carencias(k);
      const p = melhorLivre(k, (x) => !lista.length || lista.includes(grupoDe(x.pos))) || melhorLivre(k, () => true);
      if (!p) break;
      contratarLivre(k, p);
    }
    if (elenco(k).size > MAX_ELENCO) {
      const sq = [...elenco(k)].map(P);
      const gol = sq.filter((p) => p.pos === "GOL").length;
      const fora = sq.filter((p) => !info[k].chegou.has(p.id) && !p.emp).sort((a, b) => ovrDe(a) - ovrDe(b) || a.a - b.a);
      let golFora = 0;
      for (const p of fora) {
        if (elenco(k).size <= MAX_ELENCO) break;
        if (p.pos === "GOL" && gol - golFora <= 2) continue;
        if (p.pos === "GOL") golFora++;
        elenco(k).delete(p.id);
        transf.push({ id: p.id, de: k, para: null, valor: 0, tipo: "d" });
      }
    }
  }

  // 5a. Propostas pelos jogadores do usuário (clubes com carência no grupo do jogador, que caiba no orçamento)
  // (sorteio próprio: recusar uma proposta não muda o resto do mercado)
  const propostas = [];
  if (opcoes.propostas) {
    const rng = rngDe(semente, "propostas");
    const meus = elencoAtual(plano).filter((p) => p && D.BYID[p.id] && !(plano.st || {})[p.id]);
    for (const k of embaralhar(rng, ativos)) {
      if (propostas.length >= 3) break;
      const { M, lista } = carencias(k);
      const p = embaralhar(rng, meus).find((x) => lista.includes(grupoDe(x.pos)) && ovrDe(x) >= M - 4 && ovrDe(x) <= M + 8 && (x.v || 0) * 1.1 <= disponivel(k)
        && !propostas.some((y) => y.id === x.id) && !respostas[x.id + "|" + k]);
      if (!p) continue;
      propostas.push({ id: p.id, k, valor: Math.round(Math.max(0.1, (p.v || 0) * (1.1 + rng() * 0.3)) * 10) / 10 });
    }
  }

  // 5b. Evolução dos jogadores (opcional): overall novo só dentro do simulador
  let ovrs = null;
  if (opcoes.evolucao) {
    ovrs = {};
    const todos = new Set([...ativos.flatMap((k) => [...elenco(k)]), ...doUsuario]);
    for (const id of todos) {
      const p = P(id) || (plano.custom || []).find((c) => c.id === id);
      if (!p || p.ovr == null) continue;
      const r = rngDe(semente, "evolucao", id), a = p.a || 25;
      const d = a <= 21 ? 1 + Math.floor(r() * 3) : a <= 28 ? Math.floor(r() * 3) - 1 : a <= 32 ? Math.floor(r() * 3) - 2 : -1 - Math.floor(r() * 3);
      if (d) ovrs[id] = Math.max(40, Math.min(p.ovr + 4, p.ovr + d));
    }
  }

  const gastos = Object.fromEntries(ativos.map((k) => [k, [Math.round((info[k].orc + info[k].extra) * 100) / 100, Math.round(info[k].gasto * 100) / 100, Math.round(info[k].vendas * 100) / 100]]));

  // Janela do meio (opcional): mais 2 rodadas de compras, valendo a partir da metade da temporada
  let meio = null;
  if (opcoes.meio) {
    const n0 = transf.length;
    noMeio = true;
    ativos.forEach((k) => { info[k].chegadas = 0; info[k].saidas = 0; info[k].tentou.clear(); });
    rodadas(2);
    meio = { transf: transf.slice(n0).map(compacta) };
    noMeio = false;
    transf.length = n0;
  }

  // Avisos para o clube do usuário: quem pode se aposentar
  const avisos = elencoAtual(plano).filter((p) => p && p.a >= 36).map((p) => `${p.n} tem ${p.a} anos e pode se aposentar.`);
  // Guardado compacto: transferências como [id, de, para, valor, tipo]; renovações só como a lista de ids (de = para = clube)
  const ren = transf.filter((t) => t.tipo === "r").map((t) => t.id);
  return { semente, opcoes, transf: transf.filter((t) => t.tipo !== "r").map(compacta), ren, propostas, ovrs, meio, avisos, gastos };
}

const compacta = (t) => [t.id, t.de, t.para, Math.round((t.valor || 0) * 100) / 100, t.tipo];

// Diferenças de elenco tiradas das transferências, na ordem: { k: { e: Set(entraram), s: Set(saíram) } } (calculadas uma vez
// por mercado). fase "meio" = pré-temporada + janela do meio.
const cacheDifs = new WeakMap();
export function difsDoMercado(mercado, fase = "inicio") {
  if (!mercado) return {};
  if (!cacheDifs.has(mercado)) cacheDifs.set(mercado, {});
  const c = cacheDifs.get(mercado);
  if (c[fase]) return c[fase];
  const difs = {}, de = (k) => (difs[k] ??= { e: new Set(), s: new Set() });
  const lista = fase === "meio" ? [...mercado.transf, ...(mercado.meio?.transf || [])] : mercado.transf;
  for (const [id, a, b] of lista) {
    if (a === b) continue;
    if (a) { const d = de(a); d.e.has(id) ? d.e.delete(id) : d.s.add(id); }
    if (b) { const d = de(b); d.s.has(id) ? d.s.delete(id) : d.e.add(id); }
  }
  return (c[fase] = difs);
}

// Elenco de um clube depois do mercado (fase "inicio" ou "meio"): lista de jogadores
export function elencoDepois(k, mercado, fase = "inicio") {
  const base = jogadoresDo(k);
  const dif = mercado && difsDoMercado(mercado, fase === "meio" && mercado.meio ? "meio" : "inicio")[k];
  if (!dif) return base;
  return [...base.filter((p) => !dif.s.has(p.id)), ...[...dif.e].map((id) => D.BYID[id]).filter(Boolean)];
}

// Transferências para a tela: [{ id, p, de, para, valor, tipo, meio }] (renovações por último)
export function listaTransferencias(mercado) {
  if (!mercado) return [];
  const conv = (meio) => ([id, de, para, valor, tipo]) => ({ id, p: D.BYID[id], de, para, valor, tipo, meio });
  const ren = (mercado.ren || []).map((id) => [id, D.BYID[id]?.club, D.BYID[id]?.club, 0, "r"]);
  return [...mercado.transf.map(conv(false)), ...(mercado.meio?.transf || []).map(conv(true)), ...ren.map(conv(false))].filter((t) => t.p);
}
