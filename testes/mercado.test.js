// Testes do mercado da IA no simulador (src/logica/simulacao/mercadoIA.js).
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { difsDoMercado, elencoDepois, MAX_ELENCO, MIN_ELENCO } from "../src/logica/simulacao/mercadoIA.js";
import { idsDoPlano, jogadoresDo } from "../src/logica/simulacao/escalar.js";
import { criarEstado, montarTimes, rodarMercado, simularAte } from "../src/logica/simulacao/temporada.js";
import { elencoAtual, novoPlano } from "../src/logica/elenco.js";
import { escalarSozinho } from "../src/logica/escalacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const porNome = (lg, nome) => D.CLUBS.find((c) => c.lg === lg && c.n === nome)?.k;
const planoDe = (k) => { const P = novoPlano(k); escalarSozinho(P, "o"); return P; };
// Plano com compras: os 3 melhores (por overall) de outros clubes da mesma liga
function planoComCompras(k) {
  const P = novoPlano(k), lg = D.CL[k].lg;
  const alvos = D.ALL.filter((p) => p.lg === lg && p.club !== k && !p.emp).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  P.ins = alvos.map((p) => ({ id: p.id, fee: p.v }));
  escalarSozinho(P, "o");
  return P;
}
// Elenco de cada clube depois da janela (sem os jogadores do plano do usuário)
const elencoFinal = (k, m, plano, fase = "inicio") => { const fora = idsDoPlano(plano); return elencoDepois(k, m, fase).filter((p) => !fora.has(p.id)); };
const ativosDe = (m) => Object.keys(m.gastos);

const casos = {};
const estadoDe = (nome, lg, plano, opcoes = {}) => (casos[nome + JSON.stringify(opcoes)] ??= criarEstado(plano, { semente: 2027, semPrevisaoCopas: true, mercadoOpcoes: opcoes }));

test("mercado da IA: elencos com 2+ goleiros e entre 22 e 30 jogadores (Brasileirão e Premier League)", () => {
  for (const [lg, nome] of [["BRA", "Flamengo"], ["ENG", "Arsenal"]]) {
    const plano = planoDe(porNome(lg, nome)), m = estadoDe(nome, lg, plano).mercadoIA;
    expect(ativosDe(m).length).toBeGreaterThan(15);
    for (const k of ativosDe(m)) {
      const sq = elencoFinal(k, m, plano);
      expect(sq.filter((p) => p.pos === "GOL").length, `${D.CL[k].n}: goleiros`).toBeGreaterThanOrEqual(2);
      expect(sq.length, `${D.CL[k].n}: tamanho`).toBeGreaterThanOrEqual(MIN_ELENCO);
      expect(sq.length, `${D.CL[k].n}: tamanho`).toBeLessThanOrEqual(MAX_ELENCO);
    }
    // Houve compras de verdade, e cada clube fez no máximo 5 compras
    const compras = m.transf.filter((t) => t[4] === "c");
    expect(compras.length).toBeGreaterThan(10);
    const porClube = {};
    compras.forEach((t) => (porClube[t[2]] = (porClube[t[2]] || 0) + 1));
    expect(Math.max(...Object.values(porClube))).toBeLessThanOrEqual(5);
  }
});

test("mercado da IA: nenhum clube gasta mais que o orçamento (+ 60% das vendas)", () => {
  const plano = planoDe(porNome("BRA", "Flamengo")), m = estadoDe("Flamengo", "BRA", plano).mercadoIA;
  for (const [k, [orc, gasto, vendas]] of Object.entries(m.gastos)) expect(gasto, D.CL[k].n).toBeLessThanOrEqual(orc + 0.6 * vendas + 0.01);
});

test("mercado da IA: nenhum jogador em dois clubes, e quem o usuário comprou não se mexe", () => {
  const k = porNome("BRA", "Palmeiras"), plano = planoComCompras(k), m = criarEstado(plano, { semente: 7, semPrevisaoCopas: true }).mercadoIA;
  const comprados = new Set(plano.ins.map((x) => x.id));
  expect(m.transf.some((t) => comprados.has(t[0]))).toBe(false);
  for (const fase of ["inicio", "meio"]) {
    const clubes = new Set([...ativosDe(m), ...Object.keys(difsDoMercado(m, fase))]);
    const visto = new Map(elencoAtual(plano).filter(Boolean).map((p) => [p.id, k]));
    for (const c of clubes) {
      if (c === k) continue;
      for (const p of elencoFinal(c, m, plano, fase)) {
        expect(visto.get(p.id), `${p.n} em ${D.CL[c].n} e ${D.CL[visto.get(p.id)]?.n}`).toBeUndefined();
        visto.set(p.id, c);
      }
    }
  }
  // O elenco do usuário não muda: os escalados do clube dele são os do plano
  const times = montarTimes(plano, [k], "BRA", m);
  const meus = new Set(elencoAtual(plano).filter(Boolean).map((p) => p.id));
  expect(times[k].onze.every((x) => !x.p || meus.has(x.p.id))).toBe(true);
});

