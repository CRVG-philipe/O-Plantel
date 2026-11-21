// Busca e filtros da aba Mercado.
import { D } from "./dados.js";
import { CHIPS, FILTROS_PADRAO } from "./constantes.js";
import { norm } from "./formato.js";
import { calcularDinheiro, precoDeCompra } from "./dinheiro.js";

// Quantos filtros estão ligados (o número que aparece no botão "Filtros")
export function contarFiltros(F) {
  return (F.lg ? 1 : 0) + (F.club ? 1 : 0) + (F.age < 99 ? 1 : 0) + (F.fit ? 1 : 0) + (F.free ? 1 : 0) + (F.sort !== FILTROS_PADRAO.sort ? 1 : 0);
}

// Nomes (já preparados para a busca) dos jogadores cujo apelido bate com o que foi digitado: Map nome → força.
// Força 2: apelido igual ao texto ("messi"). Força 1: apelido começa com o texto, a partir de 3 letras
// ("gabi" acha "gabigol"). Assim "messi" põe o Messi antes do Estêvão ("messinho").
export function nomesPorApelido(q) {
  const nomes = new Map();
  if (!q) return nomes;
  for (const [apelido, nome] of Object.entries(D.APELIDOS)) {
    const forca = apelido === q ? 2 : q.length >= 3 && apelido.startsWith(q) ? 1 : 0;
    if (forca > (nomes.get(nome) || 0)) nomes.set(nome, forca);
  }
  return nomes;
}

// Ordens da lista. "rec" usa as notas de recomendacao.js (Map id → nota); empate: maior valor primeiro.
const nota = (p) => (p.st && p.st[0] ? p.st[3] || 0 : 0);
const ORDENAR = {
  rec: (notas) => (a, b) => (notas?.get(b.id) ?? 0) - (notas?.get(a.id) ?? 0) || b.v - a.v,
  vd: () => (a, b) => b.v - a.v,
  va: () => (a, b) => a.v - b.v,
  a: () => (a, b) => a.a - b.a || b.v - a.v,
  n: () => (a, b) => nota(b) - nota(a) || b.v - a.v,
  o: () => (a, b) => (b.ovr ?? 0) - (a.ovr ?? 0) || b.v - a.v, // maior overall primeiro
};

// Jogadores de outros clubes que passam na busca, no botão de posição e nos filtros.
// A busca olha o nome, o clube e os apelidos; quem bate pelo apelido vem no topo.
export function buscarJogadores(plano, busca, chip, F, notas) {
  const q = norm(busca.trim()), ps = CHIPS[chip][1], caixa = calcularDinheiro(plano).caixa;
  const jaVem = new Set(plano.ins.map((m) => m.id));
  const porApelido = nomesPorApelido(q);
  const l = D.ALL.filter((p) =>
    p.club !== plano.club && !jaVem.has(p.id) &&
    p.emp?.de.k !== plano.club && // emprestado pelo próprio clube: já está na seção "Emprestados a outros clubes"
    (!ps || ps.includes(p.pos)) &&
    (!F.lg || p.lg === F.lg) &&
    (!F.club || p.club === F.club) &&
    p.a <= F.age &&
    (!F.fit || precoDeCompra(p) <= caixa) &&
    (!F.free || p.end26) &&
    (!q || p.nn.includes(q) || D.CL[p.club].nn.includes(q) || porApelido.has(p.nn))
  );
  const ordem = (ORDENAR[F.sort] || ORDENAR.rec)(notas);
  const forca = (p) => porApelido.get(p.nn) || 0;
  l.sort(porApelido.size ? (a, b) => forca(b) - forca(a) || ordem(a, b) : ordem);
  return l;
}
