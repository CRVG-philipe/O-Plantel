// Carrega o data.json e monta as listas que o resto do app usa.
import { norm } from "./formato.js";

// "D" guarda os dados carregados. É preenchido uma vez só, por carregarDados().
//   D.DATA    o data.json inteiro
//   D.CLUBS   lista de clubes        D.CL[k]   clube pela chave (ex.: "T42")
//   D.LEAGUES lista de ligas         D.LG[k]   liga pela chave (ex.: "BRA")
//   D.ALL     todos os jogadores     D.BYID[id] jogador pelo id (ex.: "T42-3")
export const D = { DATA: null, CLUBS: [], LEAGUES: [], LG: {}, CL: {}, ALL: [], BYID: {} };

export async function carregarDados() {
  const DATA = await fetch("data.json").then((r) => r.json());
  Object.assign(D, { DATA, LG: {}, CL: {}, ALL: [], BYID: {} }); // começa do zero
  D.CLUBS = DATA.clubs;
  D.LEAGUES = DATA.leagues;

  // Ligas de calendário anual (temporada "2026") planejam "2027"; as outras, "27/28"
  D.LEAGUES.forEach((l) => {
    l.cal = /^\d{4}$/.test(l.season);
    l.plan = l.cal ? "2027" : "27/28";
    D.LG[l.k] = l;
  });

  D.CLUBS.forEach((c) => {
    D.CL[c.k] = c;
    c.nn = norm(c.n);
    const L = D.LG[c.lg];
    // Data de referência para a idade e limite de contrato "acabando"
    const ref = L.cal ? new Date(2027, 0, 1) : new Date(2027, 6, 1);
    const lim = L.cal ? "2026-12" : "2027-06";
    c.p.forEach((r, i) => {
      const [num, n, pos, dob, ctr, v, nat, sp, st, hd] = r;
      const b = new Date(dob);
      let a = ref.getFullYear() - b.getFullYear();
      if (new Date(ref.getFullYear(), b.getMonth(), b.getDate()) > ref) a--;
      if (!dob) a = 0;
      const p = { id: c.k + "-" + i, num, n, nn: norm(n), pos, ctr, v, nat, a, st, sp, hd, lg: c.lg, club: c.k, end26: !!ctr && ctr <= lim };
      D.ALL.push(p);
      D.BYID[p.id] = p;
    });
  });
}
