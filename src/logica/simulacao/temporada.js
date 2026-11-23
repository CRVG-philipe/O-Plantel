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
//   estatisticas         { "<id do jogador>": [jogos, gols, assistências, soma das notas × 10, clube] }
//   previsao             { "<clube>": { pos, titulo, queda, acesso } } (300 temporadas rápidas)
//   assinatura           "impressão digital" do plano quando a temporada começou (para avisar que o elenco mudou)
import { D } from "../dados.js";
import { FORMS } from "../constantes.js";
import { compatibilidade } from "../compatibilidade.js";
import { misturar, novaSemente, rngDe } from "./aleatorio.js";
import { jogarPartida, sortearPlacar } from "./motor.js";
import { escalarClube, escalarPlano, idsDoPlano } from "./escalar.js";
import { comporLiga, ligaNaTemporada, projecaoAtual, resolverPendencias, rotuloLiga, zonasDaLiga } from "./composicao.js";
import { classificacao, confronto, esqueletoDe, fecharRodada, garantirRodada, tabelaDe, tabelasDoSplit, titulos } from "./formatos.js";

export const VERSAO = 2;
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
  // Tabela real de hoje da liga do clube e como ela termina (a mesma projeção usada nas vagas de acesso/rebaixamento)
  const proj = projecaoAtual(L0, semente);
  const atual = proj ? { lg: L0, linhas: proj.map((l) => [l.k, l.pts, l.j]) } : null;
  return { liga: lg, composicao, pendenciasResolvidas: resolvidas, avisos, atual };
}

// Times da temporada: o seu pelo plano; os outros pelo elenco atual (sem quem o seu plano contratou)
export function montarTimes(plano, clubes, lg) {
  const fora = idsDoPlano(plano), times = {};
  for (const k of clubes) times[k] = k === plano.club ? escalarPlano(plano) : escalarClube(k, lg, fora);
  return times;
}

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

// Estado novo (antes da 1ª rodada), já com a previsão
export function criarEstado(plano, { semente = novaSemente(), escolhas = {}, substitui = null } = {}) {
  const prep = prepararTemporada(plano, semente, escolhas, substitui);
  const estado = {
    v: VERSAO, semente, rodadaAtual: 0, liga: prep.liga, composicao: prep.composicao, pendenciasResolvidas: prep.pendenciasResolvidas,
    escolhas, substitui, avisos: prep.avisos, atual: prep.atual, agenda: [], chaves: {}, grupos: {}, resultados: [], estatisticas: {},
    assinatura: assinaturaDoPlano(plano),
  };
  estado.previsao = calcularPrevisao(estado, montarTimes(plano, estado.composicao.clubes, estado.liga));
  return estado;
}

