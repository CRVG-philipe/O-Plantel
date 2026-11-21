// Testes do app inteiro: simulam cliques como uma pessoa usando o site.
// Rodar com:  npm test
import fs from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App.jsx";
import { dinheiro } from "../src/logica/dinheiro.js";
import { corDeFundo } from "../src/logica/formato.js";

const DATA = JSON.parse(fs.readFileSync("public/data.json", "utf8"));
const APELIDOS = JSON.parse(fs.readFileSync("public/apelidos.json", "utf8"));
const ESTIMADOS = JSON.parse(fs.readFileSync("public/valores-estimados.json", "utf8"));
const EMPRESTIMOS = JSON.parse(fs.readFileSync("public/emprestimos.json", "utf8"));
const OVERALL = JSON.parse(fs.readFileSync("public/overall.json", "utf8"));
let semEstimados = false; // true = simula o valores-estimados.json fora do ar
const CHAVE = "plantel:v2";
// Cotação que a "API de mentira" devolve nos testes
const COTACAO_TESTE = { amount: 1, base: "EUR", date: "2026-11-19", rates: { BRL: 6, USD: 1.1 } };
let apiCotacaoFora = false; // true = simula a API de cotação fora do ar

// ---------- preparação do "navegador de mentira" ----------
beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  apiCotacaoFora = false;
  semEstimados = false;
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes("frankfurter")) {
      if (apiCotacaoFora) throw new Error("sem internet");
      return { ok: true, json: async () => structuredClone(COTACAO_TESTE) };
    }
    if (String(url).includes("apelidos")) return { ok: true, json: async () => structuredClone(APELIDOS) };
    if (String(url).includes("emprestimos")) return { ok: true, json: async () => structuredClone(EMPRESTIMOS) };
    if (String(url).includes("overall-ajustes")) return { ok: true, json: async () => ({}) };
    if (String(url).includes("overall")) return { ok: true, json: async () => structuredClone(OVERALL) };
    if (String(url).includes("valores-estimados")) {
      if (semEstimados) throw new Error("fora do ar");
      return { ok: true, json: async () => structuredClone(ESTIMADOS) };
    }
    return { ok: true, json: async () => structuredClone(DATA) };
  });
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
const botao = (nome) => screen.getByRole("button", { name: nome });
// Telas antes do plano
const passoTxt = () => document.querySelector(".esc-passo span").textContent;      // "X de Y"
const titulo = () => document.querySelector(".esc-nome").textContent;              // nome do clube
const fundo = () => document.querySelector(".esc").style.backgroundColor;
const rodape = () => document.querySelector("footer .cotacao").textContent;
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const cartaoPais = (nome) => [...document.querySelectorAll(".esc-pais")].find((b) => b.querySelector(".esc-pais-nome").textContent === nome);
// Do início até a etapa do clube de uma liga do Brasil
async function irParaBrasil(divisao = /Brasileirão Série A/) {
  clique(await screen.findByRole("button", { name: "Planejar um clube" }));
  clique(cartaoPais("Brasil"));
  clique(botao(divisao));
}
// Espera a cotação da "API de mentira" chegar (aparece no rodapé)
const esperarCotacao = () => screen.findByText(/€1 = R\$ 6,00/);

test("tela inicial: título, números, linhas de campo e cotação no rodapé", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Planejar um clube" });
  expect(document.querySelector(".ini-titulo").textContent).toBe("Monte o elencodo seu timepara 2027");
  expect(screen.getByText("Venda, contrate, escale e veja onde o elenco ainda tem buracos.")).toBeTruthy();
  const comValor = DATA.clubs.flatMap((c) => c.p).filter((p) => p[5] > 0).length;
  const numeros = [...document.querySelectorAll(".ini-numeros .esc-card")].map((c) => c.textContent);
  expect(numeros).toEqual([`${DATA.clubs.length}clubes em ${DATA.leagues.length} ligas`, `${comValor.toLocaleString("pt-BR")}jogadores com valor`]);
  expect(numeros[0]).toBe("798clubes em 46 ligas");
  expect(screen.queryByText("Seus planos")).toBeNull();          // ninguém tem plano ainda
  expect(fundo()).toBe(rgb("#0f3d2b"));
  expect(document.querySelectorAll("svg.campo rect, svg.campo line, svg.campo circle").length).toBe(5);
  expect(document.querySelector(".esc-voltar")).toBeNull();      // sem "voltar" no início
  // Moeda: € marcado; cotação buscada na API, mostrada no rodapé e guardada no navegador
  expect(botao("€").getAttribute("aria-pressed")).toBe("true");
  await esperarCotacao();
  expect(rodape()).toBe("€1 = R$ 6,00 · US$ 1,10 (BCE, 19/11/2026)");
  expect(JSON.parse(localStorage.getItem("plantel:cotacao"))).toEqual({ BRL: 6, USD: 1.1, data: "2026-11-19" });
  expect(fetch).toHaveBeenCalledWith("https://api.frankfurter.dev/v1/latest?from=EUR&to=BRL,USD");
});

test("escolha em etapas: grade de países, divisão, clube e o botão voltar", async () => {
  render(<App />);
  clique(await screen.findByRole("button", { name: "Planejar um clube" }));

  // País: grade com os 20 países, bandeira, nome e ligas
  expect(screen.getByRole("heading", { name: "Escolha o país" })).toBeTruthy();
  expect(passoTxt()).toBe("1 de 3");
  expect(fundo()).toBe(rgb("#1f2a24"));
  const cartoes = [...document.querySelectorAll(".esc-pais")];
  expect(cartoes.map((c) => c.querySelector(".esc-pais-nome").textContent)).toEqual(["Brasil", "Argentina", "Colômbia", "Uruguai", "Chile", "Paraguai", "Equador", "Peru", "México", "Estados Unidos", "Inglaterra", "Espanha", "Itália", "Alemanha", "França", "Portugal", "Holanda", "Bélgica", "Turquia", "Escócia", "Áustria", "Suíça", "Grécia", "Dinamarca", "Noruega", "Suécia", "Polônia", "Tchéquia", "Croácia", "Sérvia", "Ucrânia", "Romênia", "Rússia", "Arábia Saudita", "Japão", "Coreia do Sul", "China", "Catar", "Emirados Árabes"]);
  // agrupados por continente, com título pequeno em cada grupo
  expect([...document.querySelectorAll(".esc-continente")].map((h) => h.textContent)).toEqual(["América do Sul", "América do Norte", "Europa", "Ásia e Oriente Médio"]);
  expect([...document.querySelectorAll(".esc-grupo")].map((g) => g.querySelectorAll(".esc-pais").length)).toEqual([8, 2, 23, 6]);
  expect(cartaoPais("Brasil").querySelector(".esc-pais-ligas").textContent).toBe("Série A · Série B · Série C");
  expect(cartaoPais("Inglaterra").querySelector(".esc-pais-ligas").textContent).toBe("Premier League · Championship");
  expect(cartaoPais("Áustria").querySelector(".esc-pais-ligas").textContent).toBe("Bundesliga Austríaca");
  expect(cartaoPais("Brasil").querySelector("img").getAttribute("src")).toBe("img/flags/brasil.svg");
  // toda bandeira existe de verdade em public/img/flags/
  cartoes.forEach((c) => expect(fs.existsSync("public/" + c.querySelector("img").getAttribute("src"))).toBe(true));
  expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull(); // tocar no país já avança
  clique(botao("Voltar"));
  expect(screen.getByRole("button", { name: "Planejar um clube" })).toBeTruthy(); // voltou ao início
  clique(botao("Planejar um clube"));

  // Divisão (Brasil)
  clique(cartaoPais("Brasil"));
  expect(passoTxt()).toBe("2 de 3");
  expect(fundo()).toBe(rgb("#009c3b"));
  expect(screen.getByText("Brasil · escolha a divisão")).toBeTruthy();
  expect(botao(/Brasileirão Série B/).textContent).toContain(`${clubesDa("BRB").length} clubes`);
  clique(botao(/Brasileirão Série B/));

  // Clube
  const brb = clubesDa("BRB");
  expect(passoTxt()).toBe("3 de 3");
  expect(titulo()).toBe(brb[0].n);
  expect(fundo()).toBe(rgb(corDeFundo(brb[0])));
  expect(botao("Planejar 2027")).toBeTruthy();
  clique(botao("Próximo clube"));
  expect(titulo()).toBe(brb[1].n);
  const vitrine = document.querySelector(".esc-clubes");
  fireEvent.touchStart(vitrine, { touches: [{ clientX: 300 }] });
  fireEvent.touchEnd(vitrine, { changedTouches: [{ clientX: 150 }] });   // dedo para a esquerda = próximo
  expect(titulo()).toBe(brb[2].n);
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  fireEvent.keyDown(document, { key: "ArrowLeft" });
  expect(titulo()).toBe(brb[brb.length - 1].n);                         // dá a volta

  // Voltar: clube → divisão → país → início
  clique(botao("Voltar"));
  expect(passoTxt()).toBe("2 de 3");
  clique(botao("Voltar"));
  expect(passoTxt()).toBe("1 de 3");

  // País de uma liga só: pula a divisão na ida e na volta
  clique(cartaoPais("Portugal"));
  expect(passoTxt()).toBe("2 de 2");
  expect(titulo()).toBe(clubesDa("POR")[0].n);
  expect(document.querySelector(".esc-rotulo").textContent).toBe("Liga Portugal");
  clique(botao("Voltar"));
  expect(screen.getByRole("heading", { name: "Escolha o país" })).toBeTruthy();
});

