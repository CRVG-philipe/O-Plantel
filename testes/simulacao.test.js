// Testes do simulador da temporada (src/logica/simulacao/): calendário, motor, composição, semente e desempenho.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { mulberry32, rngDe } from "../src/logica/simulacao/aleatorio.js";
import { gerarCalendario } from "../src/logica/simulacao/calendario.js";
import { calcularForca, jogarPartida, lambdas, sortearPlacar } from "../src/logica/simulacao/motor.js";
import { escalarClube, escalarPlano } from "../src/logica/simulacao/escalar.js";
import { comporLiga, ligaNaTemporada, projecaoAtual, resolverPendencias, rotuloLiga, zonasDaLiga } from "../src/logica/simulacao/composicao.js";
import { classificacao, fecharRodada, garantirRodada, montarEsqueleto, titulos } from "../src/logica/simulacao/formatos.js";
import { campeaoDe, criarEstado, datasDe, esqCopa, jogarProximoJogo, montarTimes, narracao, simularAte, tabelaAtual, totalRodadas } from "../src/logica/simulacao/temporada.js";
import { finaisPendentes } from "../src/logica/simulacao/copas.js";
import { novoPlano } from "../src/logica/elenco.js";
import { escalarSozinho } from "../src/logica/escalacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const clubesDa = (lg) => D.CLUBS.filter((c) => c.lg === lg).map((c) => c.k);
const porNome = (lg, nome) => D.CLUBS.find((c) => c.lg === lg && c.n === nome)?.k;
const planoDe = (k) => { const P = novoPlano(k); escalarSozinho(P, "o"); return P; };

test("rótulo da temporada: o de formatos-ligas.json tem prioridade", () => {
  expect(rotuloLiga("BRA")).toBe("Brasileirão 2027");
  expect(rotuloLiga("ENG")).toBe("Premier League 2027/28");
  expect(rotuloLiga("MEX")).toBe("Liga MX 2027/28");
  expect(rotuloLiga("USA")).toBe("MLS 2027 (Sprint Season)");
  // Sem o arquivo de formatos: a regra antiga ("2026" → 2027; "26/27" → 2027/28)
  const F = D.FORMATOS;
  D.FORMATOS = null;
  expect(rotuloLiga("BRA")).toBe(D.LG.BRA.n + " 2027");
  expect(rotuloLiga("ENG")).toBe(D.LG.ENG.n + " 2027/28");
  D.FORMATOS = F;
});

// Temporada inteira de uma liga só com placares, pelo motor de formatos (como na previsão)
function temporadaRapidaFormato(lg, semente = 1) {
  const clubes = clubesDa(lg), E = montarEsqueleto(lg, clubes, semente);
  const forca = Object.fromEntries(clubes.map((k) => [k, escalarClube(k, lg).forca]));
  const rng = mulberry32(semente), st = { agenda: [], chaves: {}, grupos: {}, resultados: [] };
  const sorteio = Object.fromEntries(clubes.map((k, i) => [k, i]));
  for (let r = 0; r < E.total; r++) {
    const jogos = garantirRodada(st, E, r, sorteio);
    if (!jogos) throw new Error(`${lg}: rodada ${r + 1} sem jogos definidos`);
    st.resultados.push(jogos.map(([c, f, n]) => { const [a, b] = sortearPlacar(rng, forca[c], forca[f], !!n); return [c, f, a, b]; }));
    fecharRodada(st, E, r, forca, () => rng());
  }
  return { E, st, sorteio };
}
const jogosNasEtapas = (E, st, tipo) => {
  const j = {};
  E.etapas.filter((e) => e.tipo === tipo).forEach((e) => { for (let r = e.inicio; r < e.inicio + e.rodadas; r++) for (const [c, f] of st.resultados[r]) { j[c] = (j[c] || 0) + 1; j[f] = (j[f] || 0) + 1; } });
  return j;
};

test("formatos: todas as 66 ligas terminam a temporada, com 1 campeão (2 nas ligas com dois campeões)", () => {
  const ligas = Object.keys(D.FORMATOS);
  expect(ligas.length).toBe(66);
  for (const lg of ligas) {
    const { E, st, sorteio } = temporadaRapidaFormato(lg, 7);
    expect(st.resultados.length).toBe(E.total);
    const t = titulos(st, E, sorteio).filter((x) => !x.extra);
    expect(t.length, lg).toBe(D.FORMATOS[lg].campeao === "dois_campeoes" ? 2 : 1);
    t.forEach((x) => expect(x.k, lg + " " + x.nome).toBeTruthy());
    // Na fase de pontos, todo clube do mesmo grupo joga o mesmo número de jogos
    const j = jogosNasEtapas(E, st, "pontos");
    const grupos = E.liga.grupos || (E.torneios.length ? null : [{ clubes: E.clubes }]);
    (grupos || []).forEach((g) => expect(new Set(g.clubes.map((k) => j[k])).size, lg).toBe(1));
    expect(classificacao(st, E, sorteio).length).toBe(E.clubes.length);
  }
});

