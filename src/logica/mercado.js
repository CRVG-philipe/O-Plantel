// Busca e filtros da aba Mercado.
import { D } from "./dados.js";
import { CHIPS, FAIXA_TODA, FILTROS_PADRAO, VALOR_MAX } from "./constantes.js";
import { norm } from "./formato.js";
import { nacionalidades } from "./nacionalidades.js";
import { ehEstrangeiro } from "./estrangeiros.js";
import { calcularDinheiro, precoDeCompra } from "./dinheiro.js";

// Quantos filtros estão ligados (o número que aparece no botão "Filtros")
export function contarFiltros(F) {
  return (F.lg ? 1 : 0) + (F.club ? 1 : 0) + (F.nat ? 1 : 0) + (faixaLigada(F.idade) ? 1 : 0) + (faixaLigada(F.ovr) ? 1 : 0) + (faixaLigada(F.valor, 0, VALOR_MAX) ? 1 : 0) +
    (F.fit ? 1 : 0) + (F.free ? 1 : 0) + (F.semEst ? 1 : 0) + (F.sort !== FILTROS_PADRAO.sort ? 1 : 0);
}

// Faixa [mínimo, máximo] diferente de lo–hi (0–100 na idade e no overall) = filtro ligado
export const faixaLigada = (f, lo = FAIXA_TODA[0], hi = FAIXA_TODA[1]) => !!f && (f[0] > lo || f[1] < hi);
// O número está dentro da faixa? Sem faixa ligada, todo mundo passa (até quem não tem o número, como jogador sem overall).
// Máximo no teto (hi) = sem teto: no valor, "200" inclui quem vale mais de € 200 mi.
const naFaixa = (x, f, lo, hi = FAIXA_TODA[1]) => !faixaLigada(f, lo, hi) || (x != null && x >= f[0] && (f[1] >= hi || x <= f[1]));

// Quem pode aparecer no Mercado: jogadores de outros clubes, menos os emprestados pelo próprio clube
// (esses já estão na seção "Emprestados a outros clubes")
const deFora = (p, plano) => p.club !== plano.club && p.emp?.de.k !== plano.club;

// Nacionalidades para o filtro: as de quem está no Mercado (só na liga/clube escolhidos, se houver),
// em ordem alfabética, com quantos jogadores tem cada uma: [["Alemanha", 746], ...]
export function nacionalidadesDoMercado(plano, lg, club) {
  const conta = new Map();
  for (const p of D.ALL) {
    if (!p.nat || !deFora(p, plano) || (lg && p.lg !== lg) || (club && p.club !== club)) continue;
    for (const n of nacionalidades(p.nat)) conta.set(n, (conta.get(n) || 0) + 1); // dupla nacionalidade conta nos dois
  }
  return [...conta].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
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
  const porApelido = nomesPorApelido(q), ligaDoPlano = D.CL[plano.club].lg;
  const l = D.ALL.filter((p) =>
    deFora(p, plano) && !jaVem.has(p.id) &&
    (!ps || ps.includes(p.pos)) &&
    (!F.lg || p.lg === F.lg) &&
    (!F.club || p.club === F.club) &&
    (!F.nat || nacionalidades(p.nat).includes(F.nat)) &&
    naFaixa(p.a, F.idade) &&
    naFaixa(p.ovr, F.ovr) &&
    naFaixa(p.v, F.valor, 0, VALOR_MAX) && // valor de mercado (o real, ou o estimado quando não há)
    (!F.fit || precoDeCompra(p) <= caixa) &&
    (!F.free || p.end26) &&
    (!F.semEst || !ehEstrangeiro(p, ligaDoPlano)) && // "Só jogadores que não ocupam vaga de estrangeiro"
    (!q || p.nn.includes(q) || D.CL[p.club].nn.includes(q) || porApelido.has(p.nn))
  );
  const ordem = (ORDENAR[F.sort] || ORDENAR.rec)(notas);
  const forca = (p) => porApelido.get(p.nn) || 0;
  l.sort(porApelido.size ? (a, b) => forca(b) - forca(a) || ordem(a, b) : ordem);
  return l;
}
