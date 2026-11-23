// Copas da temporada simulada (public/copas.json, em D.COPAS): quem se classifica, o formato de cada copa e o motor.
//
// Cada copa vira um esqueleto de ETAPAS (como as ligas em formatos.js), cada uma com número fixo de rodadas:
//   ko      uma fase de mata-mata (jogo único ou ida e volta), com byes para os mais fortes quando o número não fecha
//   grupos  grupos de 4 (potes por força, no máximo um clube do mesmo país por grupo quando possível), turno e returno
//   liga    fase de liga de 36 clubes (Champions/Europa: 8 jogos em 9 rodadas, com uma folga; Conference: 6 jogos)
// Os participantes de cada etapa vêm de "fontes" (lista fixa, vencedores da etapa anterior, posições de um grupo,
// perdedores de outra copa...). As etapas que dependem de resultados só são geradas quando chega a vez delas.
//
// Estado de uma copa (em estado.copas[id]): { part, selo, agenda, chaves, grupos, resultados } — o mesmo jeito das ligas.
import { D } from "../dados.js";
import { PAISES } from "../constantes.js";
import { embaralhar, rngDe } from "./aleatorio.js";
import { roundRobin } from "./formatos.js";
import { novaLinha, registrarJogo, ordenarTabela } from "./tabela.js";
import { forcaRapida } from "./escalar.js";
import { sortearPlacar } from "./motor.js";

export const defCopa = (id) => D.COPAS?.copas?.[id] || null;
export const nomeCopa = (id) => defCopa(id)?.nome || id;
export const copasDaLiga = (lg) => (D.COPAS?.por_liga?.[lg] || []).filter((id) => defCopa(id));
export const ligasComCopa = (id) => Object.entries(D.COPAS?.por_liga || {}).filter(([, l]) => l.includes(id)).map(([lg]) => lg);
const NOME_FASE = { 2: "Final", 4: "Semifinal", 8: "Quartas", 16: "Oitavas", 32: "16 avos", 64: "32 avos", 128: "64 avos" };
const pot2 = (x) => 2 ** Math.floor(Math.log2(x));
const limitar = (p) => Math.min(0.65, Math.max(0.35, p));
// País de cada clube (em cache: é chamado milhões de vezes nos sorteios da previsão)
const cachePais = new Map();
const paisDe = (k) => {
  let p = cachePais.get(k);
  if (p === undefined) { const lg = D.CL[k]?.lg; p = PAISES.find((P) => P.ligas.includes(lg))?.sigla || lg; cachePais.set(k, p); }
  return p;
};
const divDe = (k) => D.LG[D.CL[k]?.lg]?.div || 1;
// Ordem de força (a do clube do usuário vem do plano, quando informada)
const porForca = (forca) => (a, b) => (forca(b) - forca(a)) || (a < b ? -1 : 1);

// ---------- Finais pendentes de 2026 (Libertadores, Sul-Americana, Copa do Brasil) ----------
export const finaisPendentes = () => (defCopa("LIB")?.pendentes || []).filter((p) => p.jogo?.every((k) => D.CL[k]));
// "Simular" (padrão): jogo único em campo neutro com o motor. "Escolher": escolhas[id] = clube campeão.
export function resolverFinais(semente, escolhas = {}, forca = forcaRapida) {
  const out = {};
  for (const p of finaisPendentes()) {
    const [a, b] = p.jogo, esc = escolhas[p.id];
    if (esc === a || esc === b) { out[p.id] = { modo: "escolher", vence: esc, vice: esc === a ? b : a }; continue; }
    const rng = rngDe(semente, "final2026", p.id);
    const [x, y] = sortearPlacar(rng, forca(a), forca(b), true);
    let vence = x > y ? a : y > x ? b : null;
    const pen = !vence;
    if (pen) vence = rng() < limitar(0.5 + 0.02 * (forca(a) - forca(b))) ? a : b;
    out[p.id] = { modo: "simular", vence, vice: vence === a ? b : a, placar: [x, y], pen };
  }
  return out;
}

// ---------- Classificação ----------
// ctx: { tabela(lg) → clubes na ordem final da temporada ATUAL projetada, clubes2027(lg) → composição da temporada
//        simulada, rebaixado(k), finais (resolverFinais), forca(k) }
export function classificarCopas(ids, ctx) {
  const precisa = new Set(ids), out = {};
  if (precisa.has("SUD")) precisa.add("LIB");
  if (precisa.has("UEL") || precisa.has("UECL")) precisa.add("UCL");
  if (precisa.has("UECL")) precisa.add("UEL");
  if (precisa.has("LIB")) out.LIB = classificarLib(ctx);
  if (precisa.has("SUD")) out.SUD = classificarSud(ctx, out.LIB);
  if (precisa.has("UCL")) out.UCL = classificarUcl(ctx);
  if (precisa.has("UEL")) out.UEL = classificarUel(ctx, out.UCL);
  if (precisa.has("UECL")) out.UECL = classificarUecl(ctx, out.UCL, out.UEL);
  for (const id of precisa) {
    if (out[id]) continue;
    const def = defCopa(id);
    if (id === "CDB") {
      const a = ctx.clubes2027("BRA"), baixo = [...ctx.clubes2027("BRB"), ...ctx.clubes2027("BRC")];
      out.CDB = { a, baixo, selo: Object.fromEntries([...a, ...baixo].map((k) => [k, "real"])) };
    } else if (def?.tipo === "copa_nacional") {
      const todos = (def.participantes?.ligas || []).flatMap((lg) => ctx.clubes2027(lg));
      out[id] = { todos, selo: Object.fromEntries(todos.map((k) => [k, "real"])) };
    }
  }
  return out;
}

