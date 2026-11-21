// Testes da aba Time: compatibilidade de posição (compatibilidade.js) e reservas (escalacao.js).
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FORMS } from "../src/logica/constantes.js";
import { compatibilidade, nivel, rotuloVaga } from "../src/logica/compatibilidade.js";
import { elencoAtual } from "../src/logica/elenco.js";
import { adicionarReserva, completarTime, escalarSozinho, forcaAntes, forcaDoTime, limparReservas, moverReservas, promover, reservasDa, todosReservas, trocarComReserva, trocarTitulares } from "../src/logica/escalacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

// Plano do Arsenal no formato antigo (sem "res"), com o time escalado
const arsenal = (form = "4-3-3") => { const P = { club: "T42", budget: 50, st: {}, ins: [], form, xi: {}, custom: [] }; escalarSozinho(P); return P; };
const vagaDe = (form, r) => FORMS[form].findIndex((v) => v[0] === r);

test("3-5-2: a vaga de ala se chama ALA; ME é ideal e VOL é boa", () => {
  const ale = vagaDe("3-5-2", "ALE"), ald = vagaDe("3-5-2", "ALD");
  expect(ale).toBeGreaterThanOrEqual(0);
  expect(ald).toBeGreaterThanOrEqual(0);
  expect(rotuloVaga("ALE")).toBe("ALA");
  expect(rotuloVaga("ALD")).toBe("ALA");
  expect(FORMS["3-5-2"].some((v) => v[0] === "LE" || v[0] === "LD")).toBe(false); // não sobra LE/LD com 3 zagueiros
  expect(nivel("ALE", "ME")).toBe("ideal");
  expect(nivel("ALE", "LE")).toBe("ideal");
  expect(nivel("ALE", "VOL")).toBe("boa");
  expect(nivel("ALD", "MD")).toBe("ideal");
  expect(nivel("ALD", "VOL")).toBe("boa");
  expect(nivel("ALE", "MEI")).toBe("improvisado");
});

test("CA na vaga de zagueiro é improvisado; o resto segue a tabela", () => {
  expect(nivel("ZAG", "CA")).toBe("improvisado");
  expect(nivel("ZAG", "VOL")).toBe("boa");
  expect(nivel("ZAG", "LE")).toBe("improvisado");
  expect(nivel("GOL", "ZAG")).toBe("improvisado");
  expect(nivel("MC", "VOL")).toBe("ideal");
  expect(nivel("LE", "PE")).toBe("boa");
  // Atacantes (PE, PD, SA e CA) são ideais em qualquer vaga do ataque, mas a posição de origem vem primeiro
  for (const v of ["PE", "PD", "SA", "CA"]) for (const pos of ["PE", "PD", "SA", "CA"]) expect(nivel(v, pos)).toBe("ideal");
  expect(compatibilidade("CA", "CA").ordem).toBeLessThan(compatibilidade("CA", "PE").ordem);
  expect(nivel("ME", "CA")).toBe("improvisado"); // meia pelo lado não é ataque
  // Pontas jogam nos dois lados e nas meias pelos lados; MC joga de VOL e de MEI
  for (const v of ["PE", "PD", "ME", "MD"]) for (const pos of ["PE", "PD"]) expect(nivel(v, pos)).toBe("ideal");
  expect(nivel("VOL", "MC")).toBe("ideal");
  expect(nivel("MEI", "MC")).toBe("ideal");
  // A posição principal da vaga vem primeiro: na PD, o PD antes do PE
  expect(compatibilidade("PD", "PD").ordem).toBeLessThan(compatibilidade("PD", "PE").ordem);
  // Improvisado da tabela vem antes do improvisado "qualquer coisa"
  expect(compatibilidade("PE", "LE").ordem).toBeLessThan(compatibilidade("PE", "GOL").ordem);
});

test("escalar sozinho pelo valor ou pelo overall", () => {
  const gol = vagaDe("4-3-3", "GOL"), ca = vagaDe("4-3-3", "CA");
  const doElenco = (P, pos) => elencoAtual(P).filter((p) => p.pos === pos);
  const porValor = arsenal();
  const porOverall = { ...arsenal(), xi: {} };
  escalarSozinho(porOverall, "o");
  // No gol e no centroavante entra o melhor da posição pelo critério escolhido
  for (const [i, pos] of [[gol, "GOL"], [ca, "CA"]]) {
    const ps = doElenco(porValor, pos);
    expect(D.BYID[porValor.xi[i]].v).toBe(Math.max(...ps.map((p) => p.v)));
    expect(D.BYID[porOverall.xi[i]].ovr).toBe(Math.max(...ps.map((p) => p.ovr)));
  }
  expect(Object.keys(porOverall.xi)).toHaveLength(11);
  // Pelo overall, a força do time não fica abaixo da escalação pelo valor neste elenco
  expect(forcaDoTime(porOverall).media).toBeGreaterThanOrEqual(forcaDoTime(porValor).media);
  // A força "antes" usa o mesmo critério: sem mudanças no plano, antes = depois
  expect(forcaAntes(porOverall, "o").media).toBe(forcaDoTime(porOverall).media);
});