// ---------- Simular ----------
// Joga as rodadas até "ate" (sem passar do fim). Cada jogo tem a sua própria semente (semente + rodada + jogo),
// então simular rodada a rodada ou tudo de uma vez dá o mesmo resultado. Devolve um estado novo.
export function simularAte(estado, plano, ate) {
  const E = esqueleto(estado), fim = Math.min(ate, E.total);
  if (estado.rodadaAtual >= fim) return estado;
  const novo = { ...estado, ...copiaSt(estado), resultados: [...estado.resultados], estatisticas: { ...estado.estatisticas } };
  const times = montarTimes(plano, estado.composicao.clubes, estado.liga);
  const forca = Object.fromEntries(Object.entries(times).map(([k, t]) => [k, t.forca]));
  const sorteio = sorteioDe(estado), penaltis = (e, i) => rngDe(estado.semente, "penaltis", e, i)();
  for (let r = estado.rodadaAtual; r < fim; r++) {
    const jogos = garantirRodada(novo, E, r, sorteio);
    if (!jogos) break;
    novo.resultados.push(jogos.map(([c, f, neutro], i) => {
      const jogo = jogarPartida(rngDe(estado.semente, r, i), times[c], times[f], !!neutro);
      for (const [id, lado, g, a, nota] of jogo.jogadores) {
        const s = novo.estatisticas[id] ? [...novo.estatisticas[id]] : [0, 0, 0, 0, lado ? f : c];
        s[0]++; s[1] += g; s[2] += a; s[3] += Math.round(nota * 10);
        novo.estatisticas[id] = s;
      }
      // Jogos do seu clube guardam também as substituições (para o jogo ao vivo)
      return c === plano.club || f === plano.club ? [c, f, jogo.gc, jogo.gf, jogo.eventos, jogo.subs] : [c, f, jogo.gc, jogo.gf, jogo.eventos];
    }));
    fecharRodada(novo, E, r, forca, penaltis);
    novo.rodadaAtual = r + 1;
  }
  return novo;
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
// Narração minuto a minuto de um jogo já simulado (rodada r, jogo i): gols e substituições (salvos) e lances que
// não viraram gol (finalização para fora, defesa do goleiro, bola na trave), sorteados com a semente do jogo, então
// o mesmo jogo tem sempre a mesma narração. Devolve [{ min, tipo: "gol"|"sub"|"chance", lado, ... }] em ordem.
const TIPOS_CHANCE = [["fora", 0.45], ["defesa", 0.35], ["trave", 0.2]];
export function narracao(estado, plano, r, i) {
  const jogo = estado.resultados[r]?.[i];
  if (!jogo) return [];
  const [c, f, , , eventos, subs = []] = jogo;
  const lances = [];
  for (const [min, lado, autor, assist] of eventos) lances.push({ min, tipo: "gol", lado, autor, assist });
  for (const [min, lado, sai, entra] of subs) lances.push({ min, tipo: "sub", lado, sai, entra });
  // Quem está em campo em cada minuto (titulares e quem entrou), para escolher quem finaliza
  const fora = idsDoPlano(plano);
  const times = [c, f].map((k) => (k === plano.club ? escalarPlano(plano) : escalarClube(k, estado.liga, fora)));
  const emCampo = (lado, min) => {
    const s = subs.filter((x) => x[1] === lado && x[0] <= min);
    const saiu = new Set(s.map((x) => x[2]));
    return [...times[lado].onze.map((x) => x.p).filter((p) => p && !saiu.has(p.id)), ...s.map((x) => D.BYID[x[3]] || (plano.custom || []).find((p) => p.id === x[3]))].filter((p) => p && p.pos !== "GOL");
  };
  const rng = rngDe(estado.semente, "lances", r, i);
  [0, 1].forEach((lado) => {
    const n = 2 + Math.floor(rng() * 5) + Math.round((times[lado].forca - times[1 - lado].forca) / 6);
    for (let k = 0; k < Math.max(1, n); k++) {
      const min = 1 + Math.floor(rng() * 90);
      const ps = emCampo(lado, min);
      if (!ps.length) continue;
      const p = ps[Math.floor(rng() * ps.length)];
      let x = rng(), tipo = "fora";
      for (const [t, w] of TIPOS_CHANCE) { if ((x -= w) < 0) { tipo = t; break; } }
      lances.push({ min, tipo: "chance", lado, autor: p.id, como: tipo });
    }
  });
  const ordem = { chance: 0, sub: 1, gol: 2 };
  return lances.sort((a, b) => a.min - b.min || ordem[a.tipo] - ordem[b.tipo]);
}

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

// ---------- Estatísticas ----------
// Jogador pelo id (da base ou criado no plano)
export const jogadorSim = (plano, id) => D.BYID[id] || (plano.custom || []).find((c) => c.id === id) || null;
// Linhas de estatística: [{ p, k, j, g, a, nota }]
export function linhasEstatisticas(estado, plano) {
  return Object.entries(estado.estatisticas).map(([id, [j, g, a, s, k]]) => ({ p: jogadorSim(plano, id), id, k, j, g, a, nota: j ? s / 10 / j : 0 })).filter((x) => x.p);
}
// Mínimo de jogos para entrar em "melhores notas" e na seleção: 30% dos jogos de quem mais jogou
// (com playoffs, nem todo clube joga todas as rodadas)
export const minimoJogos = (estado) => Math.max(1, Math.ceil(Math.max(0, ...Object.values(estado.estatisticas).map((s) => s[0])) * 0.3));

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