test("divisões: logo de cada liga, em ordem (1ª antes da 2ª), nos países grandes", async () => {
  render(<App />);
  clique(await screen.findByRole("button", { name: "Planejar um clube" }));
  const esperado = { Brasil: ["BRA", "BRB", "BRC"], Inglaterra: ["ENG", "ENG2"], Espanha: ["ESP", "ESP2"], Itália: ["ITA", "ITA2"], Alemanha: ["GER", "GER2"], França: ["FRA", "FRA2"] };
  for (const [pais, ligas] of Object.entries(esperado)) {
    clique(cartaoPais(pais));
    expect(passoTxt()).toBe("2 de 3");
    const cards = [...document.querySelectorAll(".esc-divisao")];
    expect(cards.map((c) => c.querySelector(".logo-liga img").getAttribute("src"))).toEqual(ligas.map((k) => `img/leagues/${k}.webp`));
    expect(cards.map((c) => c.querySelector("b").textContent)).toEqual(ligas.map((k) => DATA.leagues.find((l) => l.k === k).n));
    clique(botao("Voltar"));
  }
  // toda liga tem logo em public/img/leagues/ e campo div
  DATA.leagues.forEach((l) => {
    expect(fs.existsSync(`public/img/leagues/${l.k}.webp`)).toBe(true);
    expect([1, 2, 3]).toContain(l.div); // 3 = Série C
  });
  // Inglaterra → Championship → clubes da Championship, "Planejar 27/28"
  clique(cartaoPais("Inglaterra"));
  clique(botao(/Championship/));
  expect(passoTxt()).toBe("3 de 3");
  expect(titulo()).toBe(clubesDa("ENG2")[0].n);
  expect(botao("Planejar 27/28")).toBeTruthy();
});

test("ligas novas: jogadores sem estatísticas aparecem sem erro e podem ser contratados", async () => {
  const c = clubesDa("SWE")[0];
  const novo = c.p.map((r, i) => ({ id: `${c.k}-${i}`, n: r[1], v: r[5], foto: r[7], st: r[8], hd: r[9] })).sort((a, b) => b.v - a.v)[0];
  expect(novo.foto).toBe(-1);                                      // sem sprite antigo...
  expect(novo.hd).toBeGreaterThan(0);                              // ...mas com foto HD
  expect(novo.st).toHaveLength(4);                                 // e com estatísticas (bloco 2)
  // Um jogador ainda sem estatísticas (nome único no data.json), de uma liga nova
  const semStats = DATA.clubs.filter((x) => x.lg === "BRC").flatMap((x) => x.p.map((r) => ({ n: r[1], st: r[8], clube: x.n })))
    .find((j) => j.st === null && DATA.clubs.every((x) => x.p.filter((r) => r[1] === j.n).length <= (x.n === j.clube ? 1 : 0)));
  render(<App />);
  // Elenco de um clube sueco
  clique(await screen.findByRole("button", { name: "Planejar um clube" }));
  clique(cartaoPais("Suécia"));
  clique(botao(/^Planejar /));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  const linha = naPagina().getByText(novo.n).closest("button");
  expect(linha.querySelector("img.face").getAttribute("src")).toBe(`img/players/${novo.hd}.webp`); // foto HD
  clique(linha);
  expect(painel().querySelector(".stg b").textContent).toBe(String(novo.st[0])); // jogos
  clique(noPainel().getByRole("button", { name: "Fechar" }));
  // No Mercado de outro clube: quem não tem estatísticas aparece com "Estatísticas indisponíveis" e dá para contratar
  clique(document.querySelector(".clubBtn"));
  clique(noPainel().getByRole("button", { name: /Trocar de clube/ }));
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  clique(screen.getByRole("tab", { name: "Mercado" }));
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: semStats.n } });
  const noMercado = [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === semStats.n);
  expect(noMercado.textContent).toContain("Estatísticas indisponíveis");
  expect(noMercado.textContent).toContain(semStats.clube.slice(0, 8));
  clique(noMercado);
  expect(noPainel().getByText("Estatísticas indisponíveis para este jogador.")).toBeTruthy();
  clique(noPainel().getByRole("button", { name: "Contratar" }));
  expect(aviso()).toBe(semStats.n + " contratado");
});