function novoAdd(selo, ja, ctx, checarQueda = true) {
  return (lista, k, s = "projeção") => {
    if (!k || ja.has(k) || !D.CL[k] || (checarQueda && ctx.rebaixado?.(k))) return false;
    lista.push(k); ja.add(k); selo[k] = s;
    return true;
  };
}
const seloFinal = (f) => (f?.modo === "escolher" ? "escolhido" : "projeção");

// Libertadores: campeões de 2026 (Libertadores e Sul-Americana) em vagas extras; depois cada país pelos garantidos reais
// e pela tabela; no Brasil, campeão e vice da Copa do Brasil 2026 (grupos e pré). Rebaixado não joga.
function classificarLib(ctx) {
  const def = defCopa("LIB"), selo = {}, ja = new Set(), grupos = [], pre = [];
  const add = novoAdd(selo, ja, ctx);
  for (const id of ["final_lib_2026", "final_sud_2026"]) add(grupos, ctx.finais[id]?.vence, seloFinal(ctx.finais[id]));
  for (const [pais, v] of Object.entries(def.vagas_por_pais || {})) {
    const tab = ctx.tabela(pais) || [];
    let g = 0, p = 0;
    const cdb = pais === "BRA" ? ctx.finais.final_cdb_2026 : null;
    if (cdb && add(grupos, cdb.vence, seloFinal(cdb))) g++;
    for (const k of def.garantidos_reais?.[pais] || []) {
      if (g < v.grupos) { if (add(grupos, k, "real")) g++; } else if (p < v.pre && add(pre, k, "real")) p++;
    }
    for (const k of tab) { if (g >= v.grupos) break; if (add(grupos, k)) g++; }
    if (cdb && p < v.pre && add(pre, cdb.vice, seloFinal(cdb))) p++;
    for (const k of tab) { if (p >= v.pre) break; if (add(pre, k)) p++; }
  }
  return { grupos, pre, selo };
}

// Sul-Americana: próximos de cada país que não foram à Libertadores. Brasil e Argentina vão direto aos grupos;
// os outros países jogam a primeira fase entre si (dentro do próprio país).
function classificarSud(ctx, lib) {
  const def = defCopa("SUD"), selo = {}, ja = new Set([...lib.grupos, ...lib.pre]), direto = [], primeira = [];
  const add = novoAdd(selo, ja, ctx);
  for (const [pais, n] of Object.entries(def.vagas_por_pais || {})) {
    const lista = pais === "BRA" || pais === "ARG" ? direto : primeira;
    let c = 0;
    for (const k of ctx.tabela(pais) || []) { if (c >= n) break; if (add(lista, k)) c++; }
  }
  return { direto, primeira, selo };
}

// Champions: diretas por posição, vagas extras por desempenho, "detentores" (campeões mais fortes de fora da lista)
// e a qualificação (caminho dos campeões e caminho da liga)
function classificarUcl(ctx) {
  const def = defCopa("UCL"), selo = {}, ja = new Set(), diretos = [];
  const add = novoAdd(selo, ja, ctx, false);
  const proximos = (lg, n, lista = diretos) => { let c = 0; for (const k of ctx.tabela(lg) || []) { if (c >= n) break; if (add(lista, k)) c++; } };
  for (const [lg, n] of Object.entries(def.diretas || {})) proximos(lg, n);
  for (const [lg, n] of Object.entries(def.european_performance_spots || {})) if (typeof n === "number") proximos(lg, n);
  const outras = ligasComCopa("UCL").filter((lg) => !(lg in (def.diretas || {})));
  const campeoes = outras.map((lg) => (ctx.tabela(lg) || [])[0]).filter((k) => k && !ja.has(k)).sort(porForca(forcaRapida));
  const nDet = def.detentores?.n || 0;
  campeoes.slice(0, nDet).forEach((k) => add(diretos, k));
  const qualCamp = [], qualLiga = [];
  const nCamp = 2 * (def.qualificacao?.caminho_campeoes?.vagas || 0);
  campeoes.slice(nDet, nDet + nCamp).forEach((k) => add(qualCamp, k));
  if (qualCamp.length % 2) { ja.delete(qualCamp.pop()); }
  // caminho da liga: o próximo colocado das ligas com 1 vaga direta (POR, BEL, CZE, TUR)
  Object.entries(def.diretas || {}).filter(([, n]) => n === 1).forEach(([lg]) => proximos(lg, 1, qualLiga));
  while (qualLiga.length > 2 * (def.qualificacao?.caminho_liga?.vagas || 2)) ja.delete(qualLiga.pop());
  if (qualLiga.length % 2) ja.delete(qualLiga.pop());
  return { diretos, qualCamp, qualLiga, selo };
}
const todosUcl = (u) => [...u.diretos, ...u.qualCamp, ...u.qualLiga];
const perdedoresQual = (u) => (u.qualCamp.length + u.qualLiga.length) / 2;

