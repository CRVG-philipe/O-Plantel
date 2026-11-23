// Formatos das ligas na temporada simulada (public/formatos-ligas.json, em D.FORMATOS).
//
// Cada liga vira um "esqueleto": uma lista de ETAPAS em ordem, cada uma com um número fixo de rodadas.
//   pontos  pontos corridos (turnos 1–4; grupos/conferências opcionais; "partes" = Apertura/Clausura da Argentina)
//   split   divide a tabela em grupos por posição e cada grupo joga mais turnos (pontos mantidos ou pela metade)
//   grupos  quadrangulares etc. (classificados de/até, nº de grupos, turnos, sorteio)
//   mata    UMA fase de um mata-mata (preliminar, quartas, semi, final): 1 rodada (jogo único) ou 2 (ida e volta)
// "torneios" (Apertura/Clausura) e "final" viram etapas desses tipos. As rodadas de cada etapa só são geradas quando
// ela começa (o split e o mata-mata dependem da tabela até ali), sempre com a semente: simular rodada a rodada ou
// tudo de uma vez dá o mesmo resultado.
//
// Estado de uma temporada ("st"): { agenda: [{ e, jogos: [[casa, fora, neutro?]] }], resultados: [[[casa, fora, gc, gf, ...]]],
//   chaves: { "<etapa>": { pares: [[melhor, pior, grupo]], passam: [[k, grupo]], vence: [k|null] } }, grupos: { "<etapa>": [{ nome, clubes }] } }
import { D } from "../dados.js";
import { gerarCalendario } from "./calendario.js";
import { embaralhar, rngDe } from "./aleatorio.js";
import { novaLinha, registrarJogo, ordenarTabela } from "./tabela.js";
import { disputaDoSorteio } from "./penaltis.js";

const PADRAO = { fases: [{ tipo: "pontos", turnos: 2 }], campeao: "pontos", confirmado: true };
export const formatoDa = (lg) => D.FORMATOS?.[lg] || PADRAO;
const LETRAS = "ABCDEFGHIJ";
const rodadasPorTurno = (n) => (n < 2 ? 0 : n % 2 ? n : n - 1);
const pot2 = (x) => 2 ** Math.floor(Math.log2(x));
const NOME_FASE = { 2: "Final", 4: "Semifinal", 8: "Quartas", 16: "Oitavas", 32: "16 avos" };

// ---------- Calendário de pontos ----------
export function roundRobin(clubes, turnos, rng) {
  if (clubes.length < 2) return [];
  const base = gerarCalendario(embaralhar(rng, clubes)), meio = base.slice(0, base.length / 2);
  const out = [];
  for (let t = 0; t < turnos; t++) out.push(...(t % 2 ? meio.map((r) => r.map(([a, b]) => [b, a])) : meio));
  return out;
}
// Rodadas extras (ex.: Argentina 30 rodadas com 30 clubes; Austrália 26): pares sorteados
function rodadasExtras(clubes, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const l = embaralhar(rng, clubes), r = [];
    for (let j = 0; j + 1 < l.length; j += 2) r.push(rng() < 0.5 ? [l[j], l[j + 1]] : [l[j + 1], l[j]]);
    out.push(r);
  }
  return out;
}
const juntar = (listas) => Array.from({ length: Math.max(0, ...listas.map((l) => l.length)) }, (_, r) => listas.flatMap((l) => l[r] || []));

// Grupos de uma fase de pontos (conferências, zonas, "2 grupos sorteados")
function gruposPontos(fase, clubes, semente, chave, lg) {
  if (!fase.grupos) return [{ nome: null, clubes: [...clubes] }];
  const tipo = String(fase.grupos), set = new Set(clubes);
  const rotulo = /confer/.test(tipo) ? "Conferência" : /zona/.test(tipo) ? "Zona" : "Grupo";
  let def = fase.grupos_def;
  // "usar as zonas de temporada-atual.json": as zonas reais (ex.: Primera Nacional)
  if (typeof def === "string" && /temporada-atual/.test(def) && D.ATUAL?.[lg]?.grupos) {
    def = Object.fromEntries(Object.entries(D.ATUAL[lg].grupos).map(([n, l]) => [n, l.map((r) => r.k)]));
  }
  if (def && typeof def === "object") {
    const nomes = Object.keys(def), listas = nomes.map((n) => def[n].filter((k) => set.has(k)));
    const usados = new Set(listas.flat());
    // quem subiu/caiu (não está nas listas) vai para o grupo menor
    for (const k of clubes) if (!usados.has(k)) { let m = 0; listas.forEach((l, i) => { if (l.length < listas[m].length) m = i; }); listas[m].push(k); }
    return nomes.map((nome, i) => ({ nome, clubes: listas[i] }));
  }
  const n = +(/(\d+)\s*grupos/.exec(`${def || ""} ${tipo}`)?.[1] || 2);
  const l = embaralhar(rngDe(semente, "grupos", chave), clubes);
  return Array.from({ length: n }, (_, i) => ({ nome: `${rotulo} ${LETRAS[i]}`, clubes: l.filter((_, j) => j % n === i) }));
}

