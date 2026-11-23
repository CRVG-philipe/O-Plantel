// Testes do simulador da temporada (src/logica/simulacao/): calendário, motor, composição, semente e desempenho.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { mulberry32, rngDe } from "../src/logica/simulacao/aleatorio.js";
import { gerarCalendario } from "../src/logica/simulacao/calendario.js";
import { calcularForca, jogarPartida, lambdas, sortearPlacar } from "../src/logica/simulacao/motor.js";
import { escalarClube, escalarPlano } from "../src/logica/simulacao/escalar.js";
import { comporLiga, ligaNaTemporada, resolverPendencias, rotuloLiga, zonasDaLiga } from "../src/logica/simulacao/composicao.js";
import { criarEstado, montarTimes, simularAte, tabelaAtual, totalRodadas } from "../src/logica/simulacao/temporada.js";
import { novoPlano } from "../src/logica/elenco.js";
import { escalarSozinho } from "../src/logica/escalacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const clubesDa = (lg) => D.CLUBS.filter((c) => c.lg === lg).map((c) => c.k);
const porNome = (lg, nome) => D.CLUBS.find((c) => c.lg === lg && c.n === nome)?.k;
const planoDe = (k) => { const P = novoPlano(k); escalarSozinho(P, "o"); return P; };

test("temporada certa por liga: '2026' simula 2027; '26/27' simula 2027/28", () => {
  expect(rotuloLiga("BRA")).toBe(D.LG.BRA.n + " 2027");
  expect(rotuloLiga("ENG")).toBe(D.LG.ENG.n + " 2027/28");
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
