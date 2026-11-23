// Composição das ligas na temporada simulada (public/acesso-rebaixamento.json, carregado em D.ACESSO).
//
// Cada "par" do arquivo diz quem vai de uma liga para outra: { de, para, tipo, n, confirmados, pendentes, modo, regra, playoff }.
//   tipo        "rebaixamento", "acesso" ou "sai" (para = null: o clube deixa o site)
//   confirmados clubes que já se sabe que mudam (aplicados direto)
//   pendentes   vagas em aberto: { vagas, candidatos } (rebaixamento ainda aberto) ou { vagas, playoffs: [[melhor, pior], ...] }
//   modo        "projecao" = a temporada atual ainda está no meio; o site simula a temporada inteira para decidir
//   regra       ex.: "1º e 2º sobem; 3º–6º jogam playoff" (o site lê a faixa "3º–6º")
//   playoff     ex.: "16º da 1ª x 3º da 2ª" (playoff entre as duas ligas)
// Cada pendência é resolvida uma vez por simulação (com a semente) e guardada: "Simular" (padrão) ou "Escolher" (o usuário marca).
import { D } from "../dados.js";
import { rngDe } from "./aleatorio.js";
import { gerarCalendario } from "./calendario.js";
import { sortearPlacar } from "./motor.js";
import { disputaDoSorteio } from "./penaltis.js";
import { temporadaRapida } from "./tabela.js";
import { escalarClube } from "./escalar.js";
import { terminarAtual, dataAtual } from "./atual.js";
import { formatoDa } from "./formatos.js";

// ---------- Temporada e nomes ----------
// Liga de ano fechado ("2026") simula "2027"; liga de duas metades ("26/27") simula "2027/28"
export const temporadaSim = (lg) => (D.LG[lg]?.cal ? "2027" : "2027/28");
export const temporadaAtual = (lg) => { const s = D.LG[lg]?.season || ""; return /^\d{2}\/\d{2}$/.test(s) ? "20" + s.slice(0, 2) + "/" + s.slice(3) : s; };
// O "rotulo" de formatos-ligas.json tem prioridade (ex.: "Liga MX 2027/28", "MLS 2027 (Sprint Season)")
export const rotuloLiga = (lg) => (D.FORMATOS?.[lg]?.rotulo) || `${D.LG[lg]?.n || lg} ${temporadaSim(lg)}`;
const nome = (k) => D.CL[k]?.n || k;

export const pares = () => D.ACESSO?.pares || [];
export const idPar = (par) => `${par.de}>${par.para || "fora"}`;
export const temPendencia = (par) => !!(par.pendentes || par.modo === "projecao");
const parOposto = (par) => pares().find((p) => p.de === par.para && p.para === par.de);

// Quantos clubes o usuário marca no "Escolher"
export function vagasDaPendencia(par) {
  if (par.pendentes?.playoffs) return par.pendentes.playoffs.length;
  if (par.pendentes) return par.pendentes.vagas;
  return par.n;
}
// Clubes que podem ser marcados no "Escolher"
export function opcoesDaPendencia(par) {
  if (par.pendentes?.candidatos) return par.pendentes.candidatos.filter((k) => D.CL[k]);
  if (par.pendentes?.playoffs) return par.pendentes.playoffs.flat().filter((k) => D.CL[k]);
  return D.CLUBS.filter((c) => c.lg === par.de && !(par.confirmados || []).includes(c.k)).map((c) => c.k);
}

// Lê uma faixa de posições num texto: "3º–6º" → [3, 6]
const faixaNoTexto = (t) => { const m = /(\d+)\s*º\s*[–-]\s*(\d+)\s*º/.exec(t || ""); return m ? [+m[1], +m[2]] : null; };
const posicaoNoTexto = (t, re) => { const m = re.exec(t || ""); return m ? +m[1] : null; };