test("até 2 reservas por vaga: o 3º não entra", () => {
  const P = arsenal();
  const ce = vagaDe("4-3-3", "CA");
  const livres = elencoAtual(P).filter((p) => !Object.values(P.xi).includes(p.id));
  expect(adicionarReserva(P, ce, livres[0].id)).toBe(true);
  expect(adicionarReserva(P, ce, livres[1].id)).toBe(true);
  expect(adicionarReserva(P, ce, livres[2].id)).toBe(false);
  expect(reservasDa(P, ce)).toEqual([livres[0].id, livres[1].id]);
});

test("o mesmo jogador não entra em duas vagas (nem titular e reserva ao mesmo tempo)", () => {
  const P = arsenal();
  const livre = elencoAtual(P).find((p) => !Object.values(P.xi).includes(p.id));
  expect(adicionarReserva(P, 1, livre.id)).toBe(true);
  expect(adicionarReserva(P, 2, livre.id)).toBe(false);          // reserva de duas vagas
  expect(adicionarReserva(P, 3, P.xi[0])).toBe(false);           // o titular do gol como reserva
  // Se um reserva vira titular de outra vaga, sai do banco
  P.xi[5] = livre.id;
  limparReservas(P);
  expect(todosReservas(P)).not.toContain(livre.id);
});

test("promover a titular troca titular e reserva de lugar", () => {
  const P = arsenal();
  const titular = P.xi[0];
  const goleiro = elencoAtual(P).find((p) => p.pos === "GOL" && p.id !== titular);
  adicionarReserva(P, 0, goleiro.id);
  promover(P, 0, goleiro.id);
  expect(P.xi[0]).toBe(goleiro.id);
  expect(reservasDa(P, 0)).toEqual([titular]);
});

test("vendido, liberado ou emprestado fora não fica no banco; trocar de formação mantém as vagas que continuam", () => {
  const P = arsenal();
  const livres = elencoAtual(P).filter((p) => !Object.values(P.xi).includes(p.id));
  const gol = 0, ce = vagaDe("4-3-3", "CA");
  adicionarReserva(P, gol, livres.find((p) => p.pos === "GOL").id);
  adicionarReserva(P, ce, livres.find((p) => p.pos === "CA" || p.pos === "SA").id);
  const reservaGol = reservasDa(P, gol)[0];
  // Vender o reserva do gol: some do banco
  const Q = structuredClone(P);
  Q.st[reservaGol] = { s: "vende", fee: 1 };
  completarTime(Q);
  expect(todosReservas(Q)).not.toContain(reservaGol);
  // 4-3-3 → 3-5-2: o gol continua (vaga 0) e leva o reserva; o CA (1º CA) também
  const R = structuredClone(P);
  const reservaCA = reservasDa(R, ce)[0];
  moverReservas(R, "4-3-3", "3-5-2");
  R.form = "3-5-2";
  escalarSozinho(R);
  completarTime(R);
  if (!Object.values(R.xi).includes(reservaGol)) expect(reservasDa(R, 0)).toContain(reservaGol);
  const ceNova = vagaDe("3-5-2", "CA");
  if (!Object.values(R.xi).includes(reservaCA)) expect(reservasDa(R, ceNova)).toContain(reservaCA);
});

test("plano antigo sem 'res' funciona", () => {
  const P = arsenal();
  expect(P.res).toBeUndefined();
  expect(todosReservas(P)).toEqual([]);
  expect(reservasDa(P, 0)).toEqual([]);
  completarTime(P);
  expect(P.res).toBeUndefined();                                  // não cria o campo à toa
});

test("trocar de posição: dois titulares, titular para vaga vazia e titular com reserva de outra vaga", () => {
  const P = arsenal();
  const ld = vagaDe("4-3-3", "LD"), le = vagaDe("4-3-3", "LE"), ca = vagaDe("4-3-3", "CA"), gol = vagaDe("4-3-3", "GOL");
  const [a, b] = [P.xi[ld], P.xi[le]];
  trocarTitulares(P, ld, le);
  expect([P.xi[ld], P.xi[le]]).toEqual([b, a]);
  // Vaga vazia: o titular só muda de vaga
  delete P.xi[le];
  trocarTitulares(P, ld, le);
  expect(P.xi[le]).toBe(b);
  expect(P.xi[ld]).toBeUndefined();
  // Reserva do goleiro entra como centroavante; o centroavante vai para o banco no lugar dele
  const livre = elencoAtual(P).find((p) => !Object.values(P.xi).includes(p.id));
  adicionarReserva(P, gol, livre.id);
  const cent = P.xi[ca];
  expect(trocarComReserva(P, ca, livre.id)).toBe(true);
  expect(P.xi[ca]).toBe(livre.id);
  expect(reservasDa(P, gol)).toEqual([cent]);
  expect(trocarComReserva(P, ca, "não-é-reserva")).toBe(false);
});