// Números aleatórios com semente: a mesma semente dá sempre a mesma sequência.
// Assim, mesma semente + mesmo plano = mesma temporada (e "Re-simular" só troca a semente).

// Gerador mulberry32: rápido e bom o bastante para um jogo. Devolve uma função que dá números entre 0 e 1.
export function mulberry32(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mistura vários números (ou textos) num só, para criar uma semente própria de cada jogo:
// misturar(semente, rodada, jogo). Assim, simular uma rodada por vez ou tudo de uma vez dá o mesmo resultado.
export function misturar(...partes) {
  let h = 2166136261;
  for (const x of partes) {
    if (typeof x === "string") for (let i = 0; i < x.length; i++) h = Math.imul(h ^ x.charCodeAt(i), 16777619);
    else h = Math.imul(h ^ (x >>> 0), 16777619);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
export const rngDe = (...partes) => mulberry32(misturar(...partes));

// Semente nova (para "Re-simular")
export const novaSemente = () => Math.floor(Math.random() * 4294967296) >>> 0;

// Sorteio de Poisson (quantos gols um time faz, dada a média λ). Método de Knuth: bom para λ pequeno.
export function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// Sorteia um item com chance proporcional ao peso. Devolve o índice (ou -1 se todos os pesos forem 0).
export function sortearIndice(rng, pesos) {
  let total = 0;
  for (const w of pesos) total += w > 0 ? w : 0;
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < pesos.length; i++) {
    if (pesos[i] <= 0) continue;
    r -= pesos[i];
    if (r < 0) return i;
  }
  return pesos.length - 1;
}

// Embaralha uma cópia da lista (Fisher-Yates)
export function embaralhar(rng, lista) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}
