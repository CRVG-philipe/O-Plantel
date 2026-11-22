// Testes da nota de recomendação do Mercado (src/logica/recomendacao.js e afinidade.js).
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { novoPlano } from "../src/logica/elenco.js";
import { notasDoMercado, pontuar } from "../src/logica/recomendacao.js";
import { AFINIDADE, afinidade } from "../src/logica/afinidade.js";

beforeAll(async () => {
  // "fetch de mentira": lê os arquivos de public/
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const clube = (lg, nome) => D.CLUBS.find((c) => c.lg === lg && (!nome || c.n === nome));
const plano = (c, budget) => ({ ...novoPlano(c.k), budget });
// Jogadores de outros clubes do maior para o menor na recomendação
const ranking = (P) => {
  const notas = notasDoMercado(P);
  return [...notas.entries()].sort((a, b) => b[1] - a[1] || D.BYID[b[0]].v - D.BYID[a[0]].v).map(([id, n]) => ({ ...D.BYID[id], nota: n }));
};
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

test("afinidade: mesma liga 1, divisão de baixo alta, par sem regra 0,3", () => {
  expect(afinidade("BRA", "BRA")).toBe(1);
  expect(afinidade("BRA", "BRB")).toBeGreaterThanOrEqual(0.8);
  expect(afinidade("ENG", "ENG2")).toBeGreaterThanOrEqual(0.8);
  expect(afinidade("BRA", "ARG")).toBeGreaterThan(afinidade("BRA", "ENG"));       // Brasil compra da Argentina, não da Premier
  expect(afinidade("ENG", "POR")).toBeGreaterThan(afinidade("ENG", "BRC"));
  expect(afinidade("SAU", "ITA")).toBeGreaterThan(afinidade("NOR", "ITA"));       // Golfo compra veteranos das grandes
  expect(afinidade("CHN", "SCO")).toBe(0.3);                                      // sem regra
  // Toda liga dos dados está na tabela, com valores entre 0 e 1
  for (const d of D.LEAGUES) for (const o of D.LEAGUES) {
    const v = AFINIDADE[d.k][o.k];
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  }
});

test("nota fica entre 0 e 100", () => {
  const P = plano(clube("ENG", "Arsenal"), 50);
  const notas = [...notasDoMercado(P).values()];
  expect(Math.min(...notas)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...notas)).toBeLessThanOrEqual(100);
});

test("clube da Série C não recebe estrela de € 100 mi no topo (nem com caixa enorme)", () => {
  const c = clube("BRC");
  const top = ranking(plano(c, 500)).slice(0, 50);
  expect(top.every((p) => p.v < 100)).toBe(true);
  expect(top.slice(0, 10).every((p) => p.v <= 5)).toBe(true);                     // topo: jogadores do patamar do clube
  expect(top.slice(0, 10).filter((p) => ["BRA", "BRB", "BRC"].includes(p.lg)).length).toBeGreaterThanOrEqual(6); // e do Brasil
  // As estrelas mais caras ficam com nota baixa
  const estrela = [...D.ALL].sort((a, b) => b.v - a.v)[0];
  expect(estrela.v).toBeGreaterThanOrEqual(100);
  expect(pontuar(estrela, D.CL[estrela.club], c, plano(c, 500))).toBeLessThan(40);
});

test("clube saudita recebe veteranos das ligas europeias bem pontuados", () => {
  const saudita = clube("SAU", "Al-Hilal") || clube("SAU");
  const noruegues = clube("NOR");
  // Veteranos (31+) das 5 grandes ligas, de € 2 a 25 mi
  const veteranos = D.ALL.filter((p) => ["ENG", "ESP", "ITA", "GER", "FRA"].includes(p.lg) && p.a >= 31 && p.v >= 2 && p.v <= 25);
  expect(veteranos.length).toBeGreaterThan(20);
  const nota = (destino) => mediana(veteranos.map((p) => pontuar(p, D.CL[p.club], destino, plano(destino, 100))));
  expect(nota(saudita)).toBeGreaterThanOrEqual(60);
  expect(nota(saudita)).toBeGreaterThan(nota(noruegues) + 15);                    // na Noruega, veterano europeu pesa menos
  // O melhor veterano europeu fica entre os 2% primeiros da lista do clube saudita (antes vêm os da própria liga),
  // e bem mais acima do que na lista do clube norueguês
  const posicao = (destino) => ranking(plano(destino, 100)).findIndex((p) => ["ENG", "ESP", "ITA", "GER", "FRA"].includes(p.lg) && p.a >= 31);
  expect(posicao(saudita)).toBeLessThan(D.ALL.length * 0.02);
  expect(posicao(saudita) * 3).toBeLessThan(posicao(noruegues));
}, 60000); // calcula a lista inteira várias vezes: 60 s de limite em vez de 30

test("necessidade: posição vazia no elenco planejado sobe a nota", () => {
  const c = clube("ENG", "Arsenal");
  const P = plano(c, 50);
  const goleiro = D.ALL.find((p) => p.pos === "GOL" && p.lg === "ENG" && p.club !== c.k && p.v >= 5);
  const antes = pontuar(goleiro, D.CL[goleiro.club], c, P);
  // Vende todos os goleiros do Arsenal: o elenco fica sem goleiro
  const Q = structuredClone(P);
  D.ALL.filter((p) => p.club === c.k && p.pos === "GOL").forEach((p) => { Q.st[p.id] = { s: "vende", fee: 0 }; });
  expect(pontuar(goleiro, D.CL[goleiro.club], c, Q)).toBeGreaterThan(antes);
});