// ---------- Mata-mata ----------
// Ida e volta: o pior colocado (b) joga a ida em casa; o melhor (a) decide em casa. Empate no agregado: passa o melhor.
function idaEVolta(rng, a, b, forca) {
  const [x1, y1] = sortearPlacar(rng, forca(b), forca(a));
  const [x2, y2] = sortearPlacar(rng, forca(a), forca(b));
  const ga = y1 + x2, gb = x1 + y2;
  const vence = ga >= gb ? a : b;
  return { vence, texto: `${nome(b)} ${x1}×${y1} ${nome(a)} · ${nome(a)} ${x2}×${y2} ${nome(b)} → ${nome(vence)}` };
}
// Jogo único na casa do melhor colocado (a); empate: passa o melhor
function jogoUnico(rng, a, b, forca) {
  const [x, y] = sortearPlacar(rng, forca(a), forca(b));
  const vence = x >= y ? a : b;
  return { vence, texto: `${nome(a)} ${x}×${y} ${nome(b)} → ${nome(vence)}` };
}
// Final em campo neutro; empate: disputa por pênaltis
function finalNeutra(rng, a, b, forca) {
  const [x, y] = sortearPlacar(rng, forca(a), forca(b), true);
  const d = x === y ? disputaDoSorteio(rng(), forca(a), forca(b)) : null;
  const vence = x > y ? a : x < y ? b : d.vence === 0 ? a : b;
  return { vence, texto: `Final: ${nome(a)} ${x}×${y} ${nome(b)}${d ? ` (${d.placar[0]}×${d.placar[1]} nos pênaltis)` : ""} → ${nome(vence)}` };
}
// Playoff entre clubes da mesma liga, já em ordem de classificação (melhor primeiro).
// Se não for potência de 2, os piores jogam antes um jogo único; depois, ida e volta; a final é única, em campo neutro.
export function playoffInterno(rng, seeds, forca) {
  let vivos = [...seeds];
  const textos = [];
  while (vivos.length > 1 && (vivos.length & (vivos.length - 1))) {
    const p2 = 2 ** Math.floor(Math.log2(vivos.length)), extra = vivos.length - p2;
    const fixos = vivos.slice(0, vivos.length - 2 * extra), jogam = vivos.slice(vivos.length - 2 * extra);
    const vencedores = [];
    for (let i = 0; i < extra; i++) { const r = jogoUnico(rng, jogam[i], jogam[jogam.length - 1 - i], forca); vencedores.push(r.vence); textos.push(r.texto); }
    vivos = [...fixos, ...vencedores];
  }
  while (vivos.length > 2) {
    const prox = [];
    for (let i = 0; i < vivos.length / 2; i++) { const r = idaEVolta(rng, vivos[i], vivos[vivos.length - 1 - i], forca); prox.push(r.vence); textos.push(r.texto); }
    vivos = prox;
  }
  if (vivos.length === 2) { const r = finalNeutra(rng, vivos[0], vivos[1], forca); textos.push(r.texto); return { vence: r.vence, textos }; }
  return { vence: vivos[0], textos };
}

// ---------- Contexto de uma resolução (força dos clubes e tabelas projetadas, calculadas uma vez) ----------
function novoContexto(semente, escolhas) {
  const forcas = {}, tabelas = {}, inter = {};
  const ctx = {
    semente, escolhas,
    // Força com o elenco atual (a temporada atual é jogada com os elencos de hoje)
    forca: (k) => (forcas[k] ??= escalarClube(k, D.CL[k].lg).forca),
    // Temporada atual terminada (só placares, sem gravar estatísticas): chaves na ordem final.
    // Com a tabela real (temporada-atual.json): parte dela e joga só o que falta. Sem ela: a temporada inteira do zero.
    linhas: (lg) => {
      if (tabelas[lg]) return tabelas[lg];
      const real = terminarAtual(lg, rngDe(semente, "projecao", lg), ctx.forca);
      if (real) return (tabelas[lg] = real);
      const clubes = D.CLUBS.filter((c) => c.lg === lg).map((c) => c.k);
      const forca = Object.fromEntries(clubes.map((k) => [k, ctx.forca(k)]));
      return (tabelas[lg] = temporadaRapida(rngDe(semente, "projecao", lg), clubes, forca, gerarCalendario(clubes)).map((k) => ({ k })));
    },
    tabela: (lg) => ctx.linhas(lg).map((l) => l.k),
    // Playoff entre a 1ª e a 2ª divisão (ex.: 16º da Bundesliga x 3º da 2. Bundesliga), resolvido uma vez para os dois pares
    interliga: (cima, baixo) => (inter[cima + ">" + baixo] ??= playoffEntreLigas(ctx, cima, baixo)),
  };
  return ctx;
}

// Os dois pares de um playoff entre ligas precisam estar em "Simular"
const simulando = (ctx, par) => (ctx.escolhas[idPar(par)]?.modo || "simular") === "simular";