test("formatos: Argentina 30 jogos (Apertura e Clausura com playoffs), Escócia 33 + 5 do split, MLS 14 por conferência", () => {
  const arg = temporadaRapidaFormato("ARG");
  const ja = jogosNasEtapas(arg.E, arg.st, "pontos");
  expect(Object.values(ja).every((n) => n === 30)).toBe(true);
  expect(arg.E.partes.map((p) => p.nome)).toEqual(["Apertura 2027", "Clausura 2027"]);
  expect(titulos(arg.st, arg.E, arg.sorteio).filter((x) => x.extra).every((x) => x.k)).toBe(true); // campeões do Apertura e do Clausura
  const sco = temporadaRapidaFormato("SCO");
  expect(Object.values(jogosNasEtapas(sco.E, sco.st, "pontos")).every((n) => n === 33)).toBe(true);
  expect(Object.values(jogosNasEtapas(sco.E, sco.st, "split")).every((n) => n === 5)).toBe(true);
  // Split: os 6 primeiros da fase de pontos formam o grupo do título e terminam em 1º a 6º
  const split = sco.st.grupos[sco.E.liga.split];
  expect(split.map((g) => g.clubes.length)).toEqual([6, 6]);
  expect(classificacao(sco.st, sco.E, sco.sorteio).slice(0, 6).map((l) => l.k).sort()).toEqual([...split[0].clubes].sort());
  const mls = temporadaRapidaFormato("USA");
  expect(Object.values(jogosNasEtapas(mls.E, mls.st, "pontos")).every((n) => n === 14)).toBe(true);
  expect(mls.E.liga.grupos.map((g) => g.nome)).toEqual(["Leste", "Oeste"]);
  // Liga MX: dois campeões (Apertura e Clausura), cada torneio com 17 rodadas e mando invertido no Clausura
  const mex = temporadaRapidaFormato("MEX");
  const ap = mex.E.etapas[mex.E.torneios[0].pontos[0]], cl = mex.E.etapas[mex.E.torneios[1].pontos[0]];
  expect(ap.rodadas).toBe(17);
  const jogosAp = mex.st.agenda[ap.inicio].jogos, jogosCl = mex.st.agenda[cl.inicio].jogos;
  expect(jogosCl).toEqual(jogosAp.map(([a, b]) => [b, a]));
});

test("mata-mata ida e volta com 'vantagem: melhor_campanha': empate no agregado classifica o melhor colocado", () => {
  const clubes = clubesDa("BRB"), E = montarEsqueleto("BRB", clubes, 3);
  const st = { agenda: [], chaves: {}, grupos: {}, resultados: [] }, sorteio = Object.fromEntries(clubes.map((k, i) => [k, i]));
  const mata = E.etapas.find((e) => e.tipo === "mata");
  expect(mata.jogos).toBe("ida_volta");
  for (let r = 0; r < mata.inicio; r++) { st.resultados.push(garantirRodada(st, E, r, sorteio).map(([c, f]) => [c, f, 1, 0])); fecharRodada(st, E, r, {}, () => 0); }
  const ida = garantirRodada(st, E, mata.inicio, sorteio), volta = garantirRodada(st, E, mata.inicio + 1, sorteio);
  const pares = st.chaves[mata.i].pares;
  expect(pares.length).toBe(2);
  st.resultados.push(ida.map(([c, f]) => [c, f, 2, 1])); // o pior colocado vence a ida em casa por 2 x 1
  st.resultados.push(volta.map(([c, f]) => [c, f, 1, 0])); // o melhor vence a volta por 1 x 0: agregado 2 x 2
  fecharRodada(st, E, mata.inicio + 1, {}, () => 0.99); // "pênaltis" desfavoráveis ao melhor não podem contar
  expect(st.chaves[mata.i].vence).toEqual(pares.map(([a]) => a));
});