// Completa uma lista até "total" com os clubes mais fortes (força rápida) das ligas da copa que ainda não entraram,
// com no máximo MAX_PAIS clubes do mesmo país na copa (como a proteção de países da UEFA; sem isso, a Europa League
// enchia de ingleses e a fase de liga não teria como evitar jogos entre clubes do mesmo país)
const MAX_PAIS = 4;
function completar(lista, total, ligas, ja, selo) {
  const resto = ligas.flatMap((lg) => D.CLUBS.filter((c) => c.lg === lg).map((c) => c.k)).filter((k) => !ja.has(k)).sort(porForca(forcaRapida));
  const porPais = {};
  lista.forEach((k) => { porPais[paisDe(k)] = (porPais[paisDe(k)] || 0) + 1; });
  for (const k of resto) {
    if (lista.length >= total) break;
    if ((porPais[paisDe(k)] || 0) >= MAX_PAIS) continue;
    lista.push(k); ja.add(k); selo[k] = "projeção";
    porPais[paisDe(k)] = (porPais[paisDe(k)] || 0) + 1;
  }
}

function classificarUel(ctx, ucl) {
  const def = defCopa("UEL"), selo = {}, ja = new Set(todosUcl(ucl)), fixos = [];
  const add = novoAdd(selo, ja, ctx, false);
  for (const [lg, n] of Object.entries(def.vagas_por_pais || {})) { let c = 0; for (const k of ctx.tabela(lg) || []) { if (c >= n) break; if (add(fixos, k)) c++; } }
  completar(fixos, 36 - perdedoresQual(ucl), ligasComCopa("UEL"), ja, selo);
  return { fixos, selo };
}

function classificarUecl(ctx, ucl, uel) {
  const def = defCopa("UECL"), selo = {}, ja = new Set([...todosUcl(ucl), ...uel.fixos]), fixos = [];
  const add = novoAdd(selo, ja, ctx, false);
  for (const [lg, n] of Object.entries(def.vagas_por_pais || {})) { let c = 0; for (const k of ctx.tabela(lg) || []) { if (c >= n) break; if (add(fixos, k)) c++; } }
  completar(fixos, 36, ligasComCopa("UECL"), ja, selo);
  return { fixos, selo };
}

// Todos os participantes de uma copa (para listas e para saber se o clube joga)
export function participantesDe(id, part) {
  if (!part) return [];
  if (id === "LIB") return [...part.grupos, ...part.pre];
  if (id === "SUD") return [...part.direto, ...part.primeira];
  if (id === "UCL") return todosUcl(part);
  if (id === "UEL" || id === "UECL") return [...part.fixos];
  if (id === "CDB") return [...part.a, ...part.baixo];
  return [...(part.todos || [])];
}
// Como o clube entra: "grupos", "pré", "qualificação", "1ª fase"...
export function comoEntra(id, part, k) {
  if (id === "LIB") return part.grupos.includes(k) ? "fase de grupos" : part.pre.includes(k) ? "pré-Libertadores" : null;
  if (id === "SUD") return part.direto.includes(k) ? "fase de grupos" : part.primeira.includes(k) ? "primeira fase" : null;
  if (id === "UCL") return part.diretos.includes(k) ? "fase de liga" : part.qualCamp.includes(k) || part.qualLiga.includes(k) ? "qualificação" : null;
  if (id === "CDB") return part.a.includes(k) ? "5ª fase" : part.baixo.includes(k) ? "1ª fase" : null;
  return participantesDe(id, part).includes(k) ? (id === "UEL" || id === "UECL" ? "fase de liga" : "1ª fase") : null;
}