function playoffEntreLigas(ctx, cima, baixo) {
  const desce = pares().find((p) => p.de === cima && p.para === baixo), sobe = pares().find((p) => p.de === baixo && p.para === cima);
  if (!desce?.playoff || !sobe || !simulando(ctx, desce) || !simulando(ctx, sobe)) return null;
  const tabCima = ctx.tabela(cima), tabBaixo = ctx.tabela(baixo);
  const posCima = posicaoNoTexto(desce.playoff, /(\d+)\s*º\s*da\s*1/);
  if (!posCima || !tabCima[posCima - 1]) return null;
  const rng = rngDe(ctx.semente, "interliga", cima);
  const textos = [];
  // Desafiante da liga de baixo: o vencedor de um playoff interno ("3º–5º") ou a posição indicada ("3º")
  let desafiante;
  const faixa = faixaNoTexto(sobe.playoff);
  if (faixa) {
    const r = playoffInterno(rng, tabBaixo.slice(faixa[0] - 1, faixa[1]), ctx.forca);
    desafiante = r.vence;
    textos.push(...r.textos);
  } else {
    const p = posicaoNoTexto(sobe.playoff, /(\d+)\s*º/);
    desafiante = p && tabBaixo[p - 1];
  }
  if (!desafiante) return null;
  const doCima = tabCima[posCima - 1];
  const r = idaEVolta(rng, doCima, desafiante, ctx.forca);
  textos.push(r.texto);
  return { doCima, desafiante, desafianteSobe: r.vence === desafiante, textos };
}

// Resultado do "Simular" para um par: { movem: [k], detalhe: [textos], projecao }
function simularPar(par, ctx) {
  const rng = rngDe(ctx.semente, "par", idPar(par));
  const pend = par.pendentes;
  // Rebaixamento ainda aberto, com a tabela real da liga: termina a temporada (só os jogos que faltam) e caem os últimos
  if (pend?.candidatos && D.ATUAL?.[par.de]) {
    const tab = ctx.tabela(par.de), conf = new Set(par.confirmados || []);
    const zona = tab.slice(-(pend.vagas + conf.size)).filter((k) => !conf.has(k));
    const movem = zona.slice(-pend.vagas);
    const pos = (k) => tab.indexOf(k) + 1 + "º";
    return { movem, detalhe: [`Projeção a partir da tabela real de ${dataBr(dataAtual())} (${temporadaAtual(par.de)}): caem ${[...conf, ...movem].map((k) => `${nome(k)} (${pos(k)})`).join(", ")}.`], projecao: true };
  }
  // Rebaixamento ainda aberto (sem tabela real): sorteio entre os candidatos, com mais chance para os mais fracos e
  // para quem está mais perto da zona (os candidatos vêm em ordem de risco)
  if (pend?.candidatos) {
    const cand = pend.candidatos.filter((k) => D.CL[k]);
    const F = cand.map(ctx.forca), media = F.reduce((s, x) => s + x, 0) / (F.length || 1);
    const pesos = cand.map((k, i) => (cand.length - i) * Math.exp(0.15 * (media - F[i])));
    const movem = [];
    for (let v = 0; v < Math.min(pend.vagas, cand.length); v++) {
      let r = rng() * pesos.reduce((s, w) => s + w, 0), i = 0;
      while (i < pesos.length - 1 && (r -= pesos[i]) >= 0) i++;
      movem.push(cand[i]);
      pesos[i] = 0;
    }
    return { movem, detalhe: ["Sorteio entre " + cand.map(nome).join(", ") + ", com mais chance para os mais fracos."], projecao: false };
  }
  // Playoffs de acesso (ida e volta; o primeiro de cada par é o melhor colocado)
  if (pend?.playoffs) {
    const movem = [], detalhe = [];
    for (const [a, b] of pend.playoffs) {
      if (!D.CL[a] || !D.CL[b]) continue;
      const r = idaEVolta(rng, a, b, ctx.forca);
      movem.push(r.vence);
      detalhe.push(r.texto);
    }
    return { movem, detalhe, projecao: false };
  }
  // Projeção: simula a temporada atual inteira da liga de origem
  if (par.modo === "projecao") {
    const tab = ctx.tabela(par.de), n = par.n, detalhe = [];
    const cima = par.tipo === "acesso" ? par.para : par.de, baixo = par.tipo === "acesso" ? par.de : par.para;
    const inter = par.para ? ctx.interliga(cima, baixo) : null;
    let movem;
    if (par.tipo === "acesso") {
      const faixa = !par.playoff && faixaNoTexto(par.regra);
      if (faixa) {
        // "1º e 2º sobem; 3º–6º playoff": sobem os n − 1 primeiros e o vencedor do playoff
        movem = tab.slice(0, n - 1);
        const r = playoffInterno(rng, tab.slice(faixa[0] - 1, faixa[1]), ctx.forca);
        movem.push(r.vence);
        detalhe.push(...r.textos.map((t) => "Playoff: " + t));
      } else {
        movem = tab.slice(0, n);
        if (inter?.desafianteSobe) movem.push(inter.desafiante);
      }
    } else {
      movem = tab.slice(-n);
      if (inter?.desafianteSobe) movem.unshift(inter.doCima);
    }
    if (inter && par.playoff) detalhe.push(...inter.textos.map((t) => "Playoff entre as ligas: " + t));
    const pos = (k) => tab.indexOf(k) + 1 + "º";
    detalhe.unshift(`Projeção da temporada ${temporadaAtual(par.de)} (${D.LG[par.de]?.n}): ` + movem.map((k) => `${nome(k)} (${pos(k)})`).join(", ") + ".");
    return { movem, detalhe, projecao: true };
  }
  return { movem: [], detalhe: [], projecao: false };
}