test("temporada atual real: Brasileirão termina com 38 jogos, ninguém perde pontos e a Chapecoense cai", () => {
  for (const semente of [1, 2, 3]) {
    const proj = projecaoAtual("BRA", semente);
    const real = Object.fromEntries(D.ATUAL.BRA.tabela.map((r) => [r.k, r.pts]));
    expect(proj.length).toBe(20);
    proj.forEach((l) => { expect(l.j).toBe(38); expect(l.pts).toBeGreaterThanOrEqual(real[l.k]); });
    expect(proj.slice(-4).map((l) => l.k)).toContain(porNome("BRA", "Chapecoense"));
    // As vagas em aberto do rebaixamento saem da projeção: os 4 últimos caem
    const r = resolverPendencias(["BRA"], semente);
    expect([porNome("BRA", "Chapecoense"), ...r["BRA>BRB"].movem].sort()).toEqual(proj.slice(-4).map((l) => l.k).sort());
  }
  // Liga encerrada (Argentina): a tabela não muda
  const arg = projecaoAtual("ARG", 5);
  expect(arg.map((l) => l.pts)).toEqual(arg.map((l) => l.real));
});

test("semente: mesma semente → mesma temporada também nos formatos especiais (Liga MX e Argentina)", () => {
  for (const lg of ["MEX", "ARG", "SCO"]) {
    const a = temporadaRapidaFormato(lg, 11), b = temporadaRapidaFormato(lg, 11);
    expect(a.st.resultados).toEqual(b.st.resultados);
    expect(titulos(a.st, a.E, a.sorteio)).toEqual(titulos(b.st, b.E, b.sorteio));
  }
});

// ---------- Copas (v2, etapa 2) ----------
const paisDoClube = (k) => D.CL[k].lg.replace(/2$/, "");
test("copas: Libertadores 2027 com 47 clubes (32 nos grupos); Flamengo, Palmeiras e Cruzeiro sempre dentro", () => {
  for (const semente of [1, 2, 3]) {
    const P = planoDe(porNome("BRA", "Flamengo"));
    const E = criarEstado(P, { semente });
    expect(Object.keys(E.copas).sort()).toEqual(["CDB", "LIB", "SUD"]);
    const lib = E.copas.LIB.part;
    expect(lib.grupos.length + lib.pre.length).toBe(47);
    expect(lib.pre.length).toBe(19);
    for (const nome of ["Flamengo", "Palmeiras", "Cruzeiro"]) expect([...lib.grupos, ...lib.pre]).toContain(porNome("BRA", nome));
    expect(lib.selo[porNome("BRA", "Flamengo")]).toBe("real");
    // Ninguém em duas copas continentais; rebaixado não joga
    const sud = [...E.copas.SUD.part.direto, ...E.copas.SUD.part.primeira];
    expect(sud.length).toBe(44);
    expect(sud.some((k) => lib.grupos.includes(k) || lib.pre.includes(k))).toBe(false);
    // Temporada inteira: 32 na fase de grupos (28 diretos + 4 da pré) e um campeão
    const F = simularAte(E, P, 999);
    const Ec = esqCopa(F, "LIB"), g = F.copas.LIB.grupos[Ec.grupos];
    expect(g.length).toBe(8);
    expect(g.flatMap((x) => x.clubes).length).toBe(32);
    expect(campeaoDe(F, "LIB")).toBeTruthy();
    expect(campeaoDe(F, "SUD")).toBeTruthy();
  }
});

test("copas: Copa do Brasil 2027 coloca os 20 da Série A direto na 5ª fase (32 clubes)", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const F = simularAte(criarEstado(P, { semente: 5 }), P, 999);
  const Ec = esqCopa(F, "CDB"), quinta = Ec.etapas.find((e) => e.fase === "5ª fase");
  const ch = F.copas.CDB.chaves[quinta.i];
  expect(ch.pares.length).toBe(16);
  const serieA = F.composicao.clubes;
  expect(serieA.length).toBe(20);
  expect(serieA.every((k) => ch.pares.some((p) => p.includes(k)))).toBe(true);
  // Antes da 5ª fase, só clubes da Série B e da Série C
  Ec.etapas.filter((e) => e.i < quinta.i).forEach((e) => F.copas.CDB.chaves[e.i].pares.flat().forEach((k) => expect(serieA).not.toContain(k)));
  expect(campeaoDe(F, "CDB")).toBeTruthy();
});