// ---------- Esqueleto ----------
const cache = new Map();
export function esqueletoDe(lg, clubes, semente) {
  const chave = `${lg}|${semente}|${clubes.join(",")}`;
  if (!cache.has(chave)) { if (cache.size > 40) cache.clear(); cache.set(chave, montarEsqueleto(lg, clubes, semente)); }
  return cache.get(chave);
}

export function montarEsqueleto(lg, clubes, semente) {
  const F = formatoDa(lg);
  const E = { lg, F, clubes, semente, etapas: [], mata: [], torneios: [], partes: [], nomes: [], total: 0, liga: null };
  const novaEtapa = (e) => {
    e.i = E.etapas.length; e.inicio = E.total;
    E.etapas.push(e);
    for (let r = 0; r < e.rodadas; r++) E.nomes.push(nomeRodada(e, r));
    E.total += e.rodadas;
    return e;
  };
  const novoEscopo = (id, nome, t) => ({ id, nome, t, pontos: [], grupos: null, split: null, quad: null, matas: [] });

  function adicionarFase(fase, esc, chave) {
    if (fase.tipo === "pontos") {
      const grupos = gruposPontos(fase, clubes, semente, chave, lg);
      let rodadas = Math.max(0, ...grupos.map((g) => rodadasPorTurno(g.clubes.length))) * (fase.turnos || 1);
      const alvo = fase.partes ? Math.max(...fase.partes.map((p) => p.rodadas[1])) : +(/(\d+)\s*rodadas/.exec(fase.nota || "")?.[1] || 0);
      const extras = Math.max(0, alvo - rodadas);
      rodadas += extras;
      // Clausura com mando invertido: mesmo calendário do 1º torneio, com os mandos trocados
      const cal = { chave: fase.mando_invertido && E.torneios[0] ? `${E.torneios[0].id}.0` : chave, inverter: !!fase.mando_invertido, turnos: fase.turnos || 1, extras, grupos };
      const titulo = esc.nome || (F.fases.length > 1 || fase.partes ? "Fase de pontos" : null);
      if (fase.partes) {
        fase.partes.forEach((p, pi) => {
          const e = novaEtapa({ tipo: "pontos", esc: esc.id, cal, de: p.rodadas[0], ate: p.rodadas[1], rodadas: p.rodadas[1] - p.rodadas[0] + 1, nome: p.nome, parte: pi });
          esc.pontos.push(e.i);
          const parte = { nome: p.nome, etapa: e.i, mata: null };
          if (p.mata) parte.mata = adicionarMata(p.mata, esc, { etapas: [e.i], grupos: null });
          E.partes.push(parte);
        });
      } else {
        const e = novaEtapa({ tipo: "pontos", esc: esc.id, cal, de: 1, ate: rodadas, rodadas, nome: titulo });
        esc.pontos.push(e.i);
      }
      esc.grupos = grupos.length > 1 ? grupos : null;
      esc.tipoGrupo = String(fase.grupos || "");
    } else if (fase.tipo === "split") {
      const rodadas = Math.max(...fase.grupos.map((g) => rodadasPorTurno(g.ate - g.de + 1) * (g.turnos || 1)));
      esc.split = novaEtapa({ tipo: "split", esc: esc.id, fase, base: [...esc.pontos], rodadas, nome: esc.nome ? `${esc.nome} · Split` : "Split" }).i;
    } else if (fase.tipo === "grupos") {
      const m = fase.classificados.ate - fase.classificados.de + 1, G = fase.grupos || 2;
      const rodadas = rodadasPorTurno(Math.ceil(m / G)) * (fase.turnos || 1);
      esc.quad = novaEtapa({ tipo: "grupos", esc: esc.id, fase, base: [...esc.pontos], rodadas, nome: (esc.nome ? esc.nome + " · " : "") + (fase.nome || "Grupos") }).i;
    } else if (fase.tipo === "mata") {
      adicionarMata(fase, esc, { etapas: [...esc.pontos], grupos: esc.grupos });
    } else if (fase.tipo === "final") {
      adicionarFinal(fase, esc);
    }
  }

  // Um mata-mata: uma etapa por fase (preliminar → ... → final). "alvo" = quantos sobram depois da fase.
  function adicionarMata(cfg, esc, base, final = null) {
    const porGrupo = !!(cfg.por_grupo && base.grupos);
    const tam = final ? final.m : porGrupo ? Math.max(...base.grupos.map((g) => g.clubes.length)) : clubes.length;
    const de = final ? 1 : cfg.classificados?.de || 1, ate = final ? final.m : Math.min(cfg.classificados?.ate || tam, tam);
    const mg = { id: E.mata.length, nome: (esc.nome && !final ? esc.nome + " · " : "") + (cfg.nome || (final ? "Final" : "Mata-mata")), cfg, base, final, porGrupo, de, ate, etapas: [], esc: esc.id };
    E.mata.push(mg);
    esc.matas.push(mg.id);
    const tipo = esc.tipoGrupo || base.grupos?.[0]?.nome || "";
    const rotGrupo = porGrupo ? (/confer/i.test(tipo) ? "da conferência" : /zona/i.test(tipo) ? "da zona" : "do grupo") : "";
    const fase = (nome, jogos, alvo, extra = {}) => {
      const ehFinal = extra.ehFinal || false;
      const e = novaEtapa({ tipo: "mata", esc: esc.id, mg: mg.id, s: mg.etapas.length, nome: `${mg.nome} · ${nome}`, curto: nome, jogos, alvo,
        rodadas: jogos === "ida_volta" ? 2 : 1, final: ehFinal, neutro: ehFinal && jogos !== "ida_volta", cruzado: !!extra.cruzado });
      mg.etapas.push(e.i);
    };
    let n = Math.max(0, ate - de + 1);
    if (n > 1 && n & (n - 1)) { fase("Preliminar", "unico", pot2(n)); n = pot2(n); }
    while (n > 2) { fase(NOME_FASE[n] || `${n} clubes`, cfg.jogos || "unico", n / 2); n /= 2; }
    if (porGrupo) {
      if (n === 2) fase(`Final ${rotGrupo}`, cfg.jogos || "unico", 1);
      let g = base.grupos.length;
      if (g > 1 && cfg.final !== "nenhuma") {
        while (g > 2) { fase(NOME_FASE[g] || "Cruzamento", cfg.jogos || "unico", g / 2, { cruzado: true }); g /= 2; }
        fase("Final", cfg.final || cfg.jogos || "unico", 1, { cruzado: true, ehFinal: true });
      }
    } else if (n === 2 && cfg.final !== "nenhuma") fase("Final", cfg.final || cfg.jogos || "unico", 1, { ehFinal: true });
    return mg.id;
  }

  // Final entre líderes de grupo, campeões dos torneios etc.
  function adicionarFinal(fase, esc) {
    const entre = fase.entre || "lideres_grupos";
    const m = entre === "lideres_grupos" ? (esc.quad != null ? E.etapas[esc.quad].fase.grupos || 2 : 2)
      : entre === "lideres_pontos" ? (esc.grupos || [1, 2]).length
        : entre === "campeoes_torneios" ? E.torneios.length
          : entre === "campeoes_torneios_e_lider_anual" ? E.torneios.length + 1 : 2;
    const jogos = fase.jogos || "unico";
    return adicionarMata({ nome: fase.nome || "Final", jogos: m > 2 ? "unico" : jogos, final: jogos }, esc, { etapas: [...esc.pontos], grupos: null }, { entre, m, quad: esc.quad, gruposPontos: esc.grupos });
  }

  const liga = novoEscopo("liga", null, null);
  E.liga = liga;
  let temFinal = false;
  F.fases.forEach((fase, fi) => {
    if (fase.tipo === "torneios") {
      fase.torneios.forEach((t, ti) => {
        const esc = novoEscopo("t" + ti, t.nome, ti);
        E.torneios.push(esc);
        t.fases.forEach((f2, fj) => adicionarFase(f2, esc, `t${ti}.${fj}`));
      });
    } else {
      if (fase.tipo === "final") temFinal = true;
      adicionarFase(fase, liga, `f${fi}`);
    }
  });
  // Final que o "campeao" pede mas não está nas fases (Série C: líderes dos quadrangulares; Primera Nacional: líderes das zonas)
  if (F.campeao === "final" && !temFinal) adicionarFinal({ entre: "lideres_grupos", jogos: "ida_volta", nome: "Final" }, liga);
  if (F.campeao === "final_lideres") adicionarFinal({ entre: "lideres_pontos", jogos: "unico", nome: "Final" }, liga);
  E.escopos = [liga, ...E.torneios];
  return E;
}