test("fluxo completo: clube, vender, contratar, filtros, escalação, resumo, reiniciar e voltar ao início", async () => {
  render(<App />);
  await esperarCotacao();

  // 1. Início → Inglaterra → Premier League → Arsenal
  clique(botao("Planejar um clube"));
  clique(cartaoPais("Inglaterra"));
  clique(botao(/Premier League/));
  for (let i = 0; i < 30 && titulo() !== "Arsenal"; i++) clique(botao("Próximo clube"));
  expect(titulo()).toBe("Arsenal");
  const arsenal = DATA.clubs.find((c) => c.k === "T42");
  expect(fundo()).toBe(rgb(corDeFundo(arsenal)));
  expect(botao("Planejar 27/28").style.color).toBe(rgb(corDeFundo(arsenal))); // texto do botão na cor do fundo

  // 2. Abrir o clube: pede o orçamento
  clique(botao("Planejar 27/28"));
  expect(noPainel().getByText("Quanto você tem para gastar?")).toBeTruthy();
  clique(noPainel().getByRole("button", { name: "€ 50 mi" }));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  expect(painel()).toBeNull();
  expect(caixa()).toBe("€ 50 mi");
  expect(salvo().last).toBe("T42");
  expect(salvo().plans.T42.budget).toBe(50);

  // 3. Vender o David Raya por € 40 mi
  clique(naPagina().getByText("David Raya").closest("button"));
  clique(noPainel().getByRole("button", { name: /Vender/ }));
  const valor = noPainel().getByLabelText(/Valor da venda \(€ milhões\)/);
  expect(valor.value).toBe("30");
  fireEvent.change(valor, { target: { value: "40" } });
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(caixa()).toBe("€ 90 mi");
  expect(naPagina().getByText("Vendido € 40 mi")).toBeTruthy();
  const raya = arsenal.p.findIndex((r) => r[1] === "David Raya");
  expect(salvo().plans.T42.st[`T42-${raya}`]).toEqual({ s: "vende", fee: 40 });
  expect(salvo().plans.T42.xi[0]).not.toBe(`T42-${raya}`); // Raya era o goleiro titular

  // 4. Mercado: buscar e contratar (o mais caro de LaLiga que cabe no caixa, com folga para o passo 5;
  //    "Só quem cabe no caixa" vem ligado)
  clique(screen.getByRole("tab", { name: "Mercado" }));
  const alvo = DATA.clubs.filter((c) => c.lg === "ESP").flatMap((c) => c.p.map((r) => ({ n: r[1], v: r[5] }))).filter((x) => x.v <= 60).sort((a, b) => b.v - a.v)[0];
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: alvo.n } });
  clique(naPagina().getAllByText(alvo.n)[0].closest("button"));
  clique(noPainel().getByRole("button", { name: "Contratar" }));
  expect(aviso()).toBe(alvo.n + " contratado");
  expect(painel()).toBeNull();
  expect(naPagina().queryByText(alvo.n)).toBeNull();

  // 5. Filtros: só LaLiga, depois limpar
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "" } });
  clique(document.querySelector("#fOpen"));
  fireEvent.change(noPainel().getByLabelText("Liga"), { target: { value: "ESP" } });
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros2"); // liga + "só quem cabe no caixa"
  const nomesEsp = new Set(DATA.clubs.filter((c) => c.lg === "ESP").map((c) => c.n));
  const linhas = document.querySelectorAll("#mList .row");
  expect(linhas.length).toBe(40);
  linhas.forEach((l) => expect([...nomesEsp].some((n) => l.querySelector(".sub").textContent.includes(n))).toBe(true));
  clique(screen.getByRole("button", { name: /Mostrar mais/ }));
  expect(document.querySelectorAll("#mList .row").length).toBe(80);
  clique(botao("Goleiros"));
  document.querySelectorAll("#mList .row .sub:not(.st)").forEach((s) => expect(s.textContent.startsWith("GOL")).toBe(true));
  clique(botao("Todos"));
  // Com LaLiga escolhida, a lista de clubes só tem os clubes da LaLiga (sem os grupos das outras ligas)
  clique(screen.getByRole("button", { name: /Filtros/ }));
  const opcoesClube = [...painel().querySelectorAll("#fc option")].slice(1).map((o) => o.textContent);
  expect(painel().querySelectorAll("#fc optgroup")).toHaveLength(0);
  expect(opcoesClube.length).toBe(nomesEsp.size); // o plano é do Arsenal: todos os clubes da LaLiga aparecem
  opcoesClube.forEach((n) => expect(nomesEsp.has(n)).toBe(true));
  // Nacionalidade: só as que existem na LaLiga, com a contagem; escolher "Brasil" deixa só brasileiros
  const opcoesNat = [...painel().querySelectorAll("#fn option")].slice(1).map((o) => o.value);
  expect(opcoesNat).toContain("Brasil");
  expect(opcoesNat).not.toContain("Qatar");
  fireEvent.change(noPainel().getByLabelText(/Nacionalidade/), { target: { value: "Brasil" } });
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros3"); // liga + nacionalidade + caixa
  const brasileiros = document.querySelectorAll("#mList .row");
  expect(brasileiros.length).toBeGreaterThan(0);
  brasileiros.forEach((l) => {
    expect(l.querySelector(".nm img.fl").getAttribute("alt")).toBe("Brasil");
    expect([...nomesEsp].some((n) => l.querySelector(".sub").textContent.includes(n))).toBe(true);
  });
  clique(screen.getByRole("button", { name: /Filtros/ }));
  clique(noPainel().getByRole("button", { name: "Limpar" }));
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros1"); // de volta ao padrão: só o "cabe no caixa"

  // 6. Criar jogador
  clique(botao("Todos"));
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "zzzz" } });
  expect(screen.getByText("Nenhum jogador encontrado.")).toBeTruthy();
  clique(botao("Criar jogador"));
  fireEvent.change(noPainel().getByLabelText("Nome"), { target: { value: "Joãozinho Teste" } });
  fireEvent.change(noPainel().getByLabelText("Posição"), { target: { value: "CA" } });
  fireEvent.change(noPainel().getByLabelText("Valor (€ mi)"), { target: { value: "2" } });
  clique(noPainel().getByRole("button", { name: "Criar e contratar" }));
  expect(aviso()).toBe("Joãozinho Teste contratado");
  expect(caixa()).toBe(dinheiro(90 - alvo.v - 2));
  expect(document.querySelector("#bud").classList.contains("neg")).toBe(90 - alvo.v - 2 < 0); // vermelho se negativo

  // 7. Time: formação, trocar goleiro, escalar sozinho
  clique(screen.getByRole("tab", { name: "Time" }));
  fireEvent.change(screen.getByLabelText("Formação"), { target: { value: "4-4-2" } });
  expect(salvo().plans.T42.form).toBe("4-4-2");
  expect(document.querySelectorAll(".slot").length).toBe(11);
  const golAntes = document.querySelector(".slot .lb").textContent;
  clique(screen.getByRole("button", { name: /^Goleiro: / }));  // 1º toque: seleciona
  clique(screen.getByRole("button", { name: /^Goleiro: / }));  // 2º toque no mesmo: abre a lista
  const outro = noPainel().getAllByRole("button").find((b) => b.classList.contains("row") && !b.textContent.includes("atual"));
  clique(outro);
  expect(document.querySelector(".slot .lb").textContent).not.toBe(golAntes);
  // Escalar sozinho: pelo overall, depois pelo valor; a escolha fica marcada e guardada
  const grupo = screen.getByRole("group", { name: "Escalar sozinho" });
  clique(within(grupo).getByRole("button", { name: "Overall" }));
  expect(aviso()).toBe("Time escalado pelos de maior overall");
  expect(within(grupo).getByRole("button", { name: "Overall" }).getAttribute("aria-pressed")).toBe("true");
  expect(localStorage.getItem("plantel:escalar")).toBe("o");
  clique(within(grupo).getByRole("button", { name: "Valor" }));
  expect(aviso()).toBe("Time escalado pelos mais valiosos");
  expect(localStorage.getItem("plantel:escalar")).toBe("v");

  // 8. Resumo
  clique(screen.getByRole("tab", { name: "Resumo" }));
  expect(naPagina().getByText(alvo.n)).toBeTruthy();
  expect(naPagina().getByText("Joãozinho Teste")).toBeTruthy();
  expect(naPagina().getByText("David Raya")).toBeTruthy();
  await act(async () => clique(botao("Copiar resumo")));
  expect(navigator.clipboard.writeText.mock.calls[0][0]).toMatch(/^Arsenal 27\/28 \(planejado no Plantel\)\nOrçamento € 50 mi/);
  expect(aviso()).toBe("Resumo copiado");

  // 9. Reiniciar progresso (precisa de dois toques)
  clique(botao("Reiniciar progresso"));
  clique(noPainel().getByRole("button", { name: /Reiniciar todo o progresso do Arsenal/ }));
  expect(salvo().plans.T42.ins.length).toBe(2); // ainda não apagou
  clique(noPainel().getByRole("button", { name: /Toque de novo para apagar tudo/ }));
  expect(noPainel().getByText("Quanto você tem para gastar?")).toBeTruthy();
  expect(aviso()).toBe("Progresso do Arsenal reiniciado");
  expect(salvo().plans.T42).toMatchObject({ budget: null, st: {}, ins: [], custom: [], form: "4-3-3" });
  clique(noPainel().getByRole("button", { name: "Começar" })); // aceita os € 20 mi sugeridos
  expect(caixa()).toBe("€ 20 mi");
  expect(salvo().plans.T42.budget).toBe(20);

  // 10. Trocar de clube: volta ao início, com o Arsenal em "Seus planos"; tocar reabre o plano
  clique(document.querySelector(".clubBtn"));
  clique(noPainel().getByRole("button", { name: /Trocar de clube/ }));
  expect(document.querySelector("#planBar")).toBeNull();
  expect(screen.getByText("Seus planos")).toBeTruthy();
  const cartao = botao(/Arsenal 27\/28/);
  expect(cartao.textContent).toContain("+0 chegam · −0 saem · caixa € 20 mi");
  expect(cartao.querySelector(".crest").getAttribute("src")).toBe(`img/teams/${arsenal.hd}.webp`);
  clique(cartao);
  expect(caixa()).toBe("€ 20 mi");
}, 20000); // teste longo (muitas telas): 20 s de limite em vez de 5

