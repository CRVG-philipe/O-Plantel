// Testes da busca do Mercado: apelidos (public/apelidos.json) e nomes com acento, hífen ou ponto.
import fs from "node:fs";
import { beforeAll, expect, test } from "vitest";
import { D, carregarDados } from "../src/logica/dados.js";
import { FILTROS_PADRAO } from "../src/logica/constantes.js";
import { novoPlano } from "../src/logica/elenco.js";
import { buscarJogadores } from "../src/logica/mercado.js";
import { norm } from "../src/logica/formato.js";

const APELIDOS = JSON.parse(fs.readFileSync("public/apelidos.json", "utf8"));

beforeAll(async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync("public/" + url, "utf8")) });
  await carregarDados();
});

// Busca num plano do Vasco (nenhum jogador procurado aqui é do Vasco), sem o "só quem cabe no caixa"
const buscar = (texto) => buscarJogadores({ ...novoPlano("T1974"), budget: 50 }, texto, 0, { ...FILTROS_PADRAO, fit: false }, null);

test("todo apelido aponta para um jogador que existe no data.json", () => {
  const nomes = new Set(D.ALL.map((p) => p.n));
  for (const [apelido, nome] of Object.entries(APELIDOS)) expect(nomes.has(nome), `${apelido} → ${nome}`).toBe(true);
});

test("gabigol e vozinha encontram o jogador certo, no topo", () => {
  const gabigol = buscar("gabigol");
  expect(gabigol[0].n).toBe("Gabriel Barbosa");
  expect(D.CL[gabigol[0].club].n).toBe("Santos");
  expect(buscar("Gabigol")[0].n).toBe("Gabriel Barbosa");                 // maiúscula não importa
  const vozinha = buscar("vozinha");
  expect(vozinha[0].n).toBe("Vozinha");
  expect(D.CL[vozinha[0].club].n).toBe("Colo-Colo");
});

test("quem bate pelo apelido vem antes de quem só tem o texto no nome", () => {
  const messi = buscar("messi");
  expect(messi[0].n).toBe("Lionel Messi");
  expect(messi.some((p) => p.n === "Messias")).toBe(true);                // "Messias" também aparece, mas depois
  expect(buscar("hulk")[0].n).toBe("Hulk");
  expect(buscar("cr7")[0].n).toBe("Cristiano Ronaldo");
  expect(buscar("gabi").map((p) => p.n)).toContain("Gabriel Barbosa");     // começo do apelido (3+ letras)
});

test("busca sem acento, hífen nem ponto", () => {
  expect(norm("Pepê")).toBe("pepe");
  expect(norm("Vini Jr.")).toBe("vini jr");
  expect(norm("Alexander-Arnold")).toBe("alexander arnold");
  expect(buscar("pepe").map((p) => p.n)).toContain("Pepê");
  expect(buscar("vini jr.")[0].n).toBe("Vinicius Junior");
  expect(buscar("alexander arnold")[0].n).toBe("Trent Alexander-Arnold");
  expect(buscar("odegaard").map((p) => p.n)).toContain("Martin Ødegaard");
  expect(buscar("arrascaeta")[0].n).toBe("Giorgian de Arrascaeta");        // palavra do meio do nome
});