function nomeRodada(e, r) {
  if (e.tipo === "pontos") return (e.nome ? e.nome + " · " : "") + `Rodada ${e.de + r}`;
  if (e.tipo === "mata") return e.nome + (e.rodadas === 2 ? (r ? " (volta)" : " (ida)") : "");
  return `${e.nome} · Rodada ${r + 1}`;
}
export const escopoDe = (E, id) => E.escopos.find((x) => x.id === id);

// ---------- Tabelas ----------
const rodadasDe = (st, E, etapas) => etapas.flatMap((i) => { const e = E.etapas[i]; return Array.from({ length: e.rodadas }, (_, r) => e.inicio + r); }).filter((r) => r < st.resultados.length);

// Tabela com os jogos das rodadas indicadas (só entre os clubes da lista, se houver)
export function tabelaDe(st, E, etapas, clubes, sorteio, inicial = null) {
  const lista = clubes || E.clubes, set = new Set(lista);
  const linhas = Object.fromEntries(lista.map((k) => [k, inicial?.[k] ? { ...inicial[k], ultimos: [...inicial[k].ultimos] } : novaLinha(k)]));
  const jogos = [];
  for (const r of rodadasDe(st, E, etapas))
    for (const [c, f, gc, gf] of st.resultados[r]) {
      if (!set.has(c) || !set.has(f)) continue;
      registrarJogo(linhas, c, f, gc, gf);
      jogos.push([c, f, gc, gf]);
    }
  return ordenarTabela(Object.values(linhas), jogos, sorteio);
}

