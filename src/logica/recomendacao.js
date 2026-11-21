// Nota de recomendação (0 a 100) de um jogador de outro clube para o clube do plano.
// É a ordem padrão do Mercado ("Recomendados"). Quatro partes:
//   a) Origem (35%): a liga dele costuma vender para a liga do clube? (tabela AFINIDADE, em afinidade.js)
//   b) Preço realista (25%): o valor combina com o patamar do clube (média do elenco) e cabe no caixa?
//      Ideal: entre 0,5x e 2x a média do elenco. Muito acima disso pesa contra (a Série C não vê Haaland no topo).
//   c) Idade e contrato (15%): 20–29 anos é o ideal; acima de 31 só vale em ligas de veteranos.
//      Contrato acabando em até 12 meses ganha bônus (mais barato e mais realista).
//   d) Necessidade (10%): posições com poucos jogadores no elenco planejado (quem fica + quem chega) valem mais.
//   e) Qualidade (15%): overall bem acima da média do elenco do clube ganha pontos, mas só na medida em que o preço
//      cabe no patamar do clube (a estrela cara demais não sobe por ser boa).
import { D } from "./dados.js";
import { NEED } from "./constantes.js";
import { calcularDinheiro, precoDeCompra, PRECO_MINIMO } from "./dinheiro.js";
import { elencoAtual } from "./elenco.js";
import { afinidade } from "./afinidade.js";

// Ligas onde jogador acima de 31 anos ainda é contratação comum
export const LIGAS_DE_VETERANOS = ["SAU", "QAT", "UAE", "TUR", "MEX", "USA", "BRA"];

const PESO = { origem: 35, preco: 25, idade: 15, necessidade: 10, qualidade: 15 };

// Média de valor dos jogadores com valor (> 0) de uma lista; null se ninguém tiver valor
function mediaDeValor(lista) {
  const v = lista.filter((p) => p.v > 0);
  return v.length ? v.reduce((s, p) => s + p.v, 0) / v.length : null;
}

// Dados do clube de destino que valem para todos os jogadores: calculados uma vez por plano.
// (O plano é copiado a cada mudança, então um plano novo = cálculo novo.)
const CACHE = new WeakMap();
function contexto(plano, clubeDestino) {
  let c = CACHE.get(plano);
  if (c && c.k === clubeDestino.k) return c;
  const original = D.ALL.filter((p) => p.club === clubeDestino.k);
  // Patamar do clube: média do elenco; se quase ninguém tem valor (ex.: Série C), a média da liga
  const daLiga = () => mediaDeValor(D.ALL.filter((p) => p.lg === clubeDestino.lg));
  const comValor = original.filter((p) => p.v > 0).length;
  const media = Math.max(PRECO_MINIMO, (comValor >= 5 ? mediaDeValor(original) : daLiga()) || PRECO_MINIMO);
  // Quantos jogadores o elenco planejado tem em cada grupo de posição
  const elenco = elencoAtual(plano).filter(Boolean);
  const grupos = {};
  NEED.forEach(([, ps, min]) => {
    const n = elenco.filter((p) => ps.includes(p.pos)).length;
    ps.forEach((pos) => { grupos[pos] = { n, min }; });
  });
  // Overall médio do elenco original do clube (quem tem overall)
  const ovrs = original.map((p) => p.ovr).filter((o) => o != null);
  const mediaOvr = ovrs.length ? ovrs.reduce((s, o) => s + o, 0) / ovrs.length : null;
  c = { k: clubeDestino.k, caixa: calcularDinheiro(plano).caixa, media, grupos, mediaOvr };
  CACHE.set(plano, c);
  return c;
}

// Patamar de preço: 1 quando o preço fica entre 0,5x e 2x a média de valor do elenco; cai fora disso
function patamarDePreco(preco, ctx) {
  const r = preco / ctx.media;
  return r < 0.5 ? 0.6 + 0.8 * r : r <= 2 ? 1 : Math.max(0, 1 - Math.log2(r / 2) / 3);
}

// b) Preço: patamar do clube e caixa
function notaPreco(preco, patamar, ctx) {
  return patamar * (preco <= ctx.caixa ? 1 : 0.4);
}

// e) Qualidade: overall acima da média do elenco. Igual à média = 0,3; +10 ou mais = 1; 5 abaixo ou menos = 0.
// Multiplicada pelo patamar de preço: só vale para quem é realista para o clube.
function notaQualidade(p, patamar, ctx) {
  if (p.ovr == null || ctx.mediaOvr == null) return 0.3;
  const d = p.ovr - ctx.mediaOvr;
  const q = d >= 10 ? 1 : d <= -5 ? 0 : d < 0 ? 0.3 * (d + 5) / 5 : 0.3 + 0.07 * d;
  return q * patamar;
}

// c) Idade e contrato
function notaIdade(a, liga) {
  if (!a) return 0.5;                                // sem data de nascimento
  if (a < 18) return 0.45;
  if (a < 20) return 0.7;
  if (a <= 29) return 1;
  const veterano = LIGAS_DE_VETERANOS.includes(liga);
  if (a <= 31) return veterano ? 0.9 : 0.75;
  if (veterano) return a <= 34 ? 0.85 : 0.55;
  return a <= 33 ? 0.25 : 0.1;
}
// Meses até o fim do contrato, contando da data dos dados ("20/11/2026")
function mesesDeContrato(ctr) {
  if (!ctr) return null;
  const [, mes, ano] = (D.DATA?.updated || "01/11/2026").split("/").map(Number);
  return (+ctr.slice(0, 4) - ano) * 12 + (+ctr.slice(5, 7) - mes);
}
function notaContrato(ctr) {
  const m = mesesDeContrato(ctr);
  if (m === null) return 0.3;
  return m <= 12 ? 1 : m <= 24 ? 0.4 : 0;
}

// d) Necessidade da posição no elenco planejado
function notaNecessidade(pos, ctx) {
  const g = ctx.grupos[pos];
  if (!g) return 0.3;
  // Suave de propósito: a posição carente sobe, mas não toma a lista inteira
  return g.n < g.min ? 1 : g.n === g.min ? 0.75 : g.n === g.min + 1 ? 0.6 : 0.5;
}

// Nota de 0 a 100 do jogador (do clubeOrigem) para o clubeDestino, no plano atual
export function pontuar(jogador, clubeOrigem, clubeDestino, plano) {
  const ctx = contexto(plano, clubeDestino);
  const origem = afinidade(clubeDestino.lg, clubeOrigem.lg);
  const valor = precoDeCompra(jogador), patamar = patamarDePreco(valor, ctx); // calculados uma vez só
  const preco = notaPreco(valor, patamar, ctx);
  const idade = 0.75 * notaIdade(jogador.a, clubeDestino.lg) + 0.25 * notaContrato(jogador.ctr);
  const necessidade = notaNecessidade(jogador.pos, ctx);
  const qualidade = notaQualidade(jogador, patamar, ctx);
  return Math.round(PESO.origem * origem + PESO.preco * preco + PESO.idade * idade + PESO.necessidade * necessidade + PESO.qualidade * qualidade);
}

// Notas de todos os jogadores de outros clubes para o plano: Map id → nota
export function notasDoMercado(plano) {
  const destino = D.CL[plano.club];
  const m = new Map();
  for (const p of D.ALL) if (p.club !== plano.club) m.set(p.id, pontuar(p, D.CL[p.club], destino, plano));
  return m;
}
