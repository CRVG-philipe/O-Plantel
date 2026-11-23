// Testes da janela da IA no simulador (src/logica/simulacao/mercadoIA.js): contratações dos clubes da IA antes da temporada.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados, saoRivais } from "../src/logica/dados.js";
import { MAX_CONTRATACOES, dadosParaWorker, difsDoMercado, elencoDepois, gastosDaJanela, janelaDoResto, listaTransferencias } from "../src/logica/simulacao/mercadoIA.js";
import { jogadoresDo } from "../src/logica/simulacao/escalar.js";
import { criarEstado, juntarResto, montarTimes, pedidoDoResto, rodarMercado } from "../src/logica/simulacao/temporada.js";
import { escalarClube } from "../src/logica/simulacao/escalar.js";
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
  P.ins = D.ALL.filter((p) => p.lg === lg && p.club !== k && !p.emp).sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => ({ id: p.id, fee: p.v }));
  escalarSozinho(P, "o");
  return P;
}
// Estado com a janela completa (fase 1 + fase 2, rodada direto, sem o Worker)
const cache = {};
function completo(plano, semente) {
  const chave = plano.club + "|" + semente + "|" + plano.ins.length;
  if (cache[chave]) return cache[chave];
  const e = criarEstado(plano, { semente, semPrevisaoCopas: true });
  return (cache[chave] = juntarResto(e, e.mercadoIA.transf, janelaDoResto(pedidoDoResto(e, plano))));
}

test("janela da IA: ninguém gasta mais que o caixa e cada clube faz no máximo 4 contratações (média ~2)", () => {
  for (const [lg, nome] of [["BRA", "Flamengo"], ["ENG", "Arsenal"]]) {
    const e = completo(planoDe(porNome(lg, nome)), 2027), g = gastosDaJanela(e.mercadoIA);
    expect(e.mercadoIA.resto).toBe(true);
    for (const [k, [gasto, caixa, n]] of Object.entries(g)) {
      expect(gasto, D.CL[k].n).toBeLessThanOrEqual(caixa + 1e-9);
      expect(n, D.CL[k].n).toBeLessThanOrEqual(MAX_CONTRATACOES);
    }
    // Média entre os clubes que jogam a temporada (contando os que não contrataram)
    const daLiga = e.composicao.clubes.filter((k) => k !== porNome(lg, nome));
    const media = daLiga.reduce((s, k) => s + (g[k]?.[2] || 0), 0) / daLiga.length;
    expect(media).toBeGreaterThan(1);
    expect(media).toBeLessThan(3.2);
  }
});

test("janela da IA: o mesmo jogador não aparece em dois clubes; ninguém do plano do usuário muda de clube", () => {
  const k = porNome("BRA", "Palmeiras"), plano = planoComCompras(k), e = completo(plano, 7), m = e.mercadoIA;
  const doPlano = new Set([...jogadoresDo(k).map((p) => p.id), ...elencoAtual(plano).map((p) => p.id), ...plano.ins.map((x) => x.id)]);
  expect(m.transf.some(([id]) => doPlano.has(id))).toBe(false);
  // Cada jogador muda no máximo uma vez
  expect(new Set(m.transf.map((t) => t[0])).size).toBe(m.transf.length);
  // Elencos depois da janela (todos os clubes): nenhum id repetido
  const visto = new Map();
  for (const c of D.CLUBS) {
    if (c.k === k) continue;
    for (const p of elencoDepois(c.k, m)) {
      if (doPlano.has(p.id) && p.club !== c.k) continue;
      expect(visto.get(p.id), `${p.n}: ${c.n} e ${D.CL[visto.get(p.id)]?.n}`).toBeUndefined();
      visto.set(p.id, c.k);
    }
  }
  // O time do usuário só tem gente do plano
  const meus = new Set(elencoAtual(plano).map((p) => p.id));
  expect(montarTimes(plano, [k], "BRA", m)[k].onze.every((x) => !x.p || meus.has(x.p.id))).toBe(true);
});

test("janela da IA: reforços realistas (3–25% do valor do elenco, origem até 1,5× mais rica, melhor ou bom reserva)", () => {
  const e = completo(planoDe(porNome("BRA", "Botafogo")), 11);
  const valor = (k) => jogadoresDo(k).reduce((s, p) => s + (p.v || 0), 0);
  const lista = listaTransferencias(e.mercadoIA);
  expect(lista.length).toBeGreaterThan(100);
  for (const t of lista) {
    expect(t.valor).toBeGreaterThanOrEqual(0.03 * valor(t.para) - 1e-9);
    expect(t.valor).toBeLessThanOrEqual(0.25 * valor(t.para) + 1e-9);
    expect(valor(t.de)).toBeLessThanOrEqual(1.5 * valor(t.para) + 1e-9);
    expect(t.p.emp).toBeFalsy();
  }
  // Conservador: o melhor jogador do clube de origem nunca sai (o elenco dele conta também quem chegou na janela)
  const difs = difsDoMercado(e.mercadoIA);
  for (const t of lista) {
    const elencoDe = [...jogadoresDo(t.de), ...[...(difs[t.de]?.e || [])].map((id) => D.BYID[id])];
    expect(t.p.ovr, t.p.n).toBeLessThan(Math.max(...elencoDe.map((p) => p.ovr || 0)));
  }
  // A fase 2 (resto do mundo) não tira ninguém dos clubes da temporada
  const fase1 = new Set(rodarMercado(e, planoDe(porNome("BRA", "Botafogo"))).transf.map((t) => t[0]));
  const daTemporada = new Set([...e.composicao.clubes]);
  for (const t of lista) if (!fase1.has(t.id)) expect(daTemporada.has(t.de)).toBe(false);
});