// Tabela do split: a da fase de pontos (pontos mantidos ou pela metade) + os jogos do split, grupo por grupo
export function tabelasDoSplit(st, E, i, sorteio) {
  const e = E.etapas[i], grupos = st.grupos[i];
  if (!grupos) return null;
  const base = Object.fromEntries(tabelaDe(st, E, e.base, null, sorteio).map((l) => [l.k, { ...l, pts: e.fase.pontos === "metade" ? Math.floor(l.pts / 2) : l.pts }]));
  return grupos.map((g) => ({ nome: g.nome, linhas: tabelaDe(st, E, [i], g.clubes, sorteio, base), de: g.de }));
}

// Classificação "principal" da liga (para as faixas, a previsão e o fim da temporada):
// torneios → tabela anual (soma); split → grupos do split em ordem; senão → fase de pontos (com grupos: todos juntos)
export function classificacao(st, E, sorteio) {
  if (E.torneios.length) return tabelaDe(st, E, E.torneios.flatMap((t) => t.pontos), null, sorteio);
  const L = E.liga;
  if (L.split != null && st.grupos[L.split]) return tabelasDoSplit(st, E, L.split, sorteio).flatMap((g) => g.linhas);
  return tabelaDe(st, E, L.pontos, null, sorteio);
}

// ---------- Gerar as rodadas de uma etapa ----------
function calendarioPontos(E, cal) {
  const rng = rngDe(E.semente, "calendario", cal.chave);
  const rodadas = juntar(cal.grupos.map((g) => roundRobin(g.clubes, cal.turnos, rng)));
  rodadas.push(...rodadasExtras(E.clubes, cal.extras, rng));
  return cal.inverter ? rodadas.map((r) => r.map(([a, b]) => [b, a])) : rodadas;
}