test("plano salvo pela versão antiga (mesma chave plantel:v2): aparece no início e abre ao tocar", async () => {
  const c = clubesDa("BRA")[3], d = clubesDa("ENG")[2];
  // Planos no formato exato que o site antigo salvava
  localStorage.setItem(CHAVE, JSON.stringify({
    plans: {
      [c.k]: { club: c.k, budget: 30, st: { [c.k + "-0"]: { s: "vende", fee: 12.5 } }, ins: [], form: "3-5-2", xi: {}, custom: [] },
      [d.k]: { club: d.k, budget: 5, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] },
    },
    last: c.k,
  }));
  render(<App />);
  await screen.findByText("Seus planos");                       // abre no início, não mais direto no clube
  expect(document.querySelector("#planBar")).toBeNull();
  const nomes = [...document.querySelectorAll(".ini-plano b")].map((b) => b.textContent);
  expect(nomes).toEqual([`${c.n} 2027`, `${d.n} 27/28`]);       // o último aberto vem primeiro
  expect(botao(new RegExp("^" + c.n)).textContent).toContain("+0 chegam · −1 saem · caixa € 42,5 mi");
  clique(botao(new RegExp("^" + c.n)));
  expect(document.querySelector(".clubBtn").textContent).toBe(c.n);
  expect(caixa()).toBe("€ 42,5 mi");
  expect(painel()).toBeNull();                                   // orçamento já existe: não pede de novo
  expect(Object.keys(salvo().plans[c.k].xi).length).toBeGreaterThan(0);
  expect(salvo().plans[c.k].st[c.k + "-0"]).toEqual({ s: "vende", fee: 12.5 }); // formato intacto
  clique(screen.getByRole("tab", { name: "Time" }));
  expect(screen.getByLabelText("Formação").value).toBe("3-5-2");
});

test("excluir plano no início: só apaga depois de confirmar", async () => {
  const [a, b] = clubesDa("BRA");
  const planoA = { club: a.k, budget: 30, st: { [a.k + "-0"]: { s: "vende", fee: 5 } }, ins: [], form: "4-3-3", xi: {}, custom: [] };
  const planoB = { club: b.k, budget: 10, st: {}, ins: [], form: "4-4-2", xi: {}, custom: [] };
  localStorage.setItem(CHAVE, JSON.stringify({ plans: { [a.k]: planoA, [b.k]: planoB }, last: a.k }));
  render(<App />);
  await screen.findByText("Seus planos");
  const nomes = () => [...document.querySelectorAll(".ini-plano b")].map((x) => x.textContent);
  expect(nomes()).toEqual([`${a.n} 2027`, `${b.n} 2027`]);

  // Tocar na lixeira só abre a confirmação, com o resumo do plano
  clique(botao(`Excluir plano do ${a.n}`));
  expect(noPainel().getByText("Excluir plano?")).toBeTruthy();
  expect(noPainel().getByText(`${a.n} 2027`)).toBeTruthy();
  expect(painel().textContent).toContain("+0 chegam · −1 saem · caixa € 35 mi");
  expect(salvo().plans[a.k]).toBeTruthy();

  // Cancelar, Esc e tocar fora não apagam nada
  clique(noPainel().getByRole("button", { name: "Cancelar" }));
  expect(painel()).toBeNull();
  clique(botao(`Excluir plano do ${a.n}`));
  fireEvent.keyDown(document, { key: "Escape" });
  clique(botao(`Excluir plano do ${a.n}`));
  clique(document.querySelector(".ov"));
  expect(Object.keys(salvo().plans).sort()).toEqual([a.k, b.k].sort());
  expect(nomes()).toHaveLength(2);

  // Confirmar apaga só esse plano (e o "último aberto" deixa de apontar para ele)
  clique(botao(`Excluir plano do ${a.n}`));
  clique(noPainel().getByRole("button", { name: "Excluir plano" }));
  expect(aviso()).toBe(`Plano do ${a.n} excluído`);
  expect(nomes()).toEqual([`${b.n} 2027`]);
  expect(salvo()).toEqual({ plans: { [b.k]: planoB } });           // o outro plano fica intacto, no mesmo formato
  // O clube excluído volta a mostrar "Planejar 2027" (sem plano) na escolha
  await irParaBrasil();
  expect(titulo()).toBe(a.n);
  expect(botao("Planejar 2027")).toBeTruthy();
  clique(botao("Próximo clube"));
  expect(botao("Continuar meu plano")).toBeTruthy();

  // Excluindo o último plano, a seção "Seus planos" some
  clique(botao("Voltar")); clique(botao("Voltar")); clique(botao("Voltar"));
  clique(botao(`Excluir plano do ${b.n}`));
  clique(noPainel().getByRole("button", { name: "Excluir plano" }));
  expect(screen.queryByText("Seus planos")).toBeNull();
  expect(salvo()).toEqual({ plans: {} });
});

test("moeda: R$ e US$ só na exibição; o que é digitado vira euro ao salvar", async () => {
  render(<App />);
  await esperarCotacao(); // €1 = R$ 6 · US$ 1,10

  // Escolher R$ no início: fica marcado e salvo
  clique(botao("R$"));
  expect(botao("R$").getAttribute("aria-pressed")).toBe("true");
  expect(localStorage.getItem("plantel:moeda")).toBe("BRL");

  // Orçamento: campo e atalhos em reais; guardado em euro
  await irParaBrasil();
  const c = clubesDa("BRA")[0];
  // valor do elenco: real, ou estimado para quem não tem valor no Transfermarkt
  expect(document.querySelector(".esc-cartao b").textContent).toBe(dinheiro(c.p.reduce((s, r) => s + (r[5] || ESTIMADOS[c.k]?.[`${r[1]}|${r[3]}`] || 0), 0)));
  expect(document.querySelector(".esc-cartao b").textContent).toMatch(/^R\$ /);
  clique(botao("Planejar 2027"));
  const orc = noPainel().getByLabelText("Orçamento inicial (R$ milhões)");
  expect(orc.value).toBe("120");                                   // € 20 mi sugeridos = R$ 120 mi
  expect(noPainel().getAllByRole("button").map((b) => b.textContent).filter((t) => t.endsWith(" mi"))).toEqual(["R$ 0 mi", "R$ 50 mi", "R$ 100 mi", "R$ 250 mi", "R$ 500 mi"]);
  clique(noPainel().getByRole("button", { name: "R$ 250 mi" }));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  expect(caixa()).toBe("R$ 250 mi");
  expect(salvo().plans[c.k].budget).toBeCloseTo(250 / 6, 3);      // guardado em euro

  // Venda digitada em reais
  const jog = c.p.map((r, i) => ({ id: `${c.k}-${i}`, n: r[1], v: r[5] })).find((p) => p.v >= 1);
  clique(naPagina().getAllByText(jog.n)[0].closest("button"));
  clique(noPainel().getByRole("button", { name: /Vender/ }));
  const venda = noPainel().getByLabelText("Valor da venda (R$ milhões)");
  expect(venda.value).toBe(String(Math.round(jog.v * 6 * 10) / 10));
  fireEvent.change(venda, { target: { value: "60" } });
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(salvo().plans[c.k].st[jog.id]).toEqual({ s: "vende", fee: 10 }); // R$ 60 mi = € 10 mi
  expect(naPagina().getByText("Vendido R$ 60 mi")).toBeTruthy();

  // Abrir e salvar sem mexer não muda o valor guardado (sem erro de arredondamento)
  clique(naPagina().getAllByText(jog.n)[0].closest("button"));
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(salvo().plans[c.k].st[jog.id].fee).toBe(10);

  // Trocar para US$ no topo do plano: os valores mudam, o que está guardado não
  clique(within(document.querySelector(".top")).getByRole("button", { name: "US$" }));
  expect(localStorage.getItem("plantel:moeda")).toBe("USD");
  expect(caixa()).toBe(dinheiro(250 / 6 + 10));
  expect(caixa()).toMatch(/^US\$ /);
  expect(salvo().plans[c.k].st[jog.id].fee).toBe(10);

  // A escolha continua depois de recarregar
  cleanup();
  render(<App />);
  expect((await screen.findByRole("button", { name: "US$" })).getAttribute("aria-pressed")).toBe("true");
});