test("copas: Champions 2027/28 com 36 na fase de liga, 8 jogos por clube e nenhum rival do mesmo país", () => {
  const P = planoDe(porNome("ENG", "Arsenal FC") || D.CLUBS.find((c) => c.lg === "ENG").k);
  const F = simularAte(criarEstado(P, { semente: 4 }), P, 999);
  expect(Object.keys(F.copas)).toEqual(expect.arrayContaining(["UCL", "UEL", "UECL", "FAC"]));
  for (const [id, jogosPorClube] of [["UCL", 8], ["UEL", 8], ["UECL", 6]]) {
    const Ec = esqCopa(F, id), e = Ec.etapas[Ec.liga], c = F.copas[id];
    const clubes = c.grupos[e.i][0].clubes;
    expect(clubes.length, id).toBe(36);
    expect(new Set(clubes).size).toBe(36);
    const j = {};
    for (let r = e.inicio; r < e.inicio + e.rodadas; r++)
      for (const [a, b] of c.resultados[r]) {
        j[a] = (j[a] || 0) + 1; j[b] = (j[b] || 0) + 1;
        expect(paisDoClube(a) === paisDoClube(b), `${id}: ${a} x ${b}`).toBe(false);
      }
    expect(clubes.every((k) => j[k] === jogosPorClube), id).toBe(true);
    expect(campeaoDe(F, id)).toBeTruthy();
  }
  // Os 7 eliminados da qualificação da Champions vão à Europa League
  const ucl = F.copas.UCL, q = ucl.chaves[esqCopa(F, "UCL").qual];
  const perdedores = q.pares.map(([a, b], i) => (q.vence[i] === a ? b : a));
  expect(perdedores.length).toBe(7);
  expect(perdedores.every((k) => F.copas.UEL.grupos[esqCopa(F, "UEL").liga][0].clubes.includes(k))).toBe(true);
});

test("copas: mesma semente → mesmos campeões; o calendário intercala liga e copas", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const a = simularAte(criarEstado(P, { semente: 9 }), P, 999), b = simularAte(criarEstado(P, { semente: 9 }), P, 999);
  for (const id of ["CDB", "LIB", "SUD"]) expect(campeaoDe(a, id)).toBe(campeaoDe(b, id));
  expect(a.estatisticas).toEqual(b.estatisticas);
  const datas = datasDe(a);
  expect(datas.filter((x) => x.c === "liga").length).toBe(38);
  expect(datas.findIndex((x) => x.c === "LIB")).toBeGreaterThan(0);
  expect(datas.findIndex((x) => x.c === "CDB")).toBeLessThan(datas.findIndex((x) => x.c === "liga" && x.r === 37)); // a Copa do Brasil começa antes da última rodada
  // Data a data dá o mesmo que tudo de uma vez
  let c = criarEstado(P, { semente: 9 });
  while (c.dataAtual < datas.length) c = jogarProximoJogo(c, P).estado;
  expect(campeaoDe(c, "LIB")).toBe(campeaoDe(a, "LIB"));
  expect(c.estatisticas).toEqual(a.estatisticas);
  // Estatísticas por competição somam o total
  const total = Object.values(a.estatisticas).reduce((s, x) => s + x[1], 0);
  const porComp = Object.values(a.estatComp).reduce((s, comp) => s + Object.values(comp).reduce((t, x) => t + x[1], 0), 0);
  expect(porComp).toBe(total);
});

test("copas: finais pendentes de 2026 — 'Escolher campeão' muda quem entra na Libertadores", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const fin = finaisPendentes().find((f) => f.id === "final_sud_2026");
  const [a, b] = fin.jogo;
  const Ea = criarEstado(P, { semente: 2, escolhasFinais: { final_sud_2026: a } });
  const Eb = criarEstado(P, { semente: 2, escolhasFinais: { final_sud_2026: b } });
  expect(Ea.finais.final_sud_2026.vence).toBe(a);
  expect(Ea.copas.LIB.part.grupos).toContain(a);
  expect(Eb.copas.LIB.part.grupos).toContain(b);
  expect(Ea.copas.LIB.part.selo[a]).toBe("escolhido");
});

test("desempenho: temporada completa (com estatísticas) das ligas com formatos especiais abaixo de 300 ms", () => {
  for (const lg of ["ARG2", "MEX", "USA", "ARG"]) {
    const P = planoDe(clubesDa(lg)[0]);
    const E0 = criarEstado(P, { semente: 2 });
    const t0 = performance.now();
    const F = simularAte(E0, P, 999);
    const ms = performance.now() - t0;
    console.log(`${lg}: ${totalRodadas(F)} rodadas em ${ms.toFixed(0)} ms`);
    expect(F.rodadaAtual).toBe(totalRodadas(F));
    expect(ms).toBeLessThan(300);
  }
});