function rrGrupos(grupos, turnos, rng) { return juntar(grupos.map((g) => roundRobin(g.clubes, turnos, rng))); }

// Classificados de uma tabela (posições de..ate)
const fatia = (linhas, de, ate) => linhas.slice(de - 1, ate).map((l) => l.k);

// Participantes da 1ª fase de um mata-mata: uma lista por grupo (melhor primeiro)
function semeados(st, E, mg, sorteio) {
  const f = mg.final;
  if (f) {
    let lista = [];
    const anual = classificacao(st, E, sorteio), pos = Object.fromEntries(anual.map((l, i) => [l.k, i]));
    if (f.entre === "lideres_grupos" && f.quad != null) lista = (st.grupos[f.quad] || []).map((g) => tabelaDe(st, E, [f.quad], g.clubes, sorteio)[0]?.k);
    else if (f.entre === "lideres_pontos" && f.gruposPontos) lista = f.gruposPontos.map((g) => tabelaDe(st, E, mg.base.etapas, g.clubes, sorteio)[0]?.k);
    else if (f.entre.startsWith("campeoes_torneios")) {
      lista = E.torneios.map((t) => campeaoDoEscopo(st, E, t, sorteio));
      if (f.entre.endsWith("lider_anual")) lista.push(anual[0]?.k);
    }
    lista = [...new Set(lista.filter(Boolean))].sort((a, b) => pos[a] - pos[b]);
    return [lista];
  }
  if (mg.porGrupo) return mg.base.grupos.map((g) => fatia(tabelaDe(st, E, mg.base.etapas, g.clubes, sorteio), mg.de, mg.ate));
  return [fatia(tabelaDe(st, E, mg.base.etapas, null, sorteio), mg.de, mg.ate)];
}

// Monta os pares de uma fase: sobram "alvo" clubes; os piores jogam (melhor x pior entre eles), os melhores passam direto
function parear(P, alvo, g) {
  const extra = P.length - alvo;
  if (extra <= 0) return { pares: [], passam: P.map((k) => [k, g]) };
  const jogam = P.slice(P.length - 2 * extra), pares = [];
  for (let i = 0; i < extra; i++) pares.push([jogam[i], jogam[jogam.length - 1 - i], g]);
  return { pares, passam: P.slice(0, P.length - 2 * extra).map((k) => [k, g]) };
}

function gerarMata(st, E, e, sorteio) {
  const mg = E.mata[e.mg];
  let listas, rank;
  if (e.s === 0) {
    listas = semeados(st, E, mg, sorteio);
    rank = {};
    listas.forEach((l) => l.forEach((k, i) => { rank[k] = i; }));
  } else {
    const ant = st.chaves[mg.etapas[e.s - 1]];
    rank = ant.rank;
    const vivos = [...ant.vence.map((k, i) => [k, ant.pares[i][2]]), ...ant.passam].filter(([k]) => k);
    const nG = Math.max(1, ...vivos.map(([, g]) => g + 1));
    listas = Array.from({ length: nG }, (_, g) => vivos.filter(([, gg]) => gg === g).map(([k]) => k));
  }
  if (e.cruzado && listas.length > 1) {
    // cruzamento entre grupos: ordem pela classificação geral
    const geral = classificacao(st, E, sorteio), pos = Object.fromEntries(geral.map((l, i) => [l.k, i]));
    const todos = listas.flat().sort((a, b) => pos[a] - pos[b]);
    rank = { ...rank, ...Object.fromEntries(todos.map((k, i) => [k, i])) };
    listas = [todos];
  }
  const pares = [], passam = [];
  listas.forEach((l, g) => {
    const P = [...l].sort((a, b) => rank[a] - rank[b]);
    const r = parear(P, e.alvo, e.cruzado ? 0 : g);
    pares.push(...r.pares); passam.push(...r.passam);
  });
  st.chaves[e.i] = { pares, passam, rank, vence: [] };
  if (e.jogos === "ida_volta") return [pares.map(([a, b]) => [b, a]), pares.map(([a, b]) => [a, b])];
  return [pares.map(([a, b]) => (e.neutro ? [a, b, 1] : [a, b]))];
}