test("cotação: sem internet usa a última salva; sem nada salvo, a de reserva", async () => {
  apiCotacaoFora = true;
  localStorage.setItem("plantel:cotacao", JSON.stringify({ BRL: 5.5, USD: 1.05, data: "2026-11-01" }));
  render(<App />);
  await screen.findByRole("button", { name: "Planejar um clube" });
  expect(rodape()).toBe("€1 = R$ 5,50 · US$ 1,05 (BCE, 01/11/2026)");
  cleanup();

  localStorage.clear();
  render(<App />);
  await screen.findByRole("button", { name: "Planejar um clube" });
  await act(async () => {});
  expect(rodape()).toBe("€1 = R$ 6,53 · US$ 1,10 (cotação de reserva, BCE, 20/11/2026)");
  expect(localStorage.getItem("plantel:cotacao")).toBeNull();
});

test("escudos em alta resolução em todos os lugares (sem sprite)", async () => {
  const idDe = (k) => DATA.clubs.find((c) => c.k === k).hd;
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
  expect(DATA.clubs.every((c) => c.hd > 0)).toBe(true);

  render(<App />);
  await irParaBrasil();
  conferir(".esc-clubes", 3);                                        // escudo grande + anterior e próximo
  clique(screen.getByRole("button", { name: /Planejar 2027/ }));
  conferir(".ov.on .sheet", 1);                                      // painel do orçamento
  clique(noPainel().getByRole("button", { name: "Começar" }));
  conferir(".top", 1);                                               // topo
  clique(document.querySelector(".clubBtn"));
  conferir(".ov.on .sheet", 1);                                      // painel do clube
  clique(noPainel().getByRole("button", { name: /Trocar de clube/ }));
  conferir(".ini-planos", 1);                                        // "Seus planos" no início
});

test("fotos dos jogadores: HD quando existe; senão o sprite antigo; senão as iniciais", async () => {
  // Um exemplo de cada caso, com nome único no data.json
  const todos = DATA.clubs.flatMap((c) => c.p.map((r) => ({ n: r[1], lg: c.lg, sp: r[7], hd: r[9], v: r[5] })));
  // nome único e barato (cabe no caixa: "Só quem cabe no caixa" vem ligado)
  const unico = (j) => j.v <= 5 && todos.filter((x) => x.n === j.n).length === 1;
  const comHD = todos.find((j) => j.hd > 0 && j.lg === "ENG" && unico(j));
  const sprite = todos.find((j) => j.hd === 0 && j.sp >= 0 && unico(j));
  const iniciais = todos.find((j) => j.hd === 0 && j.sp < 0 && unico(j));
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  clique(screen.getByRole("tab", { name: "Mercado" }));
  const foto = (nome) => {
    fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: nome } });
    return [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === nome).querySelector(".face");
  };
  let f = foto(comHD.n);
  expect(f.tagName).toBe("IMG");
  expect(f.getAttribute("src")).toBe(`img/players/${comHD.hd}.webp`);
  expect(f.getAttribute("loading")).toBe("lazy");
  f = foto(sprite.n);
  expect(f.tagName).toBe("SPAN");
  expect(f.style.backgroundImage).toContain(`img/p_${sprite.lg}.webp`);
  f = foto(iniciais.n);
  expect(f.classList.contains("ini")).toBe(true);
});

test("visual do Mercado e das abas: bandeira, setor, nota, caixa, atalho / e indicador", async () => {
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "€ 20 mi" }));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  // Indicador das abas acompanha a aba escolhida
  expect(document.querySelector("#tabs").style.getPropertyValue("--i")).toBe("0");
  clique(screen.getByRole("tab", { name: "Mercado" }));
  expect(document.querySelector("#tabs").style.getPropertyValue("--i")).toBe("1");
  // Cards do topo: média de idade e chegam/saem coloridos
  expect(document.querySelectorAll("#sum .stat").length).toBe(3);
  expect(document.querySelector("#sum .media").textContent).toMatch(/^ · média \d+,\d anos$/);
  // Atalho "/" põe o cursor na busca
  fireEvent.keyDown(document, { key: "/" });
  expect(document.activeElement).toBe(screen.getByLabelText("Buscar jogador"));
  // Lista: desligando "Só quem cabe no caixa" e ordenando por valor, o mais caro não cabe nos € 20 mi; um barato cabe
  clique(document.querySelector("#fOpen"));
  clique(noPainel().getByRole("button", { name: "Só quem cabe no caixa" }));
  fireEvent.change(noPainel().getByLabelText("Ordenar por"), { target: { value: "vd" } });
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector(".ordem b").textContent).toBe("Valor ↓");
  expect(document.querySelector(".selo-rec")).toBeNull();                     // selo só na ordem Recomendados
  const linhas = [...document.querySelectorAll("#mList .row")];
  const primeira = linhas[0];
  expect(primeira.classList.contains("too")).toBe(true);
  expect(primeira.querySelector(".vl .s").textContent).toMatch(/^faltam € /);
  const p = DATA.clubs.flatMap((c) => c.p.map((r) => ({ n: r[1], v: r[5], pos: r[2], nat: r[6], st: r[8], club: c.k }))).filter((x) => x.club !== clubesDa("BRA")[0].k).sort((a, b) => b.v - a.v)[0];
  expect(primeira.querySelector(".nm").textContent).toBe(p.n);
  expect(primeira.querySelector(".fl").getAttribute("alt")).toBe(p.nat);                  // bandeira do país
  expect(primeira.querySelector(".pos").textContent).toBe(p.pos);                         // selo da posição
  expect(primeira.querySelector(".mc img").getAttribute("src")).toMatch(/^img\/teams\//); // mini escudo
  if (p.st && p.st[3]) expect(primeira.querySelector(".nota").className).toMatch(/n[5-8]/);
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "" } });
  clique(document.querySelector("#fOpen"));
  fireEvent.change(noPainel().getByLabelText("Ordenar por"), { target: { value: "va" } });
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector(".ordem b").textContent).toBe("Valor ↑");
  const barata = document.querySelector("#mList .row");
  expect(barata.classList.contains("too")).toBe(false);
  expect(barata.querySelector(".vl .s").textContent).toBe("cabe no caixa");
  // Toda bandeira usada nos dados existe em public/img/flags/paises/
  const codigos = new Set([...document.querySelectorAll(".fl")].map((i) => i.getAttribute("src")));
  codigos.forEach((src) => expect(fs.existsSync("public/" + src)).toBe(true));
});

test("tema: o botão alterna entre claro e escuro e guarda a escolha", async () => {
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  // Sem escolha salva, segue o sistema (no teste, o sistema está no claro)
  expect(document.documentElement.dataset.theme).toBeUndefined();
  clique(botao("Mudar para tema escuro"));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("plantel:tema")).toBe("dark");
  clique(botao("Mudar para tema claro"));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("plantel:tema")).toBe("light");
  clique(botao("Mudar para tema escuro"));
  // A escolha continua ao abrir o site de novo (o botão já mostra a opção contrária)
  cleanup();
  render(<App />);
  await irParaBrasil();
  clique(botao("Continuar meu plano"));
  expect(botao("Mudar para tema claro")).toBeTruthy();
  expect(salvo().plans).toBeTruthy(); // o tema não mexe nos planos
});