// ---------- Esqueleto de cada copa ----------
export function esqueletoCopa(id, part) {
  const def = defCopa(id), E = { id, def, etapas: [], total: 0, nomes: [] };
  const nova = (e) => {
    e.i = E.etapas.length; e.inicio = E.total;
    if (e.rodadas == null) e.rodadas = e.jogos === "ida_volta" ? 2 : 1;
    E.etapas.push(e);
    for (let r = 0; r < e.rodadas; r++) E.nomes.push(e.fase + (e.tipo === "ko" && e.rodadas === 2 ? (r ? " (volta)" : " (ida)") : e.tipo !== "ko" ? ` · rodada ${r + 1}` : ""));
    E.total += e.rodadas;
    return e.i;
  };
  // Mata-mata de n clubes até o campeão: fases por tamanho; final única em campo neutro
  const mataAte1 = (fonte, n, opc = {}) => {
    let f = fonte;
    if (n > 1 && n & (n - 1)) { f = { venc: nova({ tipo: "ko", fase: opc.primeira || "1ª fase", cal: opc.cal1 || "Oitavas", bloco: opc.bloco || "Mata-mata", jogos: opc.jogos || "unico", regra: "reduzir", alvo: pot2(n), fonte: f, mandoMenor: opc.mandoMenor }) }; n = pot2(n); }
    while (n > 1) {
      const nome = NOME_FASE[n] || `${n} clubes`, final = n === 2;
      const jogos = final ? "unico" : n === 4 && opc.semifinal ? opc.semifinal : opc.jogos || "unico";
      f = { venc: nova({ tipo: "ko", fase: nome, cal: nome, bloco: opc.bloco || "Mata-mata", jogos, neutro: final, regra: "sorteio", alvo: n / 2, fonte: f, mandoMenor: opc.mandoMenor && !final }) };
      n /= 2;
    }
    return f;
  };
  if (id === "LIB") {
    let f = { part: "pre" }, n = part.pre.length, k = 1;
    while (n > 4) { const alvo = n > 16 ? 16 : n & (n - 1) ? pot2(n) : n / 2; f = { venc: nova({ tipo: "ko", fase: `Pré · fase ${k++}`, cal: "Pré-Libertadores (3 fases)", bloco: "Pré-Libertadores", jogos: "ida_volta", regra: "reduzir", alvo, fonte: f }) }; n = alvo; }
    E.pre = E.etapas.length ? E.etapas.length - 1 : null;
    const g = nova({ tipo: "grupos", fase: "Fase de grupos", cal: "Fase de grupos", bloco: "Fase de grupos", nGrupos: 8, rodadas: 6, fonte: { soma: [{ part: "grupos" }, f] } });
    E.grupos = g;
    const oit = nova({ tipo: "ko", fase: "Oitavas", cal: "Oitavas", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { grupo: g, pos: 1 }, outros: { grupo: g, pos: 2 }, evitarGrupo: g });
    mataAte1({ venc: oit }, 8, { jogos: "ida_volta" });
  } else if (id === "SUD") {
    const p1 = nova({ tipo: "ko", fase: "Primeira fase", cal: "Primeira fase", bloco: "Primeira fase", jogos: "unico", regra: "pais", fonte: { part: "primeira" } });
    const fontes = [{ part: "direto" }, { venc: p1 }];
    if (part.libPre !== false) fontes.push({ perd: "pre", copa: "LIB" });
    const g = nova({ tipo: "grupos", fase: "Fase de grupos", cal: "Fase de grupos", bloco: "Fase de grupos", nGrupos: 8, rodadas: 6, fonte: { soma: fontes } });
    E.grupos = g;
    const po = nova({ tipo: "ko", fase: "Playoff", cal: "Playoff", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { grupo: g, pos: 2 }, outros: { grupo: "grupos", pos: 3, copa: "LIB" } });
    const oit = nova({ tipo: "ko", fase: "Oitavas", cal: "Oitavas", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { grupo: g, pos: 1 }, outros: { venc: po } });
    mataAte1({ venc: oit }, 8, { jogos: "ida_volta" });
  } else if (id === "UCL" || id === "UEL" || id === "UECL") {
    let fonte;
    if (id === "UCL") {
      const q = nova({ tipo: "ko", fase: "Qualificação", cal: "Qualificação", bloco: "Qualificação", jogos: "ida_volta", regra: "caminhos", caminhos: [{ part: "qualCamp" }, { part: "qualLiga" }] });
      E.qual = q;
      fonte = { soma: [{ part: "diretos" }, { venc: q }] };
    } else fonte = id === "UEL" ? { soma: [{ part: "fixos" }, { perd: "qual", copa: "UCL" }] } : { part: "fixos" };
    const seis = id === "UECL";
    const l = nova({ tipo: "liga", fase: "Fase de liga", cal: "Fase de liga", bloco: "Fase de liga", jogosPorClube: seis ? 6 : 8, rodadas: seis ? 6 : 9, fonte });
    E.liga = l;
    const po = nova({ tipo: "ko", fase: "Playoff", cal: "Playoff", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { liga: l, de: 9, ate: 16 }, outros: { liga: l, de: 17, ate: 24 } });
    const oit = nova({ tipo: "ko", fase: "Oitavas", cal: "Oitavas", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { liga: l, de: 1, ate: 8 }, outros: { venc: po } });
    mataAte1({ venc: oit }, 8, { jogos: "ida_volta" });
  } else if (id === "CDB") {
    let f = { part: "baixo" }, n = part.baixo.length, k = 1;
    while (n > 12) { const alvo = Math.max(12, Math.ceil(n / 2)); f = { venc: nova({ tipo: "ko", fase: `Fase ${k++}`, cal: "Fases 1 a 4", bloco: "Fases 1 a 4", jogos: "unico", regra: "reduzir", alvo, fonte: f, mandoMenor: true }) }; n = alvo; }
    const quinta = nova({ tipo: "ko", fase: "5ª fase", cal: "5ª fase (32 clubes)", bloco: "Mata-mata", jogos: "ida_volta", regra: "cabecas", cab: { part: "a" }, outros: f });
    mataAte1({ venc: quinta }, Math.max(2, pot2(Math.ceil((part.a.length + n) / 2))), { jogos: "ida_volta" });
  } else {
    // copas nacionais: byes para os mais fortes até fechar potência de 2; mando do clube de divisão menor
    mataAte1({ part: "todos" }, part.todos.length, { jogos: def.jogos || "unico", semifinal: def.semifinal, mandoMenor: true });
  }
  return E;
}