test("janela da IA: mesma semente = mesmas transferências; 'Refazer janela' (semente nova) = outras", () => {
  const plano = planoDe(porNome("BRA", "Botafogo"));
  const a = criarEstado(plano, { semente: 11, semPrevisaoCopas: true }), b = criarEstado(plano, { semente: 11, semPrevisaoCopas: true });
  expect(JSON.stringify(a.mercadoIA)).toBe(JSON.stringify(b.mercadoIA));
  expect(JSON.stringify(janelaDoResto(pedidoDoResto(a, plano)))).toBe(JSON.stringify(janelaDoResto(pedidoDoResto(b, plano))));
  const c = criarEstado(plano, { semente: 11, semPrevisaoCopas: true, mercadoSemente: 999 });
  expect(JSON.stringify(c.mercadoIA.transf)).not.toBe(JSON.stringify(a.mercadoIA.transf));
  // Guardado só a lista de transferências
  expect(Object.keys(a.mercadoIA).sort()).toEqual(["resto", "semente", "transf"]);
  a.mercadoIA.transf.forEach((t) => expect(t.length).toBe(2));
});

test("janela da IA desligada: os elencos ficam iguais aos do data.json", () => {
  const k = porNome("BRA", "Botafogo"), plano = planoDe(k);
  const off = criarEstado(plano, { semente: 5, semPrevisaoCopas: true, mercadoAtivo: false });
  expect(off.mercadoIA).toBe(null);
  expect(Object.keys(difsDoMercado(off.mercadoIA)).length).toBe(0);
  const times = montarTimes(plano, off.composicao.clubes, "BRA", off.mercadoIA);
  for (const c of off.composicao.clubes.filter((x) => x !== k)) {
    expect(elencoDepois(c, off.mercadoIA)).toBe(jogadoresDo(c));
    expect(times[c].forca).toBe(escalarClube(c, "BRA", new Set(elencoAtual(plano).map((p) => p.id))).forca);
  }
  // Ligado, a janela muda alguns elencos da liga
  const on = criarEstado(plano, { semente: 5, semPrevisaoCopas: true });
  expect(off.composicao.clubes.some((c) => elencoDepois(c, on.mercadoIA) !== jogadoresDo(c))).toBe(true);
});

test("janela da IA: a janela inteira (fase 1 + resto do mundo) leva menos de 2 s", () => {
  const plano = planoDe(porNome("ENG", "Arsenal")), e = criarEstado(plano, { semente: 3, semPrevisaoCopas: true });
  const t0 = performance.now();
  const m = rodarMercado(e, plano);
  const t1 = performance.now();
  janelaDoResto(pedidoDoResto({ ...e, mercadoIA: m }, plano));
  console.log("fase 1", Math.round(t1 - t0), "ms; resto do mundo", Math.round(performance.now() - t1), "ms");
  expect(performance.now() - t0).toBeLessThan(2000);
});

test("janela da IA no Web Worker: os dados enviados levam a dupla nacionalidade (Jorginho = Itália/Brasil)", () => {
  const d = dadosParaWorker();
  const j = D.ALL.find((p) => p.n === "Jorginho" && D.CL[p.club].n === "Flamengo");
  expect(d.ALL.find((x) => x[0] === j.id)[7]).toBe("Itália/Brasil");
});
test("janela da IA: transferência entre rivais é raríssima (rivais.json; todos os nomes batem com o data.json)", () => {
  expect(D.RIVAIS_FALTANDO).toEqual([]);
  expect(saoRivais(porNome("BRA", "Flamengo"), porNome("BRA", "Fluminense"))).toBe(true);
  expect(saoRivais(porNome("BRA", "Palmeiras"), porNome("BRA", "Corinthians"))).toBe(true);
  expect(saoRivais(porNome("BRA", "Flamengo"), porNome("BRA", "Palmeiras"))).toBe(false);
  let total = 0, entreRivais = 0;
  for (const [lg, nome] of [["BRA", "Flamengo"], ["ENG", "Arsenal"], ["ESP", "Sevilla"]])
    for (const semente of [1, 2, 3]) {
      const e = completo(planoDe(porNome(lg, nome)), semente);
      for (const t of listaTransferencias(e.mercadoIA)) { total++; if (saoRivais(t.de, t.para)) entreRivais++; }
    }
  console.log("transferências", total, "entre rivais", entreRivais);
  expect(total).toBeGreaterThan(3000);
  expect(entreRivais / total).toBeLessThan(0.002);
});