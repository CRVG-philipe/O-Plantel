// Busca e filtros da aba Mercado.
import { D } from "./dados.js";
import { CHIPS } from "./constantes.js";
import { norm } from "./formato.js";
import { calcularDinheiro, precoDeCompra } from "./dinheiro.js";

// Quantos filtros estão ligados (o número que aparece no botão "Filtros")
export function contarFiltros(F) {
  return (F.lg ? 1 : 0) + (F.club ? 1 : 0) + (F.age < 99 ? 1 : 0) + (F.fit ? 1 : 0) + (F.free ? 1 : 0) + (F.sort !== "vd" ? 1 : 0);
}

// Jogadores de outros clubes que passam na busca, no botão de posição e nos filtros
export function buscarJogadores(plano, busca, chip, F) {
  const q = norm(busca.trim()), ps = CHIPS[chip][1], caixa = calcularDinheiro(plano).caixa;
  const jaVem = new Set(plano.ins.map((m) => m.id));
  const l = D.ALL.filter((p) =>
    p.club !== plano.club && !jaVem.has(p.id) &&
    (!ps || ps.includes(p.pos)) &&
    (!F.lg || p.lg === F.lg) &&
    (!F.club || p.club === F.club) &&
    p.a <= F.age &&
    (!F.fit || precoDeCompra(p) <= caixa) &&
    (!F.free || p.end26) &&
    (!q || p.nn.includes(q) || D.CL[p.club].nn.includes(q))
  );
  l.sort(F.sort === "vd" ? (a, b) => b.v - a.v : F.sort === "va" ? (a, b) => a.v - b.v : (a, b) => a.a - b.a || b.v - a.v);
  return l;
}