// ---------- Participantes de uma etapa (fontes) ----------
function avaliar(f, mundo, id) {
  if (!f) return [];
  const c = mundo.copas[f.copa || id], Ec = mundo.esq[f.copa || id];
  if (f.soma) return f.soma.flatMap((x) => avaliar(x, mundo, id));
  if (f.part) return [...(c?.part?.[f.part] || [])];
  if (f.venc != null) { const ch = c?.chaves[f.venc]; return ch ? [...ch.vence, ...ch.passam].filter(Boolean) : []; }
  if (f.perd != null) {
    const i = f.perd === "pre" ? Ec?.pre : f.perd === "qual" ? Ec?.qual : f.perd;
    const ch = i != null ? c?.chaves[i] : null;
    return ch ? ch.pares.map(([a, b], j) => (ch.vence[j] === a ? b : ch.vence[j] === b ? a : null)).filter(Boolean) : [];
  }
  if (f.grupo != null) {
    const i = f.grupo === "grupos" ? Ec?.grupos : f.grupo;
    const gs = c?.grupos[i];
    return gs ? gs.map((g) => tabelaCopa(c, Ec, [i], g.clubes)[f.pos - 1]?.k).filter(Boolean) : [];
  }
  if (f.liga != null) return tabelaCopa(c, Ec, [f.liga], c?.grupos[f.liga]?.[0]?.clubes || []).slice(f.de - 1, f.ate).map((l) => l.k);
  return [];
}

// Tabela de uma etapa de grupos/liga (só os jogos entre os clubes da lista). Em cache por estado da copa, enquanto
// o número de rodadas jogadas não muda (a mesma tabela é pedida várias vezes nos sorteios das fases seguintes).
const cacheTabelas = new WeakMap();
export function tabelaCopa(c, E, etapas, clubes) {
  let mapa = cacheTabelas.get(c);
  if (!mapa || mapa.n !== c.resultados.length || mapa.res !== c.resultados) { mapa = { n: c.resultados.length, res: c.resultados, t: new Map() }; cacheTabelas.set(c, mapa); }
  const chave = etapas.join(",") + "|" + clubes.join(",");
  if (!mapa.t.has(chave)) mapa.t.set(chave, calcularTabelaCopa(c, E, etapas, clubes));
  return mapa.t.get(chave);
}
function calcularTabelaCopa(c, E, etapas, clubes) {
  const set = new Set(clubes), linhas = Object.fromEntries(clubes.map((k) => [k, novaLinha(k)])), jogos = [];
  for (const i of etapas) {
    const e = E.etapas[i];
    for (let r = e.inicio; r < e.inicio + e.rodadas && r < c.resultados.length; r++)
      for (const [x, y, gx, gy] of c.resultados[r]) { if (!set.has(x) || !set.has(y)) continue; registrarJogo(linhas, x, y, gx, gy); jogos.push([x, y, gx, gy]); }
  }
  return ordenarTabela(Object.values(linhas), jogos, Object.fromEntries(clubes.map((k, i) => [k, i])));
}

// ---------- Gerar as rodadas de uma etapa ----------
function orientar(a, b, forca, mandoMenor, rng) {
  // [a, b]: "a" decide em casa (volta) ou manda o jogo único. Copa nacional: manda o clube de divisão menor.
  if (mandoMenor) { const da = divDe(a), db = divDe(b); if (da !== db) return da > db ? [a, b] : [b, a]; return rng() < 0.5 ? [a, b] : [b, a]; }
  return forca(a) >= forca(b) ? [a, b] : [b, a];
}
function parearAleatorio(lista, rng, forca, mandoMenor) {
  const l = embaralhar(rng, lista), pares = [], passam = [];
  for (let j = 0; j + 1 < l.length; j += 2) pares.push(orientar(l[j], l[j + 1], forca, mandoMenor, rng));
  if (l.length % 2) passam.push(l[l.length - 1]);
  return { pares, passam };
}

function gerarKo(e, mundo, id, rng) {
  const forca = mundo.forca;
  let pares = [], passam = [];
  if (e.regra === "reduzir") {
    const L = [...new Set(avaliar(e.fonte, mundo, id))].sort(porForca(forca));
    const extra = L.length - e.alvo;
    if (extra <= 0) passam = L;
    else {
      passam = L.slice(0, L.length - 2 * extra);
      ({ pares } = parearAleatorio(L.slice(L.length - 2 * extra), rng, forca, e.mandoMenor));
    }
  } else if (e.regra === "sorteio") {
    ({ pares, passam } = parearAleatorio([...new Set(avaliar(e.fonte, mundo, id))], rng, forca, e.mandoMenor));
  } else if (e.regra === "caminhos") {
    for (const f of e.caminhos) { const r = parearAleatorio(avaliar(f, mundo, id), rng, forca, false); pares.push(...r.pares); passam.push(...r.passam); }
  } else if (e.regra === "pais") {
    const por = {};
    for (const k of avaliar(e.fonte, mundo, id)) (por[paisDe(k)] = por[paisDe(k)] || []).push(k);
    for (const l of Object.values(por)) { const r = parearAleatorio(l, rng, forca, false); pares.push(...r.pares); passam.push(...r.passam); }
  } else if (e.regra === "cabecas") {
    const cab = embaralhar(rng, avaliar(e.cab, mundo, id)), outros = embaralhar(rng, avaliar(e.outros, mundo, id));
    const grupoDe = {};
    if (e.evitarGrupo != null) (mundo.copas[id].grupos[e.evitarGrupo] || []).forEach((g, gi) => g.clubes.forEach((k) => { grupoDe[k] = gi; }));
    const livres = [...cab];
    for (const o of outros) {
      let j = livres.findIndex((c) => grupoDe[c] == null || grupoDe[c] !== grupoDe[o]);
      if (j < 0) j = 0;
      if (!livres.length) { passam.push(o); continue; }
      pares.push([livres[j], o]);
      livres.splice(j, 1);
    }
    const r = parearAleatorio(livres, rng, forca, false);
    pares.push(...r.pares); passam.push(...r.passam);
    // juntar os que sobraram sozinhos dos dois lados
    if (passam.length > 1) { const r2 = parearAleatorio(passam.splice(0), rng, forca, false); pares.push(...r2.pares); passam.push(...r2.passam); }
  }
  const ch = { pares, passam, vence: [] };
  const rodadas = e.jogos === "ida_volta" ? [pares.map(([a, b]) => [b, a]), pares.map(([a, b]) => [a, b])] : [pares.map(([a, b]) => (e.neutro ? [a, b, 1] : [a, b]))];
  return { ch, rodadas };
}