test("calendário: cada clube joga 2×(n−1) jogos, metade em casa, sem repetir jogo no turno", () => {
  for (const n of [20, 18, 17, 24]) {
    const clubes = Array.from({ length: n }, (_, i) => "C" + i);
    const cal = gerarCalendario(clubes);
    const jogos = {}, casa = {};
    clubes.forEach((k) => { jogos[k] = 0; casa[k] = 0; });
    const metade = cal.length / 2;
    const turno = new Set();
    cal.forEach((rodada, r) => {
      const naRodada = new Set();
      for (const [c, f] of rodada) {
        jogos[c]++; jogos[f]++; casa[c]++;
        expect(naRodada.has(c) || naRodada.has(f)).toBe(false); // ninguém joga duas vezes na mesma rodada
        naRodada.add(c); naRodada.add(f);
        if (r < metade) {
          const par = [c, f].sort().join("-");
          expect(turno.has(par)).toBe(false); // sem repetir jogo no turno
          turno.add(par);
        }
      }
    });
    expect(turno.size).toBe((n * (n - 1)) / 2); // no turno, todos se enfrentam uma vez
    clubes.forEach((k) => { expect(jogos[k]).toBe(2 * (n - 1)); expect(casa[k]).toBe(n - 1); });
  }
});

test("motor: média de gols entre 2,4 e 2,8 e mandante vence ~45% (Brasileirão simulado 200 vezes)", () => {
  const clubes = clubesDa("BRA");
  const F = Object.fromEntries(clubes.map((k) => [k, escalarClube(k, "BRA").forca]));
  const cal = gerarCalendario(clubes), rng = mulberry32(42);
  let gols = 0, jogos = 0, casa = 0, empates = 0;
  for (let s = 0; s < 200; s++)
    for (const rodada of cal)
      for (const [c, f] of rodada) {
        const [a, b] = sortearPlacar(rng, F[c], F[f]);
        gols += a + b; jogos++;
        if (a > b) casa++; else if (a === b) empates++;
      }
  const media = gols / jogos, pctCasa = casa / jogos;
  console.log(`média de gols ${media.toFixed(3)} · mandante vence ${(pctCasa * 100).toFixed(1)}% · empates ${((empates / jogos) * 100).toFixed(1)}%`);
  expect(media).toBeGreaterThanOrEqual(2.4);
  expect(media).toBeLessThanOrEqual(2.8);
  expect(pctCasa).toBeGreaterThan(0.43);
  expect(pctCasa).toBeLessThan(0.47);
});

test("motor: time com força +10 vence bem mais do que perde (em casa e fora)", () => {
  const rng = mulberry32(7);
  for (const forteEmCasa of [true, false]) {
    let v = 0, d = 0;
    for (let i = 0; i < 4000; i++) {
      const [a, b] = forteEmCasa ? sortearPlacar(rng, 80, 70) : sortearPlacar(rng, 70, 80);
      const [forte, fraco] = forteEmCasa ? [a, b] : [b, a];
      if (forte > fraco) v++; else if (forte < fraco) d++;
    }
    expect(v).toBeGreaterThan(d * 2.5);
  }
  // λ fica entre 0,15 e 4,5
  expect(lambdas(99, 40)[0]).toBe(4.5);
  expect(lambdas(99, 40)[1]).toBe(0.15);
});

test("força: penalidade de improviso e o peso do banco", () => {
  const p = (pos, ovr) => ({ id: pos + ovr + Math.random(), pos, ovr });
  const onze = [["GOL", "GOL"], ["LD", "LD"], ["ZAG", "ZAG"], ["ZAG", "ZAG"], ["LE", "LE"], ["VOL", "VOL"], ["MC", "MC"], ["MEI", "MEI"], ["PD", "PD"], ["CA", "CA"], ["PE", "PE"]];
  const banco = Array.from({ length: 7 }, () => p("MC", 75));
  const certo = calcularForca(onze.map(([vaga, pos]) => ({ vaga, p: p(pos, 75) })), banco);
  expect(certo).toBeCloseTo(75, 5); // todos 75, ideais e banco igual: força 75
  // Um zagueiro na vaga de centroavante (fora da tabela): −6 no overall dele, com peso 1,1 do ataque
  const torto = calcularForca(onze.map(([vaga, pos]) => ({ vaga, p: p(vaga === "CA" ? "ZAG" : pos, 75) })), banco);
  expect(certo - torto).toBeCloseTo((6 * 1.1) / (1 + 4 + 3 * 1.05 + 3 * 1.1), 5);
  // Banco 10 pontos melhor que os titulares: +1
  const comBanco = calcularForca(onze.map(([vaga, pos]) => ({ vaga, p: p(pos, 75) })), Array.from({ length: 7 }, () => p("MC", 85)));
  expect(comBanco - certo).toBeCloseTo(1, 5);
});