// Gera a etapa que começa na rodada da agenda (se der: as que dependem da tabela esperam as anteriores acabarem)
function gerarEtapa(st, E, e, sorteio) {
  if (e.tipo !== "pontos" && st.resultados.length < e.inicio) return null;
  if (e.tipo === "pontos") {
    st.grupos[e.i] = e.cal.grupos.length > 1 ? e.cal.grupos : null;
    return calendarioPontos(E, e.cal).slice(e.de - 1, e.ate);
  }
  const rng = rngDe(E.semente, "etapa", e.i);
  if (e.tipo === "split") {
    const geral = tabelaDe(st, E, e.base, null, sorteio);
    const grupos = e.fase.grupos.map((g) => ({ nome: g.nome, de: g.de, clubes: fatia(geral, g.de, g.ate) }));
    st.grupos[e.i] = grupos;
    const listas = grupos.map((g, gi) => roundRobin(g.clubes, e.fase.grupos[gi].turnos || 1, rng));
    return padRodadas(juntar(listas), e.rodadas);
  }
  if (e.tipo === "grupos") {
    const f = e.fase, geral = tabelaDe(st, E, e.base, null, sorteio);
    const sel = fatia(geral, f.classificados.de, f.classificados.ate), G = f.grupos || 2;
    let grupos;
    const padrao = /(\d+(?:-\d+)+)\s*\/\s*(\d+(?:-\d+)+)/.exec(f.sorteio || "");
    if (padrao) grupos = [padrao[1], padrao[2]].map((s, gi) => ({ nome: `${f.nome || "Grupo"} ${LETRAS[gi]}`, clubes: s.split("-").map((x) => sel[+x - f.classificados.de]).filter(Boolean) }));
    else {
      // cabeças de chave (os G primeiros), o resto sorteado
      const resto = embaralhar(rng, sel.slice(G));
      grupos = Array.from({ length: G }, (_, gi) => ({ nome: `${f.nome || "Grupo"} ${LETRAS[gi]}`, clubes: [sel[gi], ...resto.filter((_, j) => j % G === gi)].filter(Boolean) }));
    }
    st.grupos[e.i] = grupos;
    return padRodadas(rrGrupos(grupos, f.turnos || 1, rng), e.rodadas);
  }
  if (e.tipo === "mata") return gerarMata(st, E, e, sorteio);
  return null;
}
const padRodadas = (rodadas, n) => Array.from({ length: n }, (_, r) => rodadas[r] || []);

// Garante que a agenda tem a rodada r (gerando a etapa dela, se possível). Devolve os jogos ou null.
export function garantirRodada(st, E, r, sorteio) {
  while (st.agenda.length <= r && st.agenda.length < E.total) {
    const e = E.etapas.find((x) => x.inicio <= st.agenda.length && st.agenda.length < x.inicio + x.rodadas);
    const rodadas = gerarEtapa(st, E, e, sorteio);
    if (!rodadas) return null;
    rodadas.forEach((jogos) => st.agenda.push({ e: e.i, jogos }));
  }
  return st.agenda[r]?.jogos || null;
}

// Depois da última rodada de uma fase de mata-mata: guarda quem passou (pênaltis decididos aqui, para não mudarem depois)
// penaltis(e, i, a, b) = a disputa ({ vence: 0 (a) | 1 (b), placar, cob }, ver penaltis.js) ou um número entre 0 e 1
// (aí a disputa é feita só com as forças, com esse número como semente). A disputa fica em ch.pen[i] = { placar: [a, b], cob }.
export function fecharRodada(st, E, r, forca, penaltis) {
  const e = E.etapas.find((x) => x.inicio <= r && r < x.inicio + x.rodadas);
  if (!e || e.tipo !== "mata" || r !== e.inicio + e.rodadas - 1) return;
  const ch = st.chaves[e.i];
  ch.vence = ch.pares.map(([a, b], i) => vencedorPar(st, E, e, i, a, b, forca, penaltis, ch));
}