test("mercado da IA: mesma semente = mesmas transferências; semente do mercado nova = outras", () => {
  const plano = planoDe(porNome("BRA", "Botafogo"));
  const a = criarEstado(plano, { semente: 11, semPrevisaoCopas: true }), b = criarEstado(plano, { semente: 11, semPrevisaoCopas: true });
  expect(JSON.stringify(a.mercadoIA)).toBe(JSON.stringify(b.mercadoIA));
  const c = criarEstado(plano, { semente: 11, semPrevisaoCopas: true, mercadoSemente: 999 });
  expect(JSON.stringify(c.mercadoIA.transf)).not.toBe(JSON.stringify(a.mercadoIA.transf));
});

test("mercado da IA desligado: mesma temporada de antes (o mercado não mexe no resto da simulação)", () => {
  const plano = planoDe(porNome("BRA", "Botafogo"));
  const off = criarEstado(plano, { semente: 5, semPrevisaoCopas: true, mercadoOpcoes: { ativo: false } });
  expect(off.mercadoIA).toBe(null);
  const on = criarEstado(plano, { semente: 5, semPrevisaoCopas: true });
  expect(on.mercadoIA.transf.length).toBeGreaterThan(0);
  // Sem o mercado, o estado "ligado" joga igualzinho ao desligado: o sorteio da temporada não depende do mercado
  const semMercado = { ...on, mercadoIA: null, previsao: off.previsao };
  const r1 = simularAte(off, plano, 10), r2 = simularAte(semMercado, plano, 10);
  expect(JSON.stringify(r2.resultados)).toBe(JSON.stringify(r1.resultados));
  expect(JSON.stringify(on.composicao)).toBe(JSON.stringify(off.composicao));
});

test("mercado da IA: propostas pelo usuário, evolução e janela do meio", () => {
  const plano = planoDe(porNome("BRA", "Flamengo"));
  const e = criarEstado(plano, { semente: 3, semPrevisaoCopas: true, mercadoOpcoes: { evolucao: true, meio: true } });
  const m = e.mercadoIA;
  expect(m.propostas.length).toBeLessThanOrEqual(3);
  const meus = new Set(elencoAtual(plano).map((p) => p.id));
  m.propostas.forEach((x) => { expect(meus.has(x.id)).toBe(true); expect(x.valor).toBeGreaterThan(0); });
  // Recusar uma proposta: ela não volta
  if (m.propostas[0]) {
    const x = m.propostas[0];
    const e2 = criarEstado(plano, { semente: 3, semPrevisaoCopas: true, mercadoOpcoes: { evolucao: true, meio: true }, respostasMercado: { [x.id + "|" + x.k]: "recusada" } });
    expect(e2.mercadoIA.propostas.some((y) => y.id === x.id && y.k === x.k)).toBe(false);
  }
  // Evolução: no máximo +4 e nunca abaixo de 40
  for (const [id, o] of Object.entries(m.ovrs)) {
    const p = D.BYID[id];
    expect(o - p.ovr).toBeLessThanOrEqual(4);
    expect(o - p.ovr).toBeGreaterThanOrEqual(-3);
  }
  // O overall de verdade não muda
  expect(D.ALL.find((p) => p.n === "Kylian Mbappé").ovr).toBe(91);
  expect(m.meio).toBeTruthy();
  // Desligada, sem propostas
  const sem = criarEstado(plano, { semente: 3, semPrevisaoCopas: true, mercadoOpcoes: { propostas: false } });
  expect(sem.mercadoIA.propostas.length).toBe(0);
});

test("mercado da IA: a janela leva menos de 2 s (Premier League, com as copas europeias)", () => {
  const plano = planoDe(porNome("ENG", "Arsenal")), e = estadoDe("Arsenal", "ENG", plano);
  const t0 = performance.now();
  rodarMercado(e, plano);
  expect(performance.now() - t0).toBeLessThan(2000);
  // Não mexe no elenco dos dados
  expect(jogadoresDo(porNome("ENG", "Arsenal")).length).toBeGreaterThan(15);
});
