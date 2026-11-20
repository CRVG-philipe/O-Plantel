// Testes do app inteiro: simulam cliques como uma pessoa usando o site.
// Rodar com:  npm test
import fs from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App.jsx";
import { eur } from "../src/logica/dinheiro.js";

const DATA = JSON.parse(fs.readFileSync("public/data.json", "utf8"));
const CHAVE = "plantel:v2";

// ---------- preparação do "navegador de mentira" ----------
beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = async () => ({ json: async () => structuredClone(DATA) });
  window.matchMedia = () => ({ matches: false });
  window.scrollTo = () => {};
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(() => Promise.resolve()) }, configurable: true });
});
afterEach(cleanup);

// ---------- atalhos ----------
const painel = () => document.querySelector(".ov.on .sheet");          // painel aberto (ou null)
const noPainel = () => within(painel());
const naPagina = () => within(document.querySelector("main"));
const caixa = () => document.querySelector("#bud b").textContent;
const aviso = () => document.querySelector("#toast.on")?.textContent;
const salvo = () => JSON.parse(localStorage.getItem(CHAVE));
const clique = (el) => fireEvent.click(el);
const clubesDa = (lg) => DATA.clubs.filter((c) => c.lg === lg).sort((a, b) => a.n.localeCompare(b.n));

