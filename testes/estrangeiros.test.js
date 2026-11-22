// Testes do limite de estrangeiros (public/regras-estrangeiros.json e src/logica/estrangeiros.js).
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FILTROS_PADRAO } from "../src/logica/constantes.js";
import { novoPlano } from "../src/logica/elenco.js";
import { buscarJogadores, contarFiltros } from "../src/logica/mercado.js";
import { contarEstrangeiros, ehEstrangeiro, regraDaLiga, textoRegra, vagasDeEstrangeiro } from "../src/logica/estrangeiros.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

// Plano com titulares e reservas escolhidos à mão: "est" estrangeiros contratados (6 no time, o resto no banco)
// e o resto do time completado com jogadores do país da liga (do próprio elenco).
export function planoComEstrangeiros(k, est) {
  const lg = D.CL[k].lg, nat = D.LG[lg].nat;
  const P = { ...novoPlano(k), budget: 500 };
  const fora = D.ALL.filter((p) => p.club !== k && p.lg !== lg && p.nat && !p.nat.includes(nat) && !p.emp && ehEstrangeiro(p, lg)).slice(0, est);
  P.ins = fora.map((p) => ({ id: p.id, type: "compra", fee: 0 }));
  const locais = D.ALL.filter((p) => p.club === k && p.nat === nat).slice(0, 11);
  const noTime = fora.slice(0, Math.min(6, est)), noBanco = fora.slice(noTime.length);
  const titulares = [...noTime, ...locais].slice(0, 11);
  P.xi = Object.fromEntries(titulares.map((p, i) => [i, p.id]));
  P.res = {};
  noBanco.forEach((p, j) => { const i = j % 11; P.res[i] = [...(P.res[i] || []), p.id]; });
  return P;
}

const achar = (lg, nat) => D.ALL.find((p) => p.lg === lg && p.nat === nat);

test("o arquivo de regras carrega: Brasileirão 9 relacionados (confirmado), Argentina 5, liga sem regra usa o padrão", () => {
  expect(regraDaLiga("BRA")).toMatchObject({ relacionados: 9, campo: null, inscritos: null, confirmado: true });
  expect(regraDaLiga("ARG")).toMatchObject({ relacionados: 5, inscritos: 6, confirmado: true });
  expect(regraDaLiga("ESP")).toMatchObject({ inscritos: 3, tipo: "extracomunitario", confirmado: false });
  expect(regraDaLiga("NED")).toMatchObject({ relacionados: null, campo: null, inscritos: null, confirmado: false }); // padrão
  expect(textoRegra(regraDaLiga("BRA"))).toContain("até 9 entre titulares e reservas");
});

test("LaLiga: espanhol e europeu (UE) não contam; brasileiro conta (extracomunitário)", () => {
  expect(ehEstrangeiro(achar("ESP", "Espanha"), "ESP")).toBe(false);
  expect(ehEstrangeiro(achar("ESP", "Brasil") || achar("ENG", "Brasil"), "ESP")).toBe(true);
  // Países da UE na grafia de Portugal ("Polónia", "República Checa") também não contam
  expect(ehEstrangeiro({ nat: "Polónia" }, "ESP")).toBe(false);
  expect(ehEstrangeiro({ nat: "República Checa" }, "ESP")).toBe(false);
  expect(ehEstrangeiro({ nat: "Inglaterra" }, "ESP")).toBe(true); // fora da UE
  // Dupla nacionalidade: um passaporte da UE basta na LaLiga; no Brasil, ser brasileiro basta
  expect(ehEstrangeiro({ nat: "Brasil/Itália" }, "ESP")).toBe(false);
  expect(ehEstrangeiro({ nat: "Argentina/Brasil" }, "BRA")).toBe(false);
  expect(ehEstrangeiro({ nat: "Argentina/Itália" }, "BRA")).toBe(true);
  // Jogador criado (sem nacionalidade) não conta
  expect(ehEstrangeiro({ nat: "" }, "BRA")).toBe(false);
});

test("Brasileirão: 10 estrangeiros entre titulares e reservas passam do limite de 9; 9 não", () => {
  const P = planoComEstrangeiros("T1974", 10);
  const c = contarEstrangeiros(P);
  expect(c.relacionados).toBe(10);
  expect(c.excede.relacionados).toBe(true);
  const Q = planoComEstrangeiros("T1974", 9);
  expect(contarEstrangeiros(Q).relacionados).toBe(9);
  expect(contarEstrangeiros(Q).excede.relacionados).toBe(false);
  expect(vagasDeEstrangeiro(Q, { titular: false }).relacionados).toBe(0);
});

test("Argentina: 6 relacionados passam do limite de 5; elenco com mais de 6 avisa dos inscritos", () => {
  const k = D.CLUBS.find((c) => c.lg === "ARG").k;
  const P = planoComEstrangeiros(k, 6);
  const c = contarEstrangeiros(P);
  expect(c.relacionados).toBeGreaterThanOrEqual(6);
  expect(c.excede.relacionados).toBe(true);
  expect(c.excede.inscritos).toBe(c.elenco > 6);
});

test("Mercado: filtro 'só quem não ocupa vaga de estrangeiro' e o contador de filtros", () => {
  const P = novoPlano("T1974");
  const base = { ...FILTROS_PADRAO, fit: false };
  const l = buscarJogadores(P, "", 0, { ...base, semEst: true });
  expect(l.length).toBeGreaterThan(100);
  expect(l.every((p) => !ehEstrangeiro(p, "BRA"))).toBe(true);
  expect(buscarJogadores(P, "", 0, base).some((p) => ehEstrangeiro(p, "BRA"))).toBe(true);
  expect(contarFiltros({ ...base, semEst: true })).toBe(1);
});