test("busca de país: filtra por país ou liga e esconde continentes vazios", async () => {
  render(<App />);
  clique(await screen.findByRole("button", { name: "Planejar um clube" }));
  const busca = screen.getByLabelText("Buscar país");
  const nomes = () => [...document.querySelectorAll(".esc-pais-nome")].map((n) => n.textContent);
  fireEvent.change(busca, { target: { value: "japao" } });                 // sem acento também acha
  expect(nomes()).toEqual(["Japão"]);
  expect([...document.querySelectorAll(".esc-continente")].map((h) => h.textContent)).toEqual(["Ásia e Oriente Médio"]);
  fireEvent.change(busca, { target: { value: "Premier Liga" } });          // pelo nome da liga
  expect(nomes()).toEqual(["Ucrânia", "Rússia"]);
  fireEvent.change(busca, { target: { value: "zzz" } });
  expect(screen.getByText("Nenhum país ou liga encontrado.")).toBeTruthy();
  fireEvent.change(busca, { target: { value: "" } });
  expect(nomes()).toHaveLength(39);
  // Brasil com 3 divisões; a Série C abre a etapa do clube ("3 de 3")
  clique(cartaoPais("Brasil"));
  expect([...document.querySelectorAll(".esc-divisao b")].map((b) => b.textContent)).toEqual(["Brasileirão Série A", "Brasileirão Série B", "Brasileirão Série C"]);
  clique(botao(/Brasileirão Série C/));
  expect(passoTxt()).toBe("3 de 3");
  expect(titulo()).toBe(clubesDa("BRC")[0].n);
});

test("valor estimado: '~' na frente, aviso ao passar o mouse, e vale no caixa", async () => {
  // Um jogador da Série C sem valor no Transfermarkt, com estimativa de € 0,15 mi ou mais (acima do preço mínimo)
  const todos = DATA.clubs.flatMap((c) => c.p.map((r, i) => ({ id: `${c.k}-${i}`, n: r[1], v: r[5], est: ESTIMADOS[c.k]?.[`${r[1]}|${r[3]}`], lg: c.lg })));
  const alvo = todos.find((j) => j.lg === "BRC" && !j.v && j.est >= 0.15 && todos.filter((x) => x.n === j.n).length === 1);
  expect(alvo).toBeTruthy();
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  clique(screen.getByRole("tab", { name: "Mercado" }));
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: alvo.n } });
  const linha = [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === alvo.n);
  const valor = linha.querySelector(".vl .v .estimado");
  expect(valor.textContent).toBe("~" + dinheiro(alvo.est));                 // ex.: "~€ 300 mil"
  expect(valor.getAttribute("title")).toBe("valor estimado");
  clique(linha);
  expect(painel().querySelector(".facts").textContent).toContain("~" + dinheiro(alvo.est) + "valor");
  expect(noPainel().getByText(/^Valor estimado: o Transfermarkt não tem valor/)).toBeTruthy();
  expect(noPainel().getByLabelText(/Valor da compra/).value).toBe(String(alvo.est)); // preço sugerido = estimado
  clique(noPainel().getByRole("button", { name: "Contratar" }));
  expect(salvo().plans[clubesDa("BRA")[0].k].ins).toEqual([{ id: alvo.id, type: "compra", fee: alvo.est }]);
  expect(caixa()).toBe(dinheiro(20 - alvo.est));
  // Valor real sempre tem prioridade: quem tem valor no Transfermarkt não aparece com "~"
  const real = todos.find((j) => j.lg === "BRC" && j.v > 0 && todos.filter((x) => x.n === j.n).length === 1);
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: real.n } });
  const linhaReal = [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === real.n);
  expect(linhaReal.querySelector(".vl .v").textContent).toBe(dinheiro(real.v));
});

test("jogador sem valor e sem estimativa: aparece '—' e a compra custa no mínimo € 0,1 mi", async () => {
  semEstimados = true; // simula o valores-estimados.json fora do ar
  // Um jogador da Série C sem valor no Transfermarkt
  const c = clubesDa("BRC").find((x) => x.p.some((r) => !r[5]));
  const i = c.p.findIndex((r) => !r[5]);
  const semValor = { id: `${c.k}-${i}`, n: c.p[i][1] };
  render(<App />);
  await irParaBrasil();                                                     // planeja um clube da Série A
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  clique(screen.getByRole("tab", { name: "Mercado" }));
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: semValor.n } });
  const linha = [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === semValor.n);
  expect(linha.querySelector(".vl .v").textContent).toBe("—");              // e não "€ 0"
  expect(linha.querySelector(".vl .s").textContent).toBe("cabe no caixa");
  clique(linha);
  expect(painel().querySelector(".facts").textContent).toContain("—valor");
  expect(noPainel().getByText(/a compra custa no mínimo € 100 mil/)).toBeTruthy();
  const campo = noPainel().getByLabelText(/Valor da compra/);
  expect(campo.value).toBe("0.1");                                          // preço sugerido = mínimo
  fireEvent.change(campo, { target: { value: "0" } });                     // tentar comprar de graça...
  clique(noPainel().getByRole("button", { name: "Contratar" }));
  expect(salvo().plans[clubesDa("BRA")[0].k].ins).toEqual([{ id: semValor.id, type: "compra", fee: 0.1 }]); // ...cobra o mínimo
  expect(caixa()).toBe("€ 19,9 mi");
});

test("estatísticas do bloco 1: quem jogou mostra a nota; quem não entrou em campo mostra '0 jogos' sem nota", async () => {
  // Dois jogadores de clubes holandeses: um com jogos e nota, outro com [0,0,0,0]
  const achar = (ok) => {
    for (const c of clubesDa("NED")) {
      const i = c.p.findIndex((r) => r[8] && ok(r[8]) && c.p.filter((x) => x[1] === r[1]).length === 1);
      if (i >= 0) return { n: c.p[i][1], st: c.p[i][8] };
    }
  };
  const jogou = achar((s) => s[0] > 0 && s[3] > 0);
  const naoJogou = achar((s) => s[0] === 0);
  expect(naoJogou.st).toEqual([0, 0, 0, 0]);
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  clique(noPainel().getByRole("button", { name: "Começar" }));
  clique(screen.getByRole("tab", { name: "Mercado" }));
  const linhaDe = (nome) => {
    fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: nome } });
    return [...document.querySelectorAll("#mList .row")].find((l) => l.querySelector(".nm").textContent === nome);
  };
  // Quem jogou: números e selo da nota
  let linha = linhaDe(jogou.n);
  expect(linha.querySelector(".ministats b").textContent).toBe(String(jogou.st[0]));
  expect(linha.querySelector(".nota")).toBeTruthy();
  // Quem não jogou: "0 jogos", sem nota e não é "sem estatísticas"
  linha = linhaDe(naoJogou.n);
  expect(linha.querySelector(".ministats").textContent).toContain("0jogos");
  expect(linha.querySelector(".nota")).toBeNull();
  expect(linha.textContent).not.toContain("Estatísticas indisponíveis");
  clique(linha);
  const grade = [...painel().querySelectorAll(".stg > div")].map((d) => d.textContent);
  expect(grade).toEqual(["0Jogos", "0Gols", "0Assistências", "—Gols por jogo", "—Assist. por jogo", "—Nota média"]);
  expect(painel().querySelector(".stt .nota")).toBeNull();
});