// Resolve um par: "simular" (padrão) ou "escolher" (o usuário marca; o que faltar marcar sai da simulação)
function resolverPar(par, ctx) {
  const esc = ctx.escolhas[idPar(par)];
  const sim = simularPar(par, ctx);
  if (esc?.modo !== "escolher") return { modo: "simular", ...sim };
  const vagas = vagasDaPendencia(par), validos = new Set(opcoesDaPendencia(par));
  let sel = (esc.sel || []).filter((k) => validos.has(k));
  if (par.pendentes?.playoffs) sel = par.pendentes.playoffs.map(([a, b]) => sel.find((k) => k === a || k === b)).filter(Boolean);
  sel = sel.slice(0, vagas);
  const faltam = vagas - sel.length;
  if (faltam > 0) {
    // completa com o resultado da simulação (no playoff, o vencedor simulado de cada confronto ainda sem escolha)
    if (par.pendentes?.playoffs) par.pendentes.playoffs.forEach(([a, b], i) => { if (!sel.some((k) => k === a || k === b)) sel.push(sim.movem[i]); });
    else for (const k of sim.movem) if (sel.length < vagas && !sel.includes(k)) sel.push(k);
    for (const k of validos) if (sel.length < vagas && !sel.includes(k)) sel.push(k);
  }
  return { modo: "escolher", movem: sel.filter(Boolean), detalhe: faltam > 0 ? ["Faltou marcar " + faltam + "; o resto veio da simulação."] : [], projecao: false, incompleto: faltam > 0 };
}

// Contexto de projeção compartilhado (composição e copas usam as mesmas tabelas projetadas)
export const contextoProjecao = (semente, escolhas = {}) => novoContexto(semente, escolhas);

// Resolve as pendências dos pares que mexem nas ligas indicadas. escolhas = { "<id do par>": { modo, sel } }
export function resolverPendencias(ligas, semente, escolhas = {}, contexto = null) {
  const ctx = contexto || novoContexto(semente, escolhas), out = {};
  for (const par of pares())
    if (temPendencia(par) && (ligas.includes(par.de) || ligas.includes(par.para))) out[idPar(par)] = resolverPar(par, ctx);
  return out;
}

// Tabela atual terminada de uma liga (a mesma usada nas projeções, com a mesma semente): linhas com os pontos finais
export function projecaoAtual(lg, semente, contexto = null) {
  if (!D.ATUAL?.[lg]) return null;
  return (contexto || novoContexto(semente, {})).linhas(lg);
}
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : iso || "hoje");

// ---------- Composição ----------
// Quem muda num par: os confirmados + o que foi resolvido nas pendências
export const movimentos = (par, resolvidas) => [...(par.confirmados || []).filter((k) => D.CL[k]), ...(resolvidas[idPar(par)]?.movem || [])];

// Em que liga o clube joga na temporada simulada (null = deixou o site)
export function ligaNaTemporada(k, resolvidas) {
  const lg = D.CL[k]?.lg;
  for (const par of pares()) if (par.de === lg && movimentos(par, resolvidas).includes(k)) return par.para;
  return lg;
}