// Grupos de 4: potes por força; no máximo um clube do mesmo país por grupo quando possível
function gerarGrupos(e, mundo, id, rng) {
  const L = [...new Set(avaliar(e.fonte, mundo, id))].sort(porForca(mundo.forca));
  const G = e.nGrupos, grupos = Array.from({ length: G }, (_, i) => ({ nome: `Grupo ${"ABCDEFGHIJKL"[i]}`, clubes: [] }));
  for (let p = 0; p * G < L.length; p++) {
    const pote = embaralhar(rng, L.slice(p * G, p * G + G));
    let melhor = null;
    for (let t = 0; t < 30 && !melhor; t++) {
      const tent = t ? embaralhar(rng, pote) : pote;
      if (tent.every((k, gi) => !grupos[gi].clubes.some((x) => paisDe(x) === paisDe(k)))) melhor = tent;
    }
    (melhor || pote).forEach((k, gi) => grupos[gi].clubes.push(k));
  }
  const listas = grupos.map((g) => roundRobin(g.clubes, 2, rng));
  const rodadas = Array.from({ length: e.rodadas }, (_, r) => listas.flatMap((l) => l[r] || []));
  return { grupos, rodadas };
}

// Potes por força, com no máximo metade de cada pote do mesmo país (quem passa disso vai para o pote seguinte):
// sem isso, um pote com 4 ingleses em 6 não teria como evitar jogos entre eles
function montarPotes(L, nPotes, tam) {
  const potes = Array.from({ length: nPotes }, () => []), lim = Math.floor(tam / 2);
  let espera = [];
  for (let p = 0; p < nPotes; p++) {
    const fila = [...espera, ...L.slice(p * tam, p * tam + tam)].filter((k) => !potes.some((x) => x.includes(k)));
    espera = [];
    for (const k of fila) {
      const n = potes[p].filter((x) => paisDe(x) === paisDe(k)).length;
      if (potes[p].length < tam && (n < lim || p === nPotes - 1)) potes[p].push(k); else espera.push(k);
    }
    // completa o pote com os próximos da lista que não estourem o limite
    for (const k of L) { if (potes[p].length >= tam) break; if (!potes.some((x) => x.includes(k)) && !espera.includes(k) && potes[p].filter((x) => paisDe(x) === paisDe(k)).length < lim) potes[p].push(k); }
  }
  const usados = new Set(potes.flat());
  for (const k of L) if (!usados.has(k)) { const p = potes.findIndex((x) => x.length < tam); if (p >= 0) potes[p].push(k); }
  return potes;
}