test("Mercado: recomendados com selo, 'só quem cabe' ligado e lembrado, busca por apelido", async () => {
  const abrirMercado = async () => {
    await irParaBrasil();
    clique(botao(/^(Planejar 2027|Continuar meu plano)$/));
    if (painel()) clique(noPainel().getByRole("button", { name: "Começar" }));
    clique(screen.getByRole("tab", { name: "Mercado" }));
  };
  const { unmount } = render(<App />);
  await abrirMercado();
  // Padrão: ordem "Recomendados", 10 selos e todo mundo cabe no caixa
  expect(document.querySelector(".ordem b").textContent).toBe("Recomendados");
  expect(document.querySelectorAll("#mList .selo-rec").length).toBe(10);
  expect([...document.querySelectorAll("#mList .row")].slice(0, 10).every((l) => l.querySelector(".selo-rec"))).toBe(true);
  expect(document.querySelector("#mList .row.too")).toBeNull();
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros1");
  // Busca por apelido: quem bate pelo apelido vem no topo, e o selo some durante a busca
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "Gabigol" } });
  expect(document.querySelector("#mList .row .nm").textContent).toBe("Gabriel Barbosa");
  expect(document.querySelector(".selo-rec")).toBeNull();
  fireEvent.change(screen.getByLabelText("Buscar jogador"), { target: { value: "" } });
  const total = () => +document.querySelector(".ordem span").textContent.replace(/\D/g, ""); // "1.234 jogadores"
  const soOsQueCabem = total();
  expect(soOsQueCabem).toBeLessThan(DATA.clubs.reduce((s, c) => s + c.p.length, 0) - 40);
  // Desligar "Só quem cabe no caixa": aparecem também os caros, e a escolha fica salva fora do plano
  clique(document.querySelector("#fOpen"));
  clique(noPainel().getByRole("button", { name: "Só quem cabe no caixa" }));
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(total()).toBeGreaterThan(soOsQueCabem);
  expect(localStorage.getItem("plantel:caixa")).toBe("0");
  expect(Object.keys(salvo().plans[clubesDa("BRA")[0].k]).sort()).toEqual(["budget", "club", "custom", "form", "ins", "st", "xi"]);
  // Abrindo o site de novo, o filtro continua desligado
  unmount();
  render(<App />);
  await abrirMercado();
  expect(document.querySelector("#fOpen").textContent).toBe("Filtros");
  expect(total()).toBeGreaterThan(soOsQueCabem);
}, 20000); // recalcula as notas do Mercado algumas vezes: 20 s de limite em vez de 5

test("empréstimos no Botafogo: devolver, comprar, vender e trazer de volta (plano antigo sem o campo novo)", async () => {
  // Plano salvo no formato antigo (sem "emp"), com € 20 mi
  localStorage.setItem(CHAVE, JSON.stringify({ plans: { T1958: { club: "T1958", budget: 20, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] } }, last: "T1958" }));
  render(<App />);
  clique(await screen.findByRole("button", { name: /Botafogo 2027/ }));
  const jogadores = () => +document.querySelector("#sum .stat:nth-child(2) b").textContent;
  const linhaDe = (nome) => [...document.querySelectorAll("#p-elenco .row")].find((l) => l.querySelector(".nm").textContent === nome);
  const n0 = jogadores();
  expect(caixa()).toBe("€ 20 mi");
  // Arthur Chaves: recebido por empréstimo, com o selo do dono e o fim do empréstimo
  expect(linhaDe("Arthur Chaves").querySelector(".emp-linha").textContent).toBe("Emprestado · TSG Hoffenheim até dez/27");
  // Seção dos emprestados a outros clubes, que não contam no total
  const secao = document.querySelector("#emprestados");
  expect(secao.querySelector("h2").textContent).toMatch(/^Emprestados a outros clubes \(\d+\)/);
  expect(linhaDe("Artur").textContent).toContain("no São Paulo");
  // Devolver o Arthur Chaves: sai do elenco, caixa igual
  clique(linhaDe("Arthur Chaves"));
  expect(noPainel().getByRole("button", { name: /^Manter emprestado/ }).getAttribute("aria-pressed")).toBe("true");
  clique(noPainel().getByRole("button", { name: /^Devolver/ }));
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(jogadores()).toBe(n0 - 1);
  expect(caixa()).toBe("€ 20 mi");
  expect(linhaDe("Arthur Chaves").textContent).toContain("Devolvido");
  expect(salvo().plans.T1958.emp).toEqual({ [`T1958-${DATA.clubs.find((c) => c.k === "T1958").p.findIndex((r) => r[1] === "Arthur Chaves")}`]: { s: "devolver", fee: 0 } });
  // Mudar para comprar: volta a contar e desconta o valor
  const arthurV = DATA.clubs.find((c) => c.k === "T1958").p.find((r) => r[1] === "Arthur Chaves")[5];
  clique(linhaDe("Arthur Chaves"));
  clique(noPainel().getByRole("button", { name: /^Comprar/ }));
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(jogadores()).toBe(n0);
  expect(caixa()).toBe(dinheiro(20 - arthurV));
  // Vender o Artur (emprestado ao São Paulo): entra o valor, total igual
  const arturV = DATA.clubs.find((c) => c.k === "T1981").p.find((r) => r[1] === "Artur" && r[3] === "1998-02-15")[5];
  clique(linhaDe("Artur"));
  clique(noPainel().getByRole("button", { name: /^Vender/ }));
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(caixa()).toBe(dinheiro(20 - arthurV + arturV));
  expect(jogadores()).toBe(n0);
  // Trazer de volta: entra no elenco e conta no total
  clique(linhaDe("Artur"));
  clique(noPainel().getByRole("button", { name: /^Trazer de volta/ }));
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(jogadores()).toBe(n0 + 1);
  expect(caixa()).toBe(dinheiro(20 - arthurV));
  expect(linhaDe("Artur").textContent).toContain("Volta de empréstimo");
  // Resumo: listas separadas
  clique(screen.getByRole("tab", { name: "Resumo" }));
  expect(document.querySelector("#voltam").textContent).toContain("Artur");
  expect(document.querySelector("#comprados").textContent).toContain("Arthur Chaves");
  expect(document.querySelector("#devolvidos")).toBeNull();
  // O valor da compra pode ser editado: o campo começa no valor salvo e o caixa usa o valor digitado
  clique(screen.getByRole("tab", { name: "Elenco" }));
  clique(linhaDe("Arthur Chaves"));
  const campo = noPainel().getByLabelText(/Valor da compra/);
  expect(campo.value).toBe(String(arthurV));
  fireEvent.change(campo, { target: { value: "3" } });
  clique(noPainel().getByRole("button", { name: "Salvar" }));
  expect(caixa()).toBe(dinheiro(20 - 3));
  expect(document.querySelector(".row .pill.in").textContent).toBe("Comprado " + dinheiro(3));
  expect(Object.values(salvo().plans.T1958.emp)).toContainEqual({ s: "comprar", fee: 3 });
});

test("aba Time: reservas no campo, banco X/22, promover e resumo (plano antigo sem 'res')", async () => {
  localStorage.setItem(CHAVE, JSON.stringify({ plans: { T42: { club: "T42", budget: 50, st: {}, ins: [], form: "3-5-2", xi: {}, custom: [] } }, last: "T42" }));
  render(<App />);
  clique(await screen.findByRole("button", { name: /Arsenal 27\/28/ }));
  clique(screen.getByRole("tab", { name: "Time" }));
  // 3-5-2: as vagas abertas são de ala
  expect(screen.getByRole("button", { name: /^Ala esquerdo: / })).toBeTruthy();
  expect(document.querySelector("#reservas h2").textContent).toContain("Banco: 0/22");
  // "+" embaixo do goleiro: lista com selo de nível, goleiros (ideal) primeiro
  clique(screen.getByRole("button", { name: "Adicionar reserva de Goleiro" }));
  const linhasDoPainel = () => noPainel().getAllByRole("button").filter((b) => b.classList.contains("row"));
  expect(linhasDoPainel().every((l) => l.querySelector(".nivel").textContent === "ideal")).toBe(true); // só goleiros
  clique(noPainel().getByRole("button", { name: /^Ver outros \d+ jogadores/ }));                        // os improvisados vêm no fim
  const linhas = linhasDoPainel();
  expect(linhas[0].querySelector(".nivel").textContent).toBe("ideal");
  expect(linhas.at(-1).querySelector(".nivel").textContent).toBe("⚠ improvisado");
  const nome = linhas[0].querySelector(".nm").textContent;
  clique(linhas[0]);
  expect(document.querySelector("#reservas h2").textContent).toContain("Banco: 1/22");
  const mini = screen.getByRole("button", { name: `1º reserva de Goleiro: ${nome}` });
  expect(salvo().plans.T42.res).toEqual({ 0: [expect.any(String)] });
  // Promover a titular: troca com o titular do gol
  const titularAntes = screen.getByRole("button", { name: /^Goleiro: / }).getAttribute("aria-label").replace("Goleiro: ", "");
  clique(mini);
  clique(noPainel().getByRole("button", { name: "Promover a titular" }));
  expect(screen.getByRole("button", { name: /^Goleiro: / }).getAttribute("aria-label")).toBe("Goleiro: " + nome);
  expect(screen.getByRole("button", { name: `1º reserva de Goleiro: ${titularAntes}` })).toBeTruthy();
  // Resumo: titulares e reservas
  clique(screen.getByRole("tab", { name: "Resumo" }));
  const time = document.querySelector("#resumo-time").textContent;
  expect(time).toContain(nome);
  expect(time).toContain("ALA");
});