test("jogo completo: autores e assistências são de quem jogou, e as notas ficam entre 6,0 e 9,5", () => {
  const a = escalarClube(porNome("BRA", "Palmeiras"), "BRA"), b = escalarClube(porNome("BRA", "Flamengo"), "BRA");
  const ids = (t) => new Set([...t.onze.map((x) => x.p?.id), ...t.banco.map((p) => p.id)]);
  const ia = ids(a), ib = ids(b);
  let gols = 0, comAssist = 0;
  for (let s = 0; s < 300; s++) {
    const j = jogarPartida(rngDe(1, s), a, b);
    expect(j.eventos.length).toBe(j.gc + j.gf);
    for (const [min, lado, autor, assist] of j.eventos) {
      expect(min).toBeGreaterThanOrEqual(1);
      expect(min).toBeLessThanOrEqual(90);
      expect((lado ? ib : ia).has(autor)).toBe(true);
      expect(assist).not.toBe(autor);
      gols++;
      if (assist) comAssist++;
    }
    expect(j.jogadores.filter((x) => x[1] === 0).length).toBeLessThanOrEqual(14); // 11 + 3 substituições
    j.jogadores.forEach(([, , , , nota]) => { expect(nota).toBeGreaterThanOrEqual(6); expect(nota).toBeLessThanOrEqual(9.5); });
  }
  expect(comAssist / gols).toBeGreaterThan(0.65);
  expect(comAssist / gols).toBeLessThan(0.85);
});

test("escalação dos outros clubes: 4-3-3 (ou 4-4-2 sem pontas), 7 no banco e o limite de estrangeiros", () => {
  const t = escalarClube(porNome("BRA", "Palmeiras"), "BRA");
  expect(t.form).toBe("4-3-3");
  expect(t.onze.every((x) => x.p)).toBe(true);
  expect(t.banco.length).toBe(7);
  // Nenhum jogador repetido
  const ids = [...t.onze.map((x) => x.p.id), ...t.banco.map((p) => p.id)];
  expect(new Set(ids).size).toBe(ids.length);
  // Limite de estrangeiros (Brasileirão: até 9 relacionados) em todos os clubes da Série A
  for (const k of clubesDa("BRA")) {
    const x = escalarClube(k, "BRA");
    const est = [...x.onze.map((y) => y.p), ...x.banco].filter((p) => p && p.nat && !p.nat.split("/").includes("Brasil")).length;
    expect(est).toBeLessThanOrEqual(9);
  }
});

test("seu clube: usa o plano (titulares da aba Time) e completa a vaga vazia sozinho", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const t = escalarPlano(P);
  expect(t.onze.map((x) => x.p.id)).toEqual(Object.keys(P.xi).sort((a, b) => a - b).map((i) => P.xi[i]));
  delete P.xi[9]; // tira o centroavante
  const t2 = escalarPlano(P);
  expect(t2.onze[9].p).toBeTruthy();
  expect(t2.onze.filter((x) => x.p).length).toBe(11);
});

test("composição: Brasileirão 2027 sem a Chapecoense e com Novorizontino e Juventude; Série B 2027 com os 4 da Série C", () => {
  for (const semente of [1, 2, 3, 99]) {
    const r = resolverPendencias(["BRA", "BRB", "BRC"], semente);
    const a = comporLiga("BRA", r).clubes, b = comporLiga("BRB", r).clubes, c = comporLiga("BRC", r).clubes;
    expect(a).not.toContain(porNome("BRA", "Chapecoense"));
    expect(a).toContain(porNome("BRB", "Grêmio Novorizontino"));
    expect(a).toContain(porNome("BRB", "Juventude"));
    expect(a.length).toBe(20);
    for (const nome of ["Maringá FC", "Ferroviária", "Santa Cruz", "Inter de Limeira"]) expect(b).toContain(porNome("BRC", nome));
    expect(b).toContain(porNome("BRA", "Chapecoense"));
    expect(b.length).toBe(20);
    // Série C: saem 4 (sobem) e 2 (deixam o site), entram 4 da Série B
    expect(c.length).toBe(18);
    expect(c).not.toContain(porNome("BRC", "AO Itabaiana"));
    // Ninguém em duas ligas
    expect(new Set([...a, ...b, ...c]).size).toBe(58);
  }
});