// Fase de liga de 36: potes por força; sem rival do mesmo país (quando possível)
function gerarLiga(e, mundo, id, rng) {
  const L = [...new Set(avaliar(e.fonte, mundo, id))].sort(porForca(mundo.forca));
  const grupos = [{ nome: "Fase de liga", clubes: L }];
  const mesmoPais = (a, b) => paisDe(a) === paisDe(b);
  const rodadas = Array.from({ length: e.rodadas }, () => []);
  // Permutação de B (para casar com A) sem país repetido e diferente de "evitar" na mesma posição (embaralha e testa)
  const casar = (A, B, evitar) => {
    for (let t = 0; t < 2000; t++) {
      const s = embaralhar(rng, B);
      if (A.every((a, i) => !mesmoPais(a, s[i]) && (!evitar || evitar[i] !== s[i]))) return s;
    }
    for (let t = 0; t < 200; t++) { const s = embaralhar(rng, B); if (!evitar || A.every((a, i) => evitar[i] !== s[i])) return s; }
    return embaralhar(rng, B);
  };
  // Ordem em ciclo (ou em pares) sem dois vizinhos do mesmo país: caminho guloso com recomeço
  const semVizinhos = (pote, fechar) => {
    for (let t = 0; t < 200; t++) {
      const resto = embaralhar(rng, pote), c = [resto.shift()];
      while (resto.length) {
        const j = resto.findIndex((k) => !mesmoPais(k, c[c.length - 1]) && (resto.length > 1 || !fechar || !mesmoPais(k, c[0])));
        if (j < 0) break;
        c.push(resto.splice(j, 1)[0]);
      }
      if (c.length === pote.length) return c;
    }
    return pote;
  };
  if (L.length !== 36) {
    // número diferente de 36 (dados incompletos): turno único truncado
    roundRobin(L, 1, rng).slice(0, e.rodadas).forEach((r, i) => rodadas[i].push(...r));
    return { grupos, rodadas };
  }
  if (e.jogosPorClube === 8) {
    const potes = montarPotes(L, 4, 9).map((p) => embaralhar(rng, p));
    const pares = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    pares.forEach((par, pi) => par.forEach(([i, j]) => {
      const s1 = casar(potes[i], potes[j]), s2 = casar(potes[i], potes[j], s1);
      potes[i].forEach((a, x) => { rodadas[2 * pi].push([a, s1[x]]); rodadas[2 * pi + 1].push([s2[x], a]); });
    }));
    // dentro do pote: um ciclo de 9 (cada um joga 2: um em casa, um fora), em 3 rodadas
    potes.forEach((pote) => {
      const ciclo = semVizinhos(pote, true);
      ciclo.forEach((k, i) => rodadas[6 + (i === 8 ? 2 : i % 2)].push([k, ciclo[(i + 1) % 9]]));
    });
  } else {
    // 6 jogos: 6 potes de 6; um jogo contra cada pote (o próprio incluído)
    const potes = montarPotes(L, 6, 6).map((p) => embaralhar(rng, p));
    let ordem = [0, 1, 2, 3, 4, 5];
    for (let r = 0; r < 5; r++) {
      for (let x = 0; x < 3; x++) {
        const i = ordem[x], j = ordem[5 - x], s = casar(potes[i], potes[j]);
        potes[i].forEach((a, y) => rodadas[r].push(r % 2 ? [s[y], a] : [a, s[y]]));
      }
      ordem = [ordem[0], ordem[5], ...ordem.slice(1, 5)];
    }
    potes.forEach((pote) => {
      // pares (0-1, 2-3, 4-5) sem país repetido: um caminho sem vizinhos do mesmo país serve
      const p = semVizinhos(pote, false);
      for (let i = 0; i < 6; i += 2) rodadas[5].push([p[i], p[i + 1]]);
    });
  }
  return { grupos, rodadas };
}

// Garante a rodada r da copa (gerando a etapa quando chega a vez dela). mundo = { copas, esq, semente, forca }
export function garantirRodadaCopa(id, r, mundo) {
  const c = mundo.copas[id], E = mundo.esq[id];
  while (c.agenda.length <= r && c.agenda.length < E.total) {
    const e = E.etapas.find((x) => x.inicio === c.agenda.length);
    if (!e || c.resultados.length < e.inicio) return null;
    const rng = rngDe(mundo.semente, "copa", id, e.i);
    let rodadas;
    if (e.tipo === "ko") { const g = gerarKo(e, mundo, id, rng); c.chaves[e.i] = g.ch; rodadas = g.rodadas; }
    else if (e.tipo === "grupos") { const g = gerarGrupos(e, mundo, id, rng); c.grupos[e.i] = g.grupos; rodadas = g.rodadas; }
    else { const g = gerarLiga(e, mundo, id, rng); c.grupos[e.i] = g.grupos; rodadas = g.rodadas; }
    rodadas.forEach((jogos) => c.agenda.push({ e: e.i, jogos }));
  }
  return c.agenda[r]?.jogos || null;
}

// Depois da última rodada de uma fase de mata-mata: quem passou (agregado; empate = pênaltis)
export function fecharRodadaCopa(id, r, mundo, sorte) {
  const c = mundo.copas[id], E = mundo.esq[id];
  const e = E.etapas.find((x) => x.inicio <= r && r < x.inicio + x.rodadas);
  if (!e || e.tipo !== "ko" || r !== e.inicio + e.rodadas - 1) return;
  const ch = c.chaves[e.i];
  ch.vence = ch.pares.map(([a, b], i) => {
    let ga = 0, gb = 0;
    for (let x = e.inicio; x <= r; x++) { const j = c.resultados[x]?.[i]; if (!j) return null; if (j[0] === a) { ga += j[2]; gb += j[3]; } else { ga += j[3]; gb += j[2]; } }
    if (ga !== gb) return ga > gb ? a : b;
    return sorte(e.i, i) < limitar(0.5 + 0.02 * (mundo.forca(a) - mundo.forca(b))) ? a : b;
  });
}

// ---------- Para a tela ----------
export function confrontoCopa(c, e, j) {
  const ch = c.chaves[e.i];
  if (!ch) return null;
  const [a, b] = ch.pares[j];
  let ga = 0, gb = 0, jogados = 0;
  const jogos = [];
  for (let r = e.inicio; r < e.inicio + e.rodadas; r++) {
    const x = c.resultados[r]?.[j];
    if (!x) continue;
    jogados++;
    const [p, q] = x[0] === a ? [x[2], x[3]] : [x[3], x[2]];
    ga += p; gb += q; jogos.push([x[0], x[2], x[3]]);
  }
  const vence = ch.vence?.[j] || null;
  return { a, b, ga, gb, jogos, jogados, vence, penaltis: !!vence && ga === gb };
}
export const campeaoCopa = (c, E) => { const e = E.etapas[E.etapas.length - 1]; const ch = e && c.chaves[e.i]; return ch?.vence?.[0] || (ch && !ch.pares.length ? ch.passam[0] : null) || null; };

