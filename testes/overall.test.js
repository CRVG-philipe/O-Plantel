// Testes do overall e dos atributos (public/overall.json): carga, força do time, ordem "Overall" e recomendação.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FILTROS_PADRAO } from "../src/logica/constantes.js";
import { jogador, novoPlano } from "../src/logica/elenco.js";
import { escalarSozinho, forcaAntes, forcaDoTime } from "../src/logica/escalacao.js";
import { buscarJogadores, contarFiltros, nacionalidadesDoMercado } from "../src/logica/mercado.js";
import { codigoDoPais } from "../src/logica/nacionalidades.js";
import { pontuar } from "../src/logica/recomendacao.js";

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

const achar = (nome, nasc) => D.ALL.find((p) => p.n === nome && (!nasc || p.nasc === nasc));

test("o overall do Mbappé é 91, com os 5 atributos de jogador de linha", () => {
  const m = achar("Kylian Mbappé", "1998-12-20");
  expect(m.ovr).toBe(91);
  expect(m.atr.tipo).toBe("L");
  expect(m.atr.v).toHaveLength(5);
});

test("todo jogador da base tem overall (o script limita entre 40 e 92); não existe mais overall estimado", () => {
  expect(D.ALL.every((p) => p.ovr >= 40 && p.ovr <= 92)).toBe(true);
  expect(D.ALL.some((p) => "ovrEst" in p)).toBe(false);
  const arq = JSON.parse(fs.readFileSync("public/overall.json", "utf8"));
  expect(Object.values(arq).every((c) => Object.values(c).every((v) => v[1] === 0))).toBe(true);
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

test("Mercado: faixas de overall e de idade (0 a 100)", () => {
  const P = novoPlano("T1974");
  const base = { ...FILTROS_PADRAO, fit: false };
  const todos = buscarJogadores(P, "", 0, base).length;
  const l = buscarJogadores(P, "", 0, { ...base, ovr: [70, 80], idade: [15, 49] });
  expect(l.length).toBeGreaterThan(100);
  expect(l.length).toBeLessThan(todos);
  expect(l.every((p) => p.ovr >= 70 && p.ovr <= 80 && p.a >= 15 && p.a <= 49)).toBe(true);
  // Faixa inteira (0–100) não filtra nada; os limites entram na faixa
  expect(buscarJogadores(P, "", 0, { ...base, ovr: [0, 100], idade: [0, 100] }).length).toBe(todos);
  expect(buscarJogadores(P, "", 0, { ...base, ovr: [91, 91] }).every((p) => p.ovr === 91)).toBe(true);
  expect(buscarJogadores(P, "", 0, { ...base, ovr: [91, 91] }).length).toBeGreaterThan(0);
  // Cada faixa ligada conta 1 no botão "Filtros"
  expect(contarFiltros({ ...base, ovr: [70, 80] })).toBe(1);
  expect(contarFiltros({ ...base, ovr: [70, 80], idade: [0, 23] })).toBe(2);
  expect(contarFiltros(base)).toBe(0);
});

test("rodada 3: 20 ligas novas, todo jogador com overall, e dupla nacionalidade ('Bolívia/Argentina')", () => {
  const novas = ["BOL", "VEN", "ARG2", "COL2", "PER2", "CHI2", "EGY", "MAR", "RSA", "AUS", "ISR", "HUN", "SVK", "BUL", "CYP", "SVN", "CAN", "CRC", "HON", "USL"];
  expect(novas.every((k) => D.LG[k])).toBe(true);
  expect(D.LG.USL.div).toBe(2);
  expect(D.ALL.filter((p) => novas.includes(p.lg)).every((p) => p.ovr >= 40)).toBe(true);
  // Dupla nacionalidade: o filtro acha pelos dois países e a lista do filtro conta nos dois
  const duplo = D.ALL.find((p) => p.nat === "Bolívia/Argentina");
  expect(duplo).toBeTruthy();
  const P = novoPlano("T1974");
  const base = { ...FILTROS_PADRAO, fit: false, lg: duplo.lg };
  for (const n of ["Bolívia", "Argentina"]) expect(buscarJogadores(P, "", 0, { ...base, nat: n }).some((p) => p.id === duplo.id)).toBe(true);
  const nats = nacionalidadesDoMercado(P, duplo.lg, "");
  expect(nats.some(([n]) => n.includes("/"))).toBe(false);
  expect(codigoDoPais(duplo.nat)).toBe("bo"); // a bandeira é a do primeiro país
});

test("ajustes manuais do arquivo: Fábio (Fluminense, goleiro) 78 e Thiago Mendes (Vasco) 79", () => {
  const fabio = D.ALL.find((p) => p.n === "Fábio" && p.club === "T1961");
  expect(fabio.pos).toBe("GOL");
  expect(fabio.ovr).toBe(78);
  expect(D.ALL.find((p) => p.n === "Thiago Mendes" && p.club === "T1974").ovr).toBe(79);
  expect(D.ALL.find((p) => p.n === "Richarlison" && p.club === "T33").ovr).toBe(80); // Tottenham
  // Todo ajuste do arquivo bate com um jogador da base e vale no lugar do overall.json
  const ajustes = JSON.parse(fs.readFileSync("public/overall-ajustes.json", "utf8"));
  for (const [k, js] of Object.entries(ajustes))
    for (const [chave, ovr] of Object.entries(js)) {
      const p = D.ALL.find((x) => x.club === k && x.n + "|" + x.nasc === chave);
      expect(p, chave).toBeTruthy();
      expect(p.ovr).toBe(ovr);
    }
});

test("ajuste manual (overall-ajustes.json) troca só o número do overall; os atributos continuam", async () => {
  const lerPublic = (url) => JSON.parse(fs.readFileSync("public/" + url, "utf8"));
  const mbappe = () => achar("Kylian Mbappé", "1998-12-20");
  const atr = mbappe().atr, haaland = achar("Erling Haaland").ovr;
  const carregarCom = async (ajustes) => {
    globalThis.fetch = async (url) => {
      if (url === "overall-ajustes.json") { if (!ajustes) throw new Error("fora do ar"); return { ok: true, json: async () => ajustes }; }
      return { ok: true, json: async () => lerPublic(url) };
    };
    await carregarDados();
  };
  await carregarCom({ T2829: { "Kylian Mbappé|1998-12-20": 80 } });
  expect(mbappe().ovr).toBe(80);
  expect(mbappe().atr).toEqual(atr);
  expect(achar("Erling Haaland").ovr).toBe(haaland); // quem não tem ajuste não muda
  // Arquivo de ajustes fora do ar: segue com o número do overall.json
  await carregarCom(null);
  expect(mbappe().ovr).toBe(91);
  await carregarCom(lerPublic("overall-ajustes.json")); // volta ao normal para os outros testes
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
