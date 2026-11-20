// Regras do time titular. Estas funções ALTERAM o plano recebido
// (por isso o app sempre passa uma cópia do plano para elas).
import { FORMS, FIT } from "./constantes.js";
import { elencoAtual, jogador } from "./elenco.js";

// Monta o time do zero: em cada vaga, o jogador mais valioso que serve.
// Começa pelas vagas mais difíceis de preencher (com menos posições compatíveis).
// 1ª passada: só posição exata. 2ª passada: aceita adaptados.
export function escalarSozinho(plano) {
  const sq = elencoAtual(plano), used = new Set(), sl = FORMS[plano.form];
  plano.xi = {};
  const ord = sl.map((s, i) => i).sort((a, b) => FIT[sl[a][0]].length - FIT[sl[b][0]].length);
  for (const pass of [0, 1])
    for (const i of ord) {
      if (plano.xi[i]) continue;
      const r = sl[i][0];
      const c = sq.filter((p) => !used.has(p.id) && (pass ? FIT[r].includes(p.pos) : p.pos === r)).sort((a, b) => b.v - a.v)[0];
      if (c) { plano.xi[i] = c.id; used.add(c.id); }
    }
}

// Se alguém do time saiu do elenco (vendido, por exemplo), tira ele e preenche o buraco.
export function completarTime(plano) {
  const sq = elencoAtual(plano), ids = new Set(sq.map((p) => p.id));
  let saiu = false;
  for (const i in plano.xi) if (!ids.has(plano.xi[i])) { delete plano.xi[i]; saiu = true; }
  if (!saiu) return;
  const used = new Set(Object.values(plano.xi)), sl = FORMS[plano.form];
  for (const pass of [0, 1])
    sl.forEach(([r], i) => {
      if (plano.xi[i]) return;
      const c = sq.filter((p) => !used.has(p.id) && (pass ? FIT[r].includes(p.pos) : p.pos === r)).sort((a, b) => b.v - a.v)[0];
      if (c) { plano.xi[i] = c.id; used.add(c.id); }
    });
}

// Quando alguém é contratado: entra numa vaga vazia da posição dele,
// ou no lugar do titular menos valioso dessa posição (se valer mais que ele).
export function encaixarNoTime(plano, p) {
  const sl = FORMS[plano.form];
  let w = null;
  sl.forEach(([r], j) => {
    if (r !== p.pos) return;
    const c = plano.xi[j] && jogador(plano, plano.xi[j]);
    if (!c) { if (w === null || plano.xi[w]) w = j; return; }
    if (c.v < p.v && (w === null || (plano.xi[w] && jogador(plano, plano.xi[w]).v > c.v))) w = j;
  });
  if (w !== null) plano.xi[w] = p.id;
}
