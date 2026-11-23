// Temporada ATUAL real (public/temporada-atual.json, em D.ATUAL): a tabela de hoje (Transfermarkt) e o fim dela.
// Para "terminar" uma liga, cada clube joga só os jogos que faltam (total_jogos − j), contra adversários da mesma
// liga sorteados de forma equilibrada (quem enfrentou menos aquele clube vem primeiro) e com mando alternado.
// Usado nas projeções de acesso/rebaixamento (pares com "usar_temporada_atual") e na tela "Ver tabela atual".
import { D } from "../dados.js";
import { sortearPlacar } from "./motor.js";

export const atualDa = (lg) => D.ATUAL?.[lg] || null;
export const dataAtual = () => D.ATUAL_DATA || "";

// Confrontos que faltam: { falta: { k: jogos } } → [[casa, fora]]
export function confrontosRestantes(rng, clubes, falta) {
  const resto = { ...falta }, casa = {}, vezes = {};
  const par = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const jogos = [];
  for (let guarda = 0; guarda < 10000; guarda++) {
    const vivos = clubes.filter((k) => resto[k] > 0);
    if (vivos.length < 2) break;
    const sorte = Object.fromEntries(vivos.map((k) => [k, rng()]));
    vivos.sort((x, y) => resto[y] - resto[x] || sorte[x] - sorte[y]);
    const a = vivos[0];
    const b = vivos.slice(1).sort((x, y) => (vezes[par(a, x)] || 0) - (vezes[par(a, y)] || 0) || resto[y] - resto[x] || sorte[x] - sorte[y])[0];
    const aEmCasa = (casa[a] || 0) <= (casa[b] || 0);
    jogos.push(aEmCasa ? [a, b] : [b, a]);
    casa[aEmCasa ? a : b] = (casa[aEmCasa ? a : b] || 0) + 1;
    vezes[par(a, b)] = (vezes[par(a, b)] || 0) + 1;
    resto[a]--; resto[b]--;
  }
  return jogos;
}

// Termina a temporada atual da liga: parte da tabela real e joga só o que falta (placares do motor).
// forca(k) = força do clube. Devolve as linhas em ordem final ({ k, j, v, e, d, gp, gc, pts, real: pontos de hoje }),
// ou null se a liga não está no arquivo.
export function terminarAtual(lg, rng, forca) {
  const A = atualDa(lg);
  if (!A) return null;
  const linhas = A.tabela.filter((r) => D.CL[r.k]).map((r) => ({ k: r.k, j: r.j, v: r.v, e: r.e, d: r.d, gp: r.gp, gc: r.gc, pts: r.pts, real: r.pts, jReal: r.j }));
  const por = Object.fromEntries(linhas.map((l) => [l.k, l]));
  const falta = Object.fromEntries(linhas.map((l) => [l.k, Math.max(0, (A.total_jogos || l.j) - l.j)]));
  for (const [c, f] of confrontosRestantes(rng, linhas.map((l) => l.k), falta)) {
    const [a, b] = sortearPlacar(rng, forca(c), forca(f));
    const x = por[c], y = por[f];
    x.j++; y.j++; x.gp += a; x.gc += b; y.gp += b; y.gc += a;
    if (a > b) { x.v++; y.d++; x.pts += 3; } else if (b > a) { y.v++; x.d++; y.pts += 3; } else { x.e++; y.e++; x.pts++; y.pts++; }
  }
  const sorte = Object.fromEntries(linhas.map((l) => [l.k, rng()]));
  return linhas.sort((a, b) => b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || sorte[a.k] - sorte[b.k]);
}
