// Testes dos empréstimos (public/emprestimos.json): recebidos, emprestados a outros clubes, caixa e elenco.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FILTROS_PADRAO } from "../src/logica/constantes.js";
import { calcularDinheiro } from "../src/logica/dinheiro.js";
import { elencoAtual, emprestadosFora, nChegam, nSaem, novoPlano, recebido, situacaoEmp } from "../src/logica/elenco.js";
import { escalarSozinho } from "../src/logica/escalacao.js";
import { buscarJogadores } from "../src/logica/mercado.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

// Plano do Botafogo no formato antigo (sem o campo "emp"), com € 20 mi
const botafogo = () => ({ club: "T1958", budget: 20, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] });
const arthur = () => D.ALL.find((p) => p.club === "T1958" && p.n === "Arthur Chaves");
const ids = (P) => elencoAtual(P).map((p) => p.id);

test("Botafogo tem Arthur Chaves recebido por empréstimo do Hoffenheim", () => {
  const p = arthur();
  expect(p).toBeTruthy();
  expect(recebido(botafogo(), p)).toBe(true);
  expect(p.emp.de.n).toBe("TSG Hoffenheim");
  expect(p.emp.ate).toBe("2027-12");
  expect(D.EMP.T1958.in).toContain(p.id);
  expect(ids(botafogo())).toContain(p.id);                         // padrão: continua no elenco
});

test("plano antigo sem o campo novo funciona (tudo como 'manter emprestado')", () => {
  const P = botafogo();
  expect(P.emp).toBeUndefined();
  expect(situacaoEmp(P, arthur().id).s).toBe("manter");
  expect(calcularDinheiro(P).caixa).toBe(20);
  expect(nChegam(P)).toBe(0);
  expect(nSaem(P)).toBe(0);
  expect(novoPlano("T1958")).not.toHaveProperty("emp");             // planos novos também começam sem o campo
});

test("devolver um recebido tira do elenco e não mexe no caixa", () => {
  const P = { ...botafogo(), emp: { [arthur().id]: { s: "devolver", fee: 0 } } };
  expect(ids(P)).not.toContain(arthur().id);
  expect(elencoAtual(P).length).toBe(elencoAtual(botafogo()).length - 1);
  expect(calcularDinheiro(P).caixa).toBe(20);
  expect(nSaem(P)).toBe(1);
});

test("comprar um recebido desconta o valor de mercado e ele continua no elenco", () => {
  const p = arthur();
  expect(p.v).toBeGreaterThan(0);
  const P = { ...botafogo(), emp: { [p.id]: { s: "comprar", fee: p.v } } };
  expect(calcularDinheiro(P).caixa).toBeCloseTo(20 - p.v);
  expect(ids(P)).toContain(p.id);
  expect(elencoAtual(P).length).toBe(elencoAtual(botafogo()).length);
});

test("emprestados a outros clubes: não contam; trazer de volta faz contar; vender soma no caixa", () => {
  const fora = emprestadosFora(botafogo());
  expect(fora.length).toBeGreaterThanOrEqual(9);
  const artur = fora.find((o) => o.p.n === "Artur");                // emprestado ao São Paulo (está na base)
  expect(artur.para.n).toBe("São Paulo");
  expect(artur.p.club).toBe("T1981");
  const avulso = fora.find((o) => o.p.avulso);                      // emprestado a clube fora da base
  expect(avulso).toBeTruthy();
  // Não contam no elenco
  const base = elencoAtual(botafogo());
  expect(base.some((p) => fora.some((o) => o.id === p.id))).toBe(false);
  // Trazer de volta: entra no elenco e conta no total
  const volta = { ...botafogo(), emp: { [artur.id]: { s: "voltar", fee: 0 }, [avulso.id]: { s: "voltar", fee: 0 } } };
  expect(elencoAtual(volta).length).toBe(base.length + 2);
  expect(ids(volta)).toContain(artur.id);
  expect(nChegam(volta)).toBe(2);
  // Vender: o valor entra no caixa, e ele continua fora do elenco
  const venda = { ...botafogo(), emp: { [artur.id]: { s: "vender", fee: artur.p.v } } };
  expect(calcularDinheiro(venda).caixa).toBeCloseTo(20 + artur.p.v);
  expect(elencoAtual(venda).length).toBe(base.length);
});

test("escalação: emprestado a outro clube só entra no time se voltar", () => {
  const artur = emprestadosFora(botafogo()).find((o) => o.p.n === "Artur");
  // Deixa o Botafogo sem pontas direitas e manda escalar: o Artur (PD) só pode entrar se voltou
  const semPD = botafogo();
  D.ALL.filter((p) => p.club === "T1958" && ["PD", "PE", "MD", "SA"].includes(p.pos)).forEach((p) => { semPD.st[p.id] = { s: "vende", fee: 0 }; });
  escalarSozinho(semPD);
  expect(Object.values(semPD.xi)).not.toContain(artur.id);
  const comVolta = { ...structuredClone(semPD), emp: { [artur.id]: { s: "voltar", fee: 0 } } };
  escalarSozinho(comVolta);
  expect(Object.values(comVolta.xi)).toContain(artur.id);
});

test("Mercado: emprestado aparece uma vez (no clube onde está); para o dono, não aparece", () => {
  const filtros = { ...FILTROS_PADRAO, fit: false };
  // Para o Botafogo (dono), o Artur não aparece
  expect(buscarJogadores(botafogo(), "Artur", 0, filtros, null).some((p) => p.club === "T1981" && p.n === "Artur")).toBe(false);
  // Para outro clube, aparece uma vez só, no São Paulo, marcado como emprestado pelo Botafogo
  const outro = { ...novoPlano("T42"), budget: 50 };
  const achados = buscarJogadores(outro, "Artur", 0, filtros, null).filter((p) => p.n === "Artur" && p.nasc === "1998-02-15");
  expect(achados.length).toBe(1);
  expect(achados[0].club).toBe("T1981");
  expect(achados[0].emp.de.n).toBe("Botafogo");
  // Nenhum jogador aparece duas vezes no Mercado (mesmo nome + nascimento em dois clubes)
  const vistos = new Map();
  for (const p of D.ALL) if (p.emp) { const k = p.n + "|" + p.nasc; vistos.set(k, (vistos.get(k) || 0) + 1); }
  expect([...vistos.values()].every((n) => n === 1)).toBe(true);
});