test("fluxo completo: liga, clube, vender, contratar, filtros, escalação, resumo e reiniciar", async () => {
  render(<App />);

  // 1. Escolha de liga e clube
  const bra = clubesDa("BRA"), eng = clubesDa("ENG");
  expect(await screen.findByRole("heading", { name: bra[0].n })).toBeTruthy();
  clique(screen.getByRole("button", { name: "Premier League" }));
  expect(screen.getByRole("heading", { name: eng[0].n })).toBeTruthy();
  expect(screen.getByText(`1 de ${eng.length}`)).toBeTruthy();
  clique(screen.getByRole("button", { name: "Próximo clube" }));
  expect(screen.getByText(`2 de ${eng.length}`)).toBeTruthy();
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(screen.getByText(`3 de ${eng.length}`)).toBeTruthy();
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  fireEvent.keyDown(document, { key: "ArrowLeft" }); // volta e dá a volta para o último
  expect(screen.getByText(`${eng.length} de ${eng.length}`)).toBeTruthy();
  clique(screen.getByRole("button", { name: "Arsenal" }));
  expect(screen.getByRole("heading", { name: "Arsenal" })).toBeTruthy();

  // 2. Abrir o clube: pede o orçamento
  clique(screen.getByRole("button", { name: "Planejar 27/28" }));
  expect(noPainel().getByText("Quanto você tem para gastar?")).toBeTruthy();
  clique(noPainel().getByRole("button", { name: "€50 mi" }));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  expect(painel()).toBeNull();
  expect(caixa()).toBe("€50 mi");
  expect(salvo().last).toBe("T42");

  // 3. Vender o David Raya por €40 mi
  clique(naPagina().getByText("David Raya").closest("button"));
  clique(noPainel().getByRole("button", { name: /Vender/ }));
  const valor = noPainel().getByLabelText(/Valor da venda/);
  expect(valor.value).toBe("30");
  fireEvent.change(valor, { target: { value: "40" } });
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(caixa()).toBe("€90 mi");
  expect(naPagina().getByText("Vendido €40 mi")).toBeTruthy();
  const raya = DATA.clubs.find((c) => c.k === "T42").p.findIndex((r) => r[1] === "David Raya");
  expect(salvo().plans.T42.st[`T42-${raya}`]).toEqual({ s: "vende", fee: 40 });
  // Raya era o goleiro titular: o time deve ter outro goleiro agora
  expect(salvo().plans.T42.xi[0]).not.toBe(`T42-${raya}`);

  // 4. Mercado: buscar e contratar
  clique(screen.getByRole("tab", { name: "Mercado" }));
  const alvo = DATA.clubs.filter((c) => c.lg === "ESP").flatMap((c) => c.p.map((r) => ({ n: r[1], v: r[5], clube: c.n }))).sort((a, b) => b.v - a.v)[0];
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: alvo.n } });
  clique(naPagina().getAllByText(alvo.n)[0].closest("button"));
  clique(noPainel().getByRole("button", { name: "Contratar" }));
  expect(aviso()).toBe(alvo.n + " contratado");
  expect(painel()).toBeNull();
  // o contratado some do mercado
  expect(naPagina().queryByText(alvo.n)).toBeNull();

  // 5. Filtros: só LaLiga, depois limpar
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "" } });
  clique(screen.getByRole("button", { name: "Filtros" }));
  fireEvent.change(noPainel().getByLabelText("Liga"), { target: { value: "ESP" } });
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros1"); // "Filtros" + bolinha com 1
  const nomesEsp = new Set(DATA.clubs.filter((c) => c.lg === "ESP").map((c) => c.n));
  const linhas = document.querySelectorAll("#mList .row");
  expect(linhas.length).toBe(40); // mostra 40 por vez
  linhas.forEach((l) => expect([...nomesEsp].some((n) => l.querySelector(".sub").textContent.includes(n))).toBe(true));
  clique(screen.getByRole("button", { name: /Mostrar mais/ }));
  expect(document.querySelectorAll("#mList .row").length).toBe(80);
  clique(screen.getByRole("button", { name: "Goleiros" }));
  document.querySelectorAll("#mList .row .sub:not(.st)").forEach((s) => expect(s.textContent.startsWith("GOL")).toBe(true));
  clique(screen.getByRole("button", { name: /Filtros/ }));
  clique(noPainel().getByRole("button", { name: "Limpar" }));
  expect(screen.getByRole("button", { name: "Filtros" })).toBeTruthy();

  // 6. Criar jogador
  clique(screen.getByRole("button", { name: "Todos" }));
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "zzzz" } });
  expect(screen.getByText("Nenhum jogador encontrado.")).toBeTruthy();
  clique(screen.getByRole("button", { name: "Criar jogador" }));
  fireEvent.change(noPainel().getByLabelText("Nome"), { target: { value: "Joãozinho Teste" } });
  fireEvent.change(noPainel().getByLabelText("Posição"), { target: { value: "CA" } });
  fireEvent.change(noPainel().getByLabelText("Valor (€ mi)"), { target: { value: "2" } });
  clique(noPainel().getByRole("button", { name: "Criar e contratar" }));
  expect(aviso()).toBe("Joãozinho Teste contratado");
  expect(caixa()).toBe(eur(90 - alvo.v - 2));
  expect(document.querySelector("#bud").className).toBe(90 - alvo.v - 2 < 0 ? "neg" : ""); // vermelho se negativo

  // 7. Time: formação, trocar goleiro, escalar sozinho
  clique(screen.getByRole("tab", { name: "Time" }));
  fireEvent.change(screen.getByLabelText("Formação"), { target: { value: "4-4-2" } });
  expect(salvo().plans.T42.form).toBe("4-4-2");
  expect(document.querySelectorAll(".slot").length).toBe(11);
  const golAntes = document.querySelector(".slot .lb").textContent;
  clique(screen.getByRole("button", { name: new RegExp("^Goleiro: ") }));
  expect(noPainel().getByText("Escolha quem joga nesta posição")).toBeTruthy();
  const outro = noPainel().getAllByRole("button").find((b) => b.classList.contains("row") && !b.textContent.includes("atual"));
  clique(outro);
  expect(document.querySelector(".slot .lb").textContent).not.toBe(golAntes);
  clique(screen.getByRole("button", { name: "Escalar sozinho" }));
  expect(aviso()).toBe("Time escalado pelos mais valiosos");

  // 8. Resumo
  clique(screen.getByRole("tab", { name: "Resumo" }));
  expect(naPagina().getByText(alvo.n)).toBeTruthy();
  expect(naPagina().getByText("Joãozinho Teste")).toBeTruthy();
  expect(naPagina().getByText("David Raya")).toBeTruthy();
  await act(async () => clique(screen.getByRole("button", { name: "Copiar resumo" })));
  expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
  expect(navigator.clipboard.writeText.mock.calls[0][0]).toMatch(/^Arsenal 27\/28 \(planejado no Plantel\)/);
  expect(aviso()).toBe("Resumo copiado");

  // 9. Reiniciar progresso (precisa de dois toques)
  clique(screen.getByRole("button", { name: "Reiniciar progresso" }));
  clique(noPainel().getByRole("button", { name: /Reiniciar todo o progresso do Arsenal/ }));
  expect(salvo().plans.T42.ins.length).toBe(2); // ainda não apagou
  clique(noPainel().getByRole("button", { name: /Toque de novo para apagar tudo/ }));
  expect(noPainel().getByText("Quanto você tem para gastar?")).toBeTruthy();
  expect(aviso()).toBe("Progresso do Arsenal reiniciado");
  expect(salvo().plans.T42).toMatchObject({ budget: null, st: {}, ins: [], custom: [], form: "4-3-3" });
  clique(noPainel().getByRole("button", { name: "Começar" })); // aceita os €20 mi sugeridos
  expect(caixa()).toBe("€20 mi");
  expect(screen.getByRole("tab", { name: "Elenco" }).getAttribute("aria-selected")).toBe("true");

  // 10. Trocar de clube: volta ao carrossel no Arsenal, com o plano salvo
  clique(document.querySelector(".clubBtn"));
  clique(noPainel().getByRole("button", { name: /Trocar de clube/ }));
  expect(screen.getByRole("heading", { name: "Arsenal" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continuar meu plano" })).toBeTruthy();
  expect(document.querySelector("#planBar")).toBeNull();
});

test("abre direto num plano salvo pela versão antiga do site (mesma chave plantel:v2)", async () => {
  const c = clubesDa("BRA")[3];
  // Plano no formato exato que o site antigo salvava
  localStorage.setItem(CHAVE, JSON.stringify({
    plans: { [c.k]: { club: c.k, budget: 30, st: { [c.k + "-0"]: { s: "vende", fee: 12.5 } }, ins: [], form: "3-5-2", xi: {}, custom: [] } },
    last: c.k,
  }));
  render(<App />);
  expect(await screen.findByRole("tab", { name: "Elenco" })).toBeTruthy();
  expect(document.querySelector(".clubBtn").textContent).toBe(c.n);
  expect(caixa()).toBe("€42,5 mi");
  expect(painel()).toBeNull(); // orçamento já existe: não pede de novo
  expect(Object.keys(salvo().plans[c.k].xi).length).toBeGreaterThan(0); // escalou sozinho ao abrir
  clique(screen.getByRole("tab", { name: "Time" }));
  expect(screen.getByLabelText("Formação").value).toBe("3-5-2");
});

test("escudos em alta resolução em todos os lugares (sem sprite)", async () => {
  const idDe = (k) => DATA.clubs.find((c) => c.k === k).hd;
  // Confere todos os escudos visíveis agora: <img> do arquivo certo, nenhum sprite
  const conferir = (onde, minimo) => {
    const els = [...document.querySelectorAll(onde + " .crest")];
    expect(els.length).toBeGreaterThanOrEqual(minimo);
    for (const el of els) {
      expect(el.tagName).toBe("IMG");
      const clube = DATA.clubs.find((c) => c.n === el.alt);
      expect(el.getAttribute("src")).toBe(`img/teams/${idDe(clube.k)}.webp`);
    }
    expect(document.querySelector('[style*="crests.webp"]')).toBeNull();
  };
  expect(DATA.clubs.every((c) => c.hd > 0)).toBe(true); // os 214 clubes marcados

  render(<App />);
  await screen.findByRole("button", { name: /Planejar 2027/ });
  conferir("#stage", 1);                                             // carrossel
  conferir("#strip", clubesDa("BRA").length);                        // grade
  clique(screen.getByRole("button", { name: /Planejar 2027/ }));
  conferir(".ov.on .sheet", 1);                                      // painel do orçamento
  clique(noPainel().getByRole("button", { name: "Começar" }));
  conferir(".top", 1);                                               // topo
  clique(document.querySelector(".clubBtn"));
  conferir(".ov.on .sheet", 1);                                      // painel do clube
});

test("Esc e clique fora fecham o painel", async () => {
  render(<App />);
  clique(await screen.findByRole("button", { name: /Planejar 2027/ }));
  expect(painel()).not.toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(painel()).toBeNull();
  clique(screen.getByRole("button", { name: /Caixa/ }));
  expect(noPainel().getByText("Orçamento")).toBeTruthy();
  clique(document.querySelector(".ov"));
  expect(painel()).toBeNull();
});
