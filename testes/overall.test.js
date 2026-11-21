// Testes do overall e dos atributos (public/overall.json): carga, força do time, ordem "Overall" e recomendação.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FILTROS_PADRAO } from "../src/logica/constantes.js";
import { jogador, novoPlano } from "../src/logica/elenco.js";
import { escalarSozinho, forcaAntes, forcaDoTime } from "../src/logica/escalacao.js";
import { buscarJogadores } from "../src/logica/mercado.js";
import { pontuar } from "../src/logica/recomendacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const achar = (nome, nasc) => D.ALL.find((p) => p.n === nome && (!nasc || p.nasc === nasc));

test("o overall do Mbappé é 91, com os 5 atributos de jogador de linha", () => {
  const m = achar("Kylian Mbappé", "1998-12-20");
  expect(m.ovr).toBe(91);
  expect(m.ovrEst).toBe(false);
  expect(m.atr.tipo).toBe("L");
  expect(m.atr.v).toHaveLength(5);
});

test("todo jogador da base tem overall entre 45 e 91; o estimado é marcado", () => {
  expect(D.ALL.every((p) => p.ovr >= 45 && p.ovr <= 91)).toBe(true);
  expect(D.ALL.some((p) => p.ovrEst)).toBe(true);
  // Atributos: null ou { tipo, 5 números de 0 a 100 }; goleiro tem tipo "G"
  for (const p of D.ALL) {
    if (p.atr === null) continue;
    expect(["L", "G"]).toContain(p.atr.tipo);
    expect(p.atr.v.every((x) => x >= 0 && x <= 100)).toBe(true);
  }
  expect(D.ALL.some((p) => p.pos === "GOL" && p.atr?.tipo === "G")).toBe(true);
});

test("força do time é a média de overall dos 11 titulares", () => {
  const P = novoPlano("T42");
  escalarSozinho(P);
  const ovrs = Object.values(P.xi).map((id) => jogador(P, id).ovr);
  expect(ovrs).toHaveLength(11);
  const media = ovrs.reduce((s, o) => s + o, 0) / 11;
  expect(forcaDoTime(P).n).toBe(11);
  expect(forcaDoTime(P).media).toBeCloseTo(media, 1);
  // Sem mudanças, antes = depois
  expect(forcaAntes(P).media).toBe(forcaDoTime(P).media);
  // Trocar o titular de menor overall pelo Mbappé sobe a força
  const [pior] = Object.entries(P.xi).sort((a, b) => jogador(P, a[1]).ovr - jogador(P, b[1]).ovr);
  const mbappe = achar("Kylian Mbappé", "1998-12-20");
  P.ins.push({ id: mbappe.id, type: "compra", fee: 0 });
  P.xi[pior[0]] = mbappe.id;
  expect(forcaDoTime(P).media).toBeGreaterThan(forcaAntes(P).media);
  // Time vazio: sem força
  expect(forcaDoTime({ ...P, xi: {} })).toBeNull();
});

test("Mercado: ordem 'Overall' põe o maior overall primeiro", () => {
  const P = novoPlano("T1974");
  const l = buscarJogadores(P, "", 0, { ...FILTROS_PADRAO, fit: false, sort: "o" });
  expect(l[0].ovr).toBe(91);
  for (let i = 1; i < 200; i++) expect(l[i - 1].ovr).toBeGreaterThanOrEqual(l[i].ovr);
});

test("recomendação: overall bem acima da média do elenco ganha pontos, desde que o preço caiba no patamar", () => {
  const vasco = D.CL.T1974;
  const P = { ...novoPlano("T1974"), budget: 500 };
  // Um jogador de preço realista para o Vasco: com overall maior, a nota sobe
  const comum = D.ALL.find((p) => p.lg === "BRA" && p.club !== "T1974" && p.v >= 3 && p.v <= 8 && p.ovr < 70);
  const melhor = { ...comum, ovr: comum.ovr + 15 };
  expect(pontuar(melhor, D.CL[comum.club], vasco, P)).toBeGreaterThan(pontuar(comum, D.CL[comum.club], vasco, P));
  // Estrela caríssima: overall alto não ajuda (fora do patamar de preço)
  const estrela = [...D.ALL].sort((a, b) => b.v - a.v)[0];
  const estrelaFraca = { ...estrela, ovr: 50 };
  expect(pontuar(estrela, D.CL[estrela.club], vasco, P)).toBe(pontuar(estrelaFraca, D.CL[estrela.club], vasco, P));
});