test("Esc e clique fora fecham o painel", async () => {
  render(<App />);
  await irParaBrasil();
  clique(botao("Planejar 2027"));
  expect(painel()).not.toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(painel()).toBeNull();
  clique(screen.getByRole("button", { name: /Caixa/ }));
  expect(noPainel().getByText("Orçamento")).toBeTruthy();
  clique(document.querySelector(".ov"));
  expect(painel()).toBeNull();
});

test("overall e atributos: selo nas listas, ficha com e sem atributos, força do time e ordem Overall", async () => {
  localStorage.setItem(CHAVE, JSON.stringify({ plans: { T42: { club: "T42", budget: 50, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] } }, last: "T42" }));
  render(<App />);
  clique(await screen.findByRole("button", { name: /Arsenal 27\/28/ }));
  const arsenal = DATA.clubs.find((c) => c.k === "T42");
  const ovrDe = (p) => OVERALL.T42[p[1] + "|" + p[3]][0];
  const linhaDe = (nome) => [...document.querySelectorAll("#p-elenco .row")].find((l) => l.querySelector(".nm").textContent === nome);
  // Elenco: selo do overall ao lado da foto, com a cor da faixa
  const comAtr = arsenal.p.find((p) => OVERALL.T42[p[1] + "|" + p[3]][2]?.tipo === "L" && arsenal.p.filter((x) => x[1] === p[1]).length === 1);
  const selo = linhaDe(comAtr[1]).querySelector(".av + .ovr");
  expect(selo.textContent).toBe(String(ovrDe(comAtr)));
  const o = ovrDe(comAtr);
  expect(selo.classList.contains(o >= 85 ? "o85" : o >= 78 ? "o78" : o >= 70 ? "o70" : o >= 60 ? "o60" : "o45")).toBe(true);
  // Ficha com atributos: 5 barras e o radar
  clique(linhaDe(comAtr[1]));
  expect(painel().querySelectorAll("#atributos .atr-linha")).toHaveLength(5);
  expect(painel().querySelector("#atributos svg.radar")).not.toBeNull();
  expect(noPainel().getByText("Técnica")).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  // Ficha sem atributos (Max Dowman): só o overall e o aviso, sem quebrar
  const dowman = arsenal.p.find((p) => p[1] === "Max Dowman");
  expect(OVERALL.T42[dowman[1] + "|" + dowman[3]][2]).toBeNull();
  clique(linhaDe("Max Dowman"));
  expect(painel().querySelector("#atributos .ovr").textContent).toBe(String(ovrDe(dowman)));
  expect(noPainel().getByText("atributos indisponíveis")).toBeTruthy();
  expect(painel().querySelector("#atributos .atr-linha")).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  // Aba Time: força = média dos 11 titulares salvos no plano
  clique(screen.getByRole("tab", { name: "Time" }));
  const xi = Object.values(salvo().plans.T42.xi);
  expect(xi).toHaveLength(11);
  const media = xi.reduce((s, id) => s + ovrDe(arsenal.p[+id.split("-")[1]]), 0) / 11;
  expect(document.querySelector("#forca b").textContent).toBe(media.toFixed(1).replace(".", ","));
  // Resumo: antes → depois
  clique(screen.getByRole("tab", { name: "Resumo" }));
  expect(document.querySelector("#forca-resumo").textContent).toContain(media.toFixed(1).replace(".", ",") + " → ");
  // Mercado: ordem "Overall" põe o 91 no topo (com "só quem cabe" desligado)
  clique(screen.getByRole("tab", { name: "Mercado" }));
  clique(document.querySelector("#fOpen"));
  fireEvent.change(painel().querySelector("#fs"), { target: { value: "o" } });
  const cabe = noPainel().getByRole("button", { name: "Só quem cabe no caixa" });
  if (cabe.getAttribute("aria-pressed") === "true") clique(cabe);
  clique(noPainel().getByRole("button", { name: "Aplicar" }));
  expect(document.querySelector(".ordem").textContent).toContain("Overall");
  expect(document.querySelector("#mList .row .ovr").textContent).toBe("91");
});
test("aba Time: tocar em um jogador e depois em outro troca os dois de posição", async () => {
  localStorage.setItem(CHAVE, JSON.stringify({ plans: { T42: { club: "T42", budget: 50, st: {}, ins: [], form: "4-3-3", xi: {}, custom: [] } }, last: "T42" }));
  render(<App />);
  clique(await screen.findByRole("button", { name: /Arsenal 27\/28/ }));
  clique(screen.getByRole("tab", { name: "Time" }));
  const vaga = (nome) => screen.getByRole("button", { name: new RegExp("^" + nome + ": ") });
  const quem = (nome) => vaga(nome).getAttribute("aria-label").replace(/^[^:]+: /, "").replace(" (improvisado)", "");
  const xi = () => salvo().plans.T42.xi;
  const antes = { ...xi() };
  const ld = quem("Lateral direito"), le = quem("Lateral esquerdo");
  // 1º toque: seleciona (sem abrir painel) e mostra a barra
  clique(vaga("Lateral direito"));
  expect(painel()).toBeNull();
  expect(vaga("Lateral direito").getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelector(".troca-bar").textContent).toContain("selecionado");
  // 2º toque em outro: os dois trocam
  clique(vaga("Lateral esquerdo"));
  expect(quem("Lateral direito")).toBe(le);
  expect(quem("Lateral esquerdo")).toBe(ld);
  expect(aviso()).toContain("trocaram de posição");
  expect(document.querySelector(".troca-bar")).toBeNull();
  expect(Object.values(xi()).sort()).toEqual(Object.values(antes).sort()); // os mesmos 11, só em vagas trocadas
  // Cancelar desfaz a seleção sem mudar nada
  clique(vaga("Goleiro"));
  clique(screen.getByRole("button", { name: "Cancelar" }));
  expect(document.querySelector(".troca-bar")).toBeNull();
  expect(xi()).toEqual(salvo().plans.T42.xi);
  // Com um reserva: titular selecionado + toque no reserva = o reserva entra no lugar
  clique(screen.getByRole("button", { name: "Adicionar reserva de Centroavante" }));
  const linha = noPainel().getAllByRole("button").find((b) => b.classList.contains("row"));
  const reserva = linha.querySelector(".nm").textContent;
  clique(linha);
  const ca = quem("Centroavante");
  clique(vaga("Centroavante"));
  clique(screen.getByRole("button", { name: `1º reserva de Centroavante: ${reserva}` }));
  expect(quem("Centroavante")).toBe(reserva);
  expect(screen.getByRole("button", { name: `1º reserva de Centroavante: ${ca}` })).toBeTruthy();
  // Sem seleção, tocar no reserva abre o painel dele, como antes
  clique(screen.getByRole("button", { name: `1º reserva de Centroavante: ${ca}` }));
  expect(noPainel().getByRole("button", { name: "Promover a titular" })).toBeTruthy();
});