test("composição: 'Escolher' respeita a escolha e completa o que faltar com a simulação", () => {
  const remo = porNome("BRA", "Remo"), cor = porNome("BRA", "Corinthians"), gre = porNome("BRA", "Grêmio");
  const r = resolverPendencias(["BRA"], 5, { "BRA>BRB": { modo: "escolher", sel: [cor, gre, remo] }, "BRB>BRA": { modo: "escolher", sel: [porNome("BRB", "Criciúma")] } });
  expect(r["BRA>BRB"].movem.sort()).toEqual([cor, gre, remo].sort());
  const a = comporLiga("BRA", r).clubes;
  expect(a).not.toContain(cor);
  expect(a).toContain(porNome("BRB", "Criciúma"));
  expect(r["BRB>BRA"].movem.length).toBe(2); // o outro confronto veio da simulação
  expect(r["BRB>BRA"].incompleto).toBe(true);
  expect(a.length).toBe(20);
});

test("composição por projeção: Premier League 2027/28 com 20, sobem 3 da Championship e o selo de projeção", () => {
  const r = resolverPendencias(["ENG", "ENG2"], 11);
  expect(r["ENG>ENG2"].projecao).toBe(true);
  const eng = comporLiga("ENG", r), eng2 = comporLiga("ENG2", r);
  expect(eng.clubes.length).toBe(20);
  expect(eng2.clubes.length).toBe(24);
  expect(eng.entram.length).toBe(3);
  expect(eng.entram.every((x) => x.projecao && x.de === "ENG2")).toBe(true);
  // Alemanha: playoff entre as ligas mantém 18 nas duas
  const g = resolverPendencias(["GER", "GER2"], 3);
  expect(comporLiga("GER", g).clubes.length).toBe(18);
  expect(comporLiga("GER2", g).clubes.length).toBe(18);
  // Mesma semente, mesmo resultado
  expect(resolverPendencias(["ENG"], 11)["ENG>ENG2"].movem).toEqual(r["ENG>ENG2"].movem);
});

test("seu clube sobe pela composição: joga a liga nova e recebe o aviso", () => {
  const k = porNome("BRB", "Grêmio Novorizontino");
  const E = criarEstado(planoDe(k), { semente: 4 });
  expect(E.liga).toBe("BRA");
  expect(E.composicao.clubes).toContain(k);
  expect(E.avisos.join(" ")).toMatch(/subiu para a/);
  expect(ligaNaTemporada(porNome("BRA", "Chapecoense"), E.pendenciasResolvidas)).toBe("BRB");
});

test("faixas da tabela: Brasileirão com Libertadores no topo e 4 de rebaixamento; Championship com acesso e playoff", () => {
  const z = zonasDaLiga("BRA", 20);
  expect(z[0].nome).toMatch(/Libertadores/);
  expect(z.slice(16).every((x) => x.tipo === "queda")).toBe(true);
  expect(z[15]).toBeNull();
  const c = zonasDaLiga("ENG2", 24);
  expect(c[0].tipo).toBe("acesso");
  expect(c[1].tipo).toBe("acesso");
  expect(c.slice(2, 6).every((x) => x.tipo === "playoff-acesso")).toBe(true);
  expect(c[23]).toBeNull(); // ENG2 não tem par de rebaixamento no arquivo
  const p = zonasDaLiga("POR", 18);
  expect(p[0].nome).toBe("Champions League");
  expect(zonasDaLiga("JPN", 20)[0].nome).toBe("Campeão"); // liga sem faixas: _padrao
});

test("semente: mesma semente e mesmo plano → mesma tabela final; rodada a rodada = tudo de uma vez", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const A = simularAte(criarEstado(P, { semente: 123 }), P, 999);
  const B0 = criarEstado(P, { semente: 123 });
  let B = simularAte(B0, P, 1);
  B = simularAte(B, P, 20);
  B = simularAte(B, P, 999);
  expect(A.rodadaAtual).toBe(38);
  expect(tabelaAtual(A).map((l) => [l.k, l.pts])).toEqual(tabelaAtual(B).map((l) => [l.k, l.pts]));
  expect(A.estatisticas).toEqual(B.estatisticas);
  const C = simularAte(criarEstado(P, { semente: 124 }), P, 999);
  expect(JSON.stringify(tabelaAtual(C).map((l) => l.pts))).not.toBe(JSON.stringify(tabelaAtual(A).map((l) => l.pts)));
  // Pontos: todo jogo distribui 3 (vitória) ou 2 (empate)
  const t = tabelaAtual(A);
  expect(t.reduce((s, l) => s + l.j, 0)).toBe(380 * 2);
});

