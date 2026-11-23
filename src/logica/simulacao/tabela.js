// Classificação: pontos, vitórias, saldo, gols pró, confronto direto e sorteio (nessa ordem).
// Também a temporada "rápida" (só placares, sem autores nem notas), usada na previsão e nas projeções.
import { sortearPlacar } from "./motor.js";

export const novaLinha = (k) => ({ k, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0, ultimos: [] });

// Soma um jogo na tabela (linhas = { k: linha })
export function registrarJogo(linhas, c, f, gc, gf) {
  const a = linhas[c], b = linhas[f];
  if (!a || !b) return;
  a.j++; b.j++;
  a.gp += gc; a.gc += gf; b.gp += gf; b.gc += gc;
  if (gc > gf) { a.v++; b.d++; a.pts += 3; a.ultimos.push("V"); b.ultimos.push("D"); }
  else if (gc < gf) { b.v++; a.d++; b.pts += 3; a.ultimos.push("D"); b.ultimos.push("V"); }
  else { a.e++; b.e++; a.pts++; b.pts++; a.ultimos.push("E"); b.ultimos.push("E"); }
}

const base = (a, b) => b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp;

// Ordena as linhas. "jogos" = [[casa, fora, gc, gf], ...] (para o confronto direto);
// "sorteio" = { k: número } (o último desempate, fixo para cada temporada).
export function ordenarTabela(linhas, jogos, sorteio) {
  const l = [...linhas].sort(base);
  for (let i = 0; i < l.length;) {
    let j = i;
    while (j + 1 < l.length && base(l[i], l[j + 1]) === 0) j++;
    if (j > i) {
      // Empate em tudo: mini-tabela só com os jogos entre os empatados (pontos, depois saldo nesses jogos)
      const grupo = new Set(l.slice(i, j + 1).map((x) => x.k)), pts = {}, sg = {};
      for (const [c, f, gc, gf] of jogos) {
        if (!grupo.has(c) || !grupo.has(f)) continue;
        pts[c] = (pts[c] || 0) + (gc > gf ? 3 : gc === gf ? 1 : 0);
        pts[f] = (pts[f] || 0) + (gf > gc ? 3 : gc === gf ? 1 : 0);
        sg[c] = (sg[c] || 0) + gc - gf;
        sg[f] = (sg[f] || 0) + gf - gc;
      }
      const parte = l.slice(i, j + 1).sort((a, b) => (pts[b.k] || 0) - (pts[a.k] || 0) || (sg[b.k] || 0) - (sg[a.k] || 0) || (sorteio[a.k] ?? 0) - (sorteio[b.k] ?? 0));
      l.splice(i, parte.length, ...parte);
    }
    i = j + 1;
  }
  return l;
}

// Tabela a partir dos resultados salvos (rodadas = [[[casa, fora, gc, gf, eventos], ...], ...])
export function tabelaDosResultados(clubes, rodadas, sorteio) {
  const linhas = Object.fromEntries(clubes.map((k) => [k, novaLinha(k)]));
  const jogos = [];
  for (const rodada of rodadas)
    for (const [c, f, gc, gf] of rodada) { registrarJogo(linhas, c, f, gc, gf); jogos.push([c, f, gc, gf]); }
  return ordenarTabela(Object.values(linhas), jogos, sorteio);
}

// Temporada rápida: só placares. forca = { k: força }; calendario = rodadas de [casa, fora].
// Devolve as chaves na ordem final. Desempate: pontos, vitórias, saldo, gols pró e sorteio.
export function temporadaRapida(rng, clubes, forca, calendario) {
  const idx = Object.fromEntries(clubes.map((k, i) => [k, i])), n = clubes.length;
  const pts = new Int32Array(n), v = new Int32Array(n), sg = new Int32Array(n), gp = new Int32Array(n);
  for (const rodada of calendario)
    for (const [c, f] of rodada) {
      const i = idx[c], j = idx[f];
      const [a, b] = sortearPlacar(rng, forca[c], forca[f]);
      gp[i] += a; gp[j] += b; sg[i] += a - b; sg[j] += b - a;
      if (a > b) { pts[i] += 3; v[i]++; } else if (b > a) { pts[j] += 3; v[j]++; } else { pts[i]++; pts[j]++; }
    }
  const sorte = clubes.map(() => rng());
  return clubes.map((k, i) => i).sort((a, b) => pts[b] - pts[a] || v[b] - v[a] || sg[b] - sg[a] || gp[b] - gp[a] || sorte[a] - sorte[b]).map((i) => clubes[i]);
}