// Quem passa num confronto: agregado; empate = melhor campanha (ida e volta com "vantagem", fora da final) ou disputa
// por pênaltis (penaltis.js)
function vencedorPar(st, E, e, i, a, b, forca, penaltis, ch) {
  let ga = 0, gb = 0;
  for (let r = e.inicio; r < e.inicio + e.rodadas; r++) {
    const j = st.resultados[r]?.[i];
    if (!j) return null;
    if (j[0] === a) { ga += j[2]; gb += j[3]; } else { ga += j[3]; gb += j[2]; }
  }
  if (ga !== gb) return ga > gb ? a : b;
  const mg = E.mata[e.mg];
  if (mg.cfg.vantagem === "melhor_campanha" && e.jogos === "ida_volta" && !e.final) return a;
  const x = penaltis(e.i, i, a, b);
  const d = typeof x === "number" ? disputaDoSorteio(x, forca[a] ?? 70, forca[b] ?? 70) : x;
  (ch.pen ??= {})[i] = { placar: d.placar, cob: d.cob };
  return d.vence === 0 ? a : b;
}

// Placar agregado de um confronto, para a tela: { a, b, jogos: [[gc, gf]...], ga, gb, vence, penaltis }
export function confronto(st, E, e, i) {
  const ch = st.chaves[e.i];
  if (!ch) return null;
  const [a, b] = ch.pares[i];
  let ga = 0, gb = 0, jogados = 0;
  const jogos = [];
  for (let r = e.inicio; r < e.inicio + e.rodadas; r++) {
    const j = st.resultados[r]?.[i];
    if (!j) continue;
    jogados++;
    const [x, y] = j[0] === a ? [j[2], j[3]] : [j[3], j[2]];
    ga += x; gb += y; jogos.push([j[0], j[2], j[3]]);
  }
  const vence = ch.vence?.[i] || null;
  return { a, b, ga, gb, jogos, jogados, vence, penaltis: !!vence && ga === gb && !(E.mata[e.mg].cfg.vantagem === "melhor_campanha" && e.jogos === "ida_volta" && !e.final), pen: ch.pen?.[i] || null };
}

// ---------- Campeões ----------
// Vencedor de um mata-mata (null se ainda não acabou). Sem final ("nenhuma"): devolve a lista de quem passou.
export function vencedoresMata(st, E, mgId) {
  const mg = E.mata[mgId], ult = mg.etapas[mg.etapas.length - 1];
  if (ult == null) return [];
  const ch = st.chaves[ult];
  if (!ch || (ch.pares.length && ch.vence.length < ch.pares.length)) return null;
  return [...ch.vence, ...ch.passam.map(([k]) => k)].filter(Boolean);
}
function campeaoDoEscopo(st, E, esc, sorteio) {
  const mgId = esc.matas[esc.matas.length - 1];
  if (mgId != null) { const v = vencedoresMata(st, E, mgId); return v && v.length === 1 ? v[0] : null; }
  if (esc.quad != null) return null;
  const t = tabelaDe(st, E, esc.pontos, null, sorteio);
  return fimDoEscopo(st, E, esc) ? t[0]?.k : null;
}
const fimDoEscopo = (st, E, esc) => {
  const ult = Math.max(...esc.pontos.map((i) => E.etapas[i].inicio + E.etapas[i].rodadas));
  return st.resultados.length >= ult;
};

// Títulos da temporada: [{ nome, k }] (k = null enquanto não definido). Pela regra "campeao" do formato.
export function titulos(st, E, sorteio) {
  const F = E.F, acabou = st.resultados.length >= E.total;
  const cls = () => (acabou ? classificacao(st, E, sorteio)[0]?.k : null);
  const ultimoMata = () => { const L = E.liga; const id = L.matas[L.matas.length - 1]; const v = id != null ? vencedoresMata(st, E, id) : null; return v && v.length === 1 ? v[0] : null; };
  const out = [];
  if (F.campeao === "dois_campeoes") E.torneios.forEach((t) => out.push({ nome: t.nome, k: campeaoDoEscopo(st, E, t, sorteio) }));
  else if (F.campeao === "mata" || F.campeao === "final" || F.campeao === "final_lideres") out.push({ nome: "Campeão", k: ultimoMata() });
  else out.push({ nome: F.campeao === "anual" ? "Campeão (tabela anual)" : "Campeão", k: cls() });
  // Apertura/Clausura dentro da fase de pontos (Argentina): títulos extras
  for (const p of E.partes) if (p.mata != null) { const v = vencedoresMata(st, E, p.mata); out.push({ nome: p.nome, k: v && v.length === 1 ? v[0] : null, extra: true }); }
  return out;
}