// Clubes da liga na temporada simulada: { lg, clubes, entram: [{k, de, tipo, confirmado, projecao}], saem: [{k, para, tipo, ...}] }
export function comporLiga(lg, resolvidas) {
  const saem = [], entram = [];
  for (const par of pares()) {
    if (par.de !== lg && par.para !== lg) continue;
    const conf = new Set(par.confirmados || []), r = resolvidas[idPar(par)];
    for (const k of movimentos(par, resolvidas)) {
      const info = { k, de: par.de, para: par.para, tipo: par.tipo, confirmado: conf.has(k), projecao: !conf.has(k) && !!r?.projecao, escolhido: !conf.has(k) && r?.modo === "escolher" };
      if (par.de === lg) saem.push(info);
      if (par.para === lg) entram.push(info);
    }
  }
  const sai = new Set(saem.map((x) => x.k));
  const clubes = D.CLUBS.filter((c) => c.lg === lg && !sai.has(c.k)).map((c) => c.k);
  for (const x of entram) if (!clubes.includes(x.k)) clubes.push(x.k);
  return { lg, clubes, entram, saem };
}

// ---------- Faixas da tabela ----------
// zonas-ligas.json (faixas da liga, ou "_padrao") + acesso/rebaixamento dos pares (o que o arquivo de faixas não cobre).
// Devolve uma lista do tamanho da liga: em cada posição, { nome, cor, tipo } ou null. tipo: "faixa", "acesso",
// "playoff-acesso", "queda" ou "playoff-queda".
export const COR_QUEDA = "#c93a2e", COR_PLAYOFF_QUEDA = "#e8833a", COR_ACESSO = "#1a7f37", COR_PLAYOFF_ACESSO = "#4caf50";
export function zonasDaLiga(lg, n) {
  const z = Array(n).fill(null);
  const pinta = (de, ate, zona) => { for (let p = Math.max(1, de); p <= Math.min(n, ate); p++) if (!z[p - 1]) z[p - 1] = zona; };
  const doArquivo = D.ZONAS?.[lg];
  (doArquivo || []).forEach((x) => pinta(x.de, x.ate, { nome: x.nome, cor: x.cor, tipo: "faixa" }));
  let temAcesso = false;
  for (const par of pares()) {
    if (par.de !== lg) continue;
    if (par.tipo === "acesso") {
      temAcesso = true;
      const faixa = !par.playoff && faixaNoTexto(par.regra);
      if (faixa) {
        pinta(1, par.n - 1, { nome: "Acesso", cor: COR_ACESSO, tipo: "acesso" });
        pinta(faixa[0], faixa[1], { nome: "Playoff de acesso", cor: COR_PLAYOFF_ACESSO, tipo: "playoff-acesso" });
      } else {
        pinta(1, par.n, { nome: "Acesso", cor: COR_ACESSO, tipo: "acesso" });
        const f2 = faixaNoTexto(par.playoff), p = posicaoNoTexto(par.playoff, /(\d+)\s*º/);
        if (f2) pinta(f2[0], f2[1], { nome: "Playoff de acesso", cor: COR_PLAYOFF_ACESSO, tipo: "playoff-acesso" });
        else if (par.playoff && p) pinta(p, p, { nome: "Playoff de acesso", cor: COR_PLAYOFF_ACESSO, tipo: "playoff-acesso" });
      }
    } else {
      const nomeZona = par.tipo === "sai" ? "Rebaixamento (sai do site)" : "Rebaixamento";
      pinta(n - par.n + 1, n, { nome: nomeZona, cor: COR_QUEDA, tipo: "queda" });
      const p = posicaoNoTexto(par.playoff, /(\d+)\s*º\s*da\s*1/);
      if (p) pinta(p, p, { nome: "Playoff de rebaixamento", cor: COR_PLAYOFF_QUEDA, tipo: "playoff-queda" });
    }
  }
  // Rebaixamento definido pelo formato da liga (quando não há par no arquivo de acesso/rebaixamento)
  const reb = formatoDa(lg).rebaixamento;
  if (reb?.n && !pares().some((p) => p.de === lg && p.tipo !== "acesso"))
    pinta(n - reb.n + 1, n, { nome: reb.fora_do_site ? "Rebaixamento (fora do site)" : "Rebaixamento", cor: COR_QUEDA, tipo: "queda" });
  if (!doArquivo && !temAcesso) (D.ZONAS?._padrao || [{ de: 1, ate: 1, nome: "Campeão", cor: COR_ACESSO }]).forEach((x) => pinta(x.de, x.ate, { nome: x.nome, cor: x.cor, tipo: "faixa" }));
  return z;
}
