// Funções pequenas que transformam dados em texto para mostrar na tela.
import { MES } from "./constantes.js";

// Tira acentos e deixa minúsculo, para a busca achar "São Paulo" digitando "sao paulo"
export const norm = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

// "2027-06" vira "jun/27"
export const ctrTxt = (c) => (c ? MES[+c.slice(5, 7) - 1] + "/" + c.slice(2, 4) : "–");

// Brilho de uma cor (0 = preto, 1 = branco). Usado para escolher a cor de destaque.
export const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

// Nome curto para o campinho: "Gabriel Barbosa Almeida" vira "G. Almeida"
export const short = (n) => {
  const w = n.split(" ");
  return (w.length > 2 || n.length > 11) && w.length > 1 ? w[0][0] + ". " + w[w.length - 1] : n;
};

// Número com vírgula: 1.5 vira "1,50"
export const dec = (x, n = 2) => x.toFixed(n).replace(".", ",");

// Iniciais para quem não tem foto: "Novo Jogador" vira "NJ"
export const iniciais = (n) => n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Linha de estatísticas da lista do Mercado
export function statLine(p) {
  const s = p.st;
  if (!s) return "Estatísticas indisponíveis";
  if (!s[0]) return "Sem jogos na temporada";
  return `${s[0]} J · ${s[1]} G · ${s[2]} A${s[3] ? " · nota " + dec(s[3]) : ""}`;
}