test("jogo ao vivo: narração igual a cada vez, com os gols salvos, 3 substituições e lances de quem está em campo", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const E = simularAte(criarEstado(P, { semente: 21 }), P, 5);
  for (let r = 0; r < 5; r++) {
    const i = E.resultados[r].findIndex((j) => j[0] === P.club || j[1] === P.club);
    if (i < 0) continue;
    const jogo = E.resultados[r][i];
    expect(jogo[5].length).toBe(6); // 3 substituições de cada lado, salvas só nos jogos do seu clube
    const n1 = narracao(E, P, r, i), n2 = narracao(E, P, r, i);
    expect(n1).toEqual(n2);
    expect(n1.filter((x) => x.tipo === "gol").length).toBe(jogo[2] + jogo[3]);
    expect(n1.filter((x) => x.tipo === "chance").length).toBeGreaterThan(0);
    // Quem saiu não finaliza depois de sair
    for (const ch of n1.filter((x) => x.tipo === "chance")) {
      const saiu = jogo[5].find((s) => s[2] === ch.autor);
      if (saiu) expect(ch.min).toBeLessThan(saiu[0] + 1);
    }
    expect(n1.every((x, k) => k === 0 || n1[k - 1].min <= x.min)).toBe(true);
  }
  // Os outros jogos não guardam substituições (para o "plantel:sim" não crescer à toa)
  expect(E.resultados[0].filter((j) => j[0] !== P.club && j[1] !== P.club).every((j) => j.length === 5)).toBe(true);
});

test("tela do simulador: classes sem o prefixo sim-/simp-/av- são só as peças comuns reaproveitadas de propósito", () => {
  // Classes curtas soltas já existem no CSS com outro sentido (".esc" = tela de escolha, ".top" = topo do plano)
  // e esticavam ou pintavam partes do simulador. As novas precisam do prefixo.
  const fonte = fs.readFileSync("src/componentes/Simulador.jsx", "utf8");
  const classes = new Set();
  for (const m of fonte.matchAll(/className=(?:"([^"]+)"|\{([^}]*)\})/g)) {
    const txt = m[1] ?? (m[2].match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1)).join(" ");
    txt.split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
  }
  const PERMITIDAS = new Set(["acts", "btn", "pri", "card", "col", "empty", "field", "kv", "kv-nome", "mute", "note", "num", "opt", "r", "ponto", "pos",
    "sec", "seg", "tabs", "ind", "sobe", "desce", "meu", "c", "f", "a", "b", "cl", "zp", "ult", "fim", "r-", "so-largo", "so-celular",
    "acesso", "real", "escolhido"]); // não são classes: são textos comparados dentro do className (x.tipo === "acesso", selo === "real")
  const soltas = [...classes].filter((c) => !/^(sim-|simp-|simp$|av-)/.test(c) && !PERMITIDAS.has(c));
  expect(soltas).toEqual([]);
});

test("desempenho: uma temporada de 20 clubes simula inteira em menos de 300 ms", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const E = criarEstado(P, { semente: 9 });
  const t0 = performance.now();
  const F = simularAte(E, P, 999);
  const ms = performance.now() - t0;
  console.log(`temporada de 20 clubes: ${ms.toFixed(0)} ms (${totalRodadas(F)} rodadas)`);
  expect(ms).toBeLessThan(300);
  // A previsão (300 temporadas rápidas) também é rápida
  const t1 = performance.now();
  criarEstado(P, { semente: 10 });
  console.log(`preparar + previsão: ${(performance.now() - t1).toFixed(0)} ms`);
});

test("previsão: soma das chances de título = 100% e o mais forte é favorito", () => {
  const P = planoDe(porNome("BRA", "Flamengo"));
  const E = criarEstado(P, { semente: 8 });
  const prev = Object.values(E.previsao);
  expect(prev.reduce((s, x) => s + x.titulo, 0)).toBeCloseTo(100, 0);
  expect(prev.reduce((s, x) => s + x.queda, 0)).toBeCloseTo(400, 0); // 4 caem em toda temporada
  const times = montarTimes(P, E.composicao.clubes, E.liga);
  const forte = Object.keys(times).sort((a, b) => times[b].forca - times[a].forca)[0];
  const fraco = Object.keys(times).sort((a, b) => times[a].forca - times[b].forca)[0];
  expect(E.previsao[forte].pos).toBeLessThan(E.previsao[fraco].pos);
});
