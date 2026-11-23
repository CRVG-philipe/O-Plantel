// "Lista de jogadores": consulta de todos os jogadores do site, fora de qualquer time.
// Filtros, ordens e o endereço (os filtros ficam na URL para dar para compartilhar: ?liga=BRA&pos=CA).
import { D } from "./dados.js";
import { PAISES, VALOR_MAX } from "./constantes.js";
import { norm } from "./formato.js";
import { nacionalidadesDe } from "./nacionalidades.js";
import { nomesPorApelido } from "./mercado.js";

export const POR_PAGINA = 50;
export { VALOR_MAX }; // € mi: o teto da faixa de valor ("200" = sem teto), definido em constantes.js

// Filtros padrão. pos = lista de posições (vazia = todas); faixas = [mínimo, máximo]
export const LISTA_PADRAO = { q: "", pais: "", liga: "", clube: "", pos: [], idade: [0, 100], valor: [0, VALOR_MAX], ovr: [0, 100], nat: "", fim: false, emp: false, ordem: "o", pag: 1 };

// Ordens: [rótulo, comparação]. Empate: maior overall, depois maior valor.
const st = (p, i) => (p.st ? p.st[i] : -1);
const nota = (p) => (p.st && p.st[0] ? p.st[3] || 0 : -1);
const empate = (a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || b.v - a.v;
export const ORDENS_LISTA = {
  o: ["Overall", (a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || b.v - a.v],
  v: ["Valor", (a, b) => b.v - a.v || empate(a, b)],
  a: ["Idade (mais jovens)", (a, b) => (a.a || 99) - (b.a || 99) || empate(a, b)],
  n: ["Nome", (a, b) => a.n.localeCompare(b.n, "pt-BR")],
  g: ["Gols", (a, b) => st(b, 1) - st(a, 1) || empate(a, b)],
  as: ["Assistências", (a, b) => st(b, 2) - st(a, 2) || empate(a, b)],
  nt: ["Nota", (a, b) => nota(b) - nota(a) || empate(a, b)],
};

const faixaLigada = (f, lo, hi) => !!f && (f[0] > lo || f[1] < hi);
const naFaixa = (x, f, lo, hi) => !faixaLigada(f, lo, hi) || (x != null && x >= f[0] && (f[1] >= hi || x <= f[1]));

// Quantos filtros estão ligados (o número do botão "Filtros"; a busca e as posições ficam à vista e não contam)
export function contarFiltrosLista(F) {
  return (F.pais ? 1 : 0) + (F.liga ? 1 : 0) + (F.clube ? 1 : 0) + (F.nat ? 1 : 0) + (F.fim ? 1 : 0) + (F.emp ? 1 : 0) +
    (faixaLigada(F.idade, 0, 100) ? 1 : 0) + (faixaLigada(F.valor, 0, VALOR_MAX) ? 1 : 0) + (faixaLigada(F.ovr, 0, 100) ? 1 : 0);
}

// Jogadores que passam nos filtros, já na ordem escolhida. Quem bate pelo apelido vem no topo (como no Mercado).
export function filtrarLista(F) {
  const q = norm((F.q || "").trim()), porApelido = nomesPorApelido(q);
  const ligasDoPais = F.pais ? PAISES.find((P) => P.sigla === F.pais)?.ligas || [] : null;
  const pos = new Set(F.pos || []);
  const l = D.ALL.filter((p) =>
    (!ligasDoPais || ligasDoPais.includes(p.lg)) &&
    (!F.liga || p.lg === F.liga) &&
    (!F.clube || p.club === F.clube) &&
    (!pos.size || pos.has(p.pos)) &&
    naFaixa(p.a, F.idade, 0, 100) &&
    naFaixa(p.v, F.valor, 0, VALOR_MAX) &&
    naFaixa(p.ovr, F.ovr, 0, 100) &&
    (!F.nat || nacionalidadesDe(p).includes(F.nat)) &&
    (!F.fim || p.end26) &&
    (!F.emp || !!p.emp) &&
    (!q || p.nn.includes(q) || D.CL[p.club].nn.includes(q) || porApelido.has(p.nn))
  );
  const ordem = (ORDENS_LISTA[F.ordem] || ORDENS_LISTA.o)[1];
  const forca = (p) => porApelido.get(p.nn) || 0;
  return l.sort(porApelido.size ? (a, b) => forca(b) - forca(a) || ordem(a, b) : ordem);
}

// Nacionalidades para o filtro (as de quem está no país/liga/clube escolhidos), em ordem alfabética
export function nacionalidadesDaLista(F) {
  const ligasDoPais = F.pais ? PAISES.find((P) => P.sigla === F.pais)?.ligas || [] : null;
  const conta = new Map();
  for (const p of D.ALL) {
    if ((ligasDoPais && !ligasDoPais.includes(p.lg)) || (F.liga && p.lg !== F.liga) || (F.clube && p.club !== F.clube)) continue;
    for (const n of nacionalidadesDe(p)) conta.set(n, (conta.get(n) || 0) + 1);
  }
  return [...conta].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
}

// ---------- Endereço (URL) ----------
// Nomes curtos na URL: ?q=&pais=&liga=&clube=&pos=CA,SA&idade=18-23&valor=0-10&ovr=70-80&nat=&fim=1&emp=1&ordem=v&p=2
// "jogadores" sozinho (?jogadores) abre a lista sem filtros.
const CHAVES_URL = ["jogadores", "q", "pais", "liga", "clube", "pos", "idade", "valor", "ovr", "nat", "fim", "emp", "ordem", "p"];
export const urlTemLista = (search) => { const u = new URLSearchParams(search); return CHAVES_URL.some((k) => u.has(k)); };

const lerFaixa = (txt, lo, hi) => {
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(txt || "");
  if (!m) return [lo, hi];
  const a = Math.max(lo, Math.min(hi, +m[1])), b = Math.max(lo, Math.min(hi, +m[2]));
  return a <= b ? [a, b] : [b, a];
};

export function lerFiltrosDaUrl(search) {
  const u = new URLSearchParams(search), F = structuredClone(LISTA_PADRAO);
  F.q = u.get("q") || "";
  F.pais = PAISES.some((P) => P.sigla === u.get("pais")) ? u.get("pais") : "";
  F.liga = D.LG[u.get("liga")] ? u.get("liga") : "";
  F.clube = D.CL[u.get("clube")] && !D.CL[u.get("clube")].criado ? u.get("clube") : "";
  F.pos = (u.get("pos") || "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => /^(GOL|ZAG|LD|LE|VOL|MC|MEI|MD|ME|PD|PE|SA|CA)$/.test(x));
  F.idade = lerFaixa(u.get("idade"), 0, 100);
  F.valor = lerFaixa(u.get("valor"), 0, VALOR_MAX);
  F.ovr = lerFaixa(u.get("ovr"), 0, 100);
  F.nat = u.get("nat") || "";
  F.fim = u.get("fim") === "1";
  F.emp = u.get("emp") === "1";
  F.ordem = ORDENS_LISTA[u.get("ordem")] ? u.get("ordem") : "o";
  F.pag = Math.max(1, parseInt(u.get("p"), 10) || 1);
  return F;
}

export function urlDosFiltros(F) {
  const u = new URLSearchParams();
  const faixa = (k, f, lo, hi) => { if (faixaLigada(f, lo, hi)) u.set(k, f[0] + "-" + f[1]); };
  if (F.q.trim()) u.set("q", F.q.trim());
  if (F.pais) u.set("pais", F.pais);
  if (F.liga) u.set("liga", F.liga);
  if (F.clube) u.set("clube", F.clube);
  if (F.pos.length) u.set("pos", F.pos.join(","));
  faixa("idade", F.idade, 0, 100); faixa("valor", F.valor, 0, VALOR_MAX); faixa("ovr", F.ovr, 0, 100);
  if (F.nat) u.set("nat", F.nat);
  if (F.fim) u.set("fim", "1");
  if (F.emp) u.set("emp", "1");
  if (F.ordem !== "o") u.set("ordem", F.ordem);
  if (F.pag > 1) u.set("p", String(F.pag));
  const s = u.toString().replace(/%2C/g, ",");
  return "?" + (s || "jogadores"); // sem filtro nenhum: "?jogadores", para o link continuar abrindo a lista
}