// Vistas da aba Tabela para uma copa: [{ id, nome, blocos }] (tabelas de grupos/fase de liga e chaveamentos)
const ZONAS_LIGA = [[1, 8, "Oitavas", "#1a7f37"], [9, 24, "Playoff", "#4caf50"], [25, 36, "Eliminados", "#c93a2e"]];
export function vistasCopa(id, c, E) {
  const vistas = [], blocos = {};
  E.etapas.forEach((e) => {
    if (!blocos[e.bloco]) { blocos[e.bloco] = { id: "b" + e.i, nome: e.bloco, etapas: [] }; vistas.push(blocos[e.bloco]); }
    blocos[e.bloco].etapas.push(e);
  });
  return vistas.map((v) => {
    const t = v.etapas[0];
    if (t.tipo === "grupos" || t.tipo === "liga") {
      const gs = c.grupos[t.i];
      if (!gs) return { id: v.id, nome: v.nome, blocos: [{ tipo: "aviso", texto: "Os grupos saem quando a fase anterior acabar." }] };
      return {
        id: v.id, nome: v.nome,
        blocos: gs.map((g) => {
          const linhas = tabelaCopa(c, E, [t.i], g.clubes);
          const zonas = t.tipo === "liga" ? linhas.map((l, i) => { const z = ZONAS_LIGA.find(([de, ate]) => i + 1 >= de && i + 1 <= ate); return z ? { nome: z[2], cor: z[3] } : null; })
            : linhas.map((l, i) => (i < 2 ? { nome: "Oitavas", cor: "#1a7f37" } : i === 2 && id === "LIB" ? { nome: "Playoff da Sul-Americana", cor: "#2f6fdd" } : null));
          return { tipo: "tabela", titulo: g.nome, linhas, zonas, inicio: 0 };
        }),
      };
    }
    return {
      id: v.id, nome: v.nome,
      blocos: [{ tipo: "chave", titulo: v.nome, fases: v.etapas.map((e) => { const ch = c.chaves[e.i]; return { nome: e.fase, idaVolta: e.jogos === "ida_volta", definida: !!ch, confrontos: ch ? ch.pares.map((_, j) => confrontoCopa(c, e, j)) : [], passam: ch ? ch.passam : [] }; }) }],
    };
  });
}

// Campanha do clube numa copa: "Campeão", "Vice", "Eliminado nas quartas (para o X)", "Fase de grupos (3º)"...
export function campanhaCopa(id, c, E, k) {
  if (!participantesDe(id, c.part).includes(k)) return { txt: "Não se classificou", fora: true };
  if (campeaoCopa(c, E) === k) return { txt: "Campeão", titulo: true };
  for (let i = E.etapas.length - 1; i >= 0; i--) {
    const e = E.etapas[i];
    if (e.tipo === "ko") {
      const ch = c.chaves[e.i];
      if (!ch) continue;
      const j = ch.pares.findIndex((p) => p.includes(k));
      if (j >= 0) {
        if (!ch.vence[j]) return { txt: `Na disputa: ${e.fase}` };
        if (ch.vence[j] !== k) { const adv = ch.pares[j].find((x) => x !== k); return { txt: e.fase === "Final" ? "Vice-campeão" : `Eliminado: ${e.fase}`, adv }; }
        return { txt: `Passou: ${e.fase}` };
      }
      if (ch.passam.includes(k)) return { txt: `Passou direto: ${e.fase}` };
    } else {
      const gs = c.grupos[e.i];
      const g = gs?.find((x) => x.clubes.includes(k));
      if (!g) continue;
      const pos = tabelaCopa(c, E, [e.i], g.clubes).findIndex((l) => l.k === k) + 1;
      const acabou = c.resultados.length >= e.inicio + e.rodadas;
      return { txt: `${e.fase}${gs.length > 1 ? " · " + g.nome : ""}: ${pos}º${acabou ? "" : " (em andamento)"}` };
    }
  }
  return { txt: "Ainda não estreou" };
}

// ---------- Calendário ----------
// Posição (0 = 1ª rodada da liga, 1 = última) de cada rodada da copa, pelo "calendario" do copas.json
export function posicoesCopa(E) {
  const cal = E.def.calendario, pos = new Array(E.total);
  if (cal && typeof cal === "object") {
    const porChave = {};
    E.etapas.forEach((e) => { for (let r = 0; r < e.rodadas; r++) (porChave[e.cal] = porChave[e.cal] || []).push(e.inicio + r); });
    let ultimo = 0;
    for (const e of E.etapas) {
      const v = cal[e.cal], lista = porChave[e.cal];
      lista.forEach((r, j) => {
        if (pos[r] != null) return;
        let p;
        if (Array.isArray(v)) p = v[0] + ((v[1] - v[0]) * (j + 0.5)) / lista.length;
        else if (typeof v === "number") p = v + (j - (lista.length - 1) / 2) * 0.012;
        else p = ultimo + 0.01;
        pos[r] = p;
        ultimo = Math.max(ultimo, p);
      });
    }
    return pos;
  }
  // copas nacionais: as fases espalhadas entre 20% e 95% da temporada
  const n = E.etapas.length;
  E.etapas.forEach((e, i) => { for (let r = 0; r < e.rodadas; r++) pos[e.inicio + r] = 0.2 + (0.75 * (i + (r + 0.5) / e.rodadas)) / n; });
  return pos;
}
