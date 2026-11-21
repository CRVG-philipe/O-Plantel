// Tudo sobre dinheiro: moeda escolhida, conversão, formatação e o caixa do plano.
//
// Regra de ouro: TUDO é guardado em euro (planos salvos, data.json).
// A moeda escolhida (€, R$ ou US$) só muda o que aparece na tela e como lemos o que a pessoa digita.

export const MOEDAS = { EUR: "€", BRL: "R$", USD: "US$" };

// Cotação de reserva (BCE, 20/11/2026): usada se a busca falhar e não houver cotação salva.
export const COTACAO_RESERVA = { BRL: 6.5259, USD: 1.099, data: "2026-11-20", fonte: "reserva" };

// Atalhos do painel de orçamento, já na moeda escolhida (em milhões)
export const ATALHOS = { EUR: [0, 10, 20, 50, 100], BRL: [0, 50, 100, 250, 500], USD: [0, 10, 20, 50, 100] };

// Moeda e cotação em uso. O Plantel.jsx chama usarMoeda() a cada desenho da tela.
const atual = { moeda: "EUR", cotacao: COTACAO_RESERVA };
export function usarMoeda(moeda, cotacao) {
  atual.moeda = MOEDAS[moeda] ? moeda : "EUR";
  atual.cotacao = cotacao || COTACAO_RESERVA;
}
export const moedaAtual = () => atual.moeda;
export const simbolo = () => MOEDAS[atual.moeda];
const taxa = () => (atual.moeda === "EUR" ? 1 : atual.cotacao[atual.moeda]);

// Euro → moeda escolhida, e o contrário (guardamos até 4 casas: €100)
export const paraMoeda = (vEur) => vEur * taxa();
export const paraEuro = (v) => Math.round((v / taxa()) * 10000) / 10000;

// Valores estão em milhões: 30 vira "€ 30 mi", 0.6 vira "€ 600 mil"; em reais, "R$ 196 mi"
export const dinheiro = (vEur) => {
  const v = paraMoeda(vEur), a = Math.abs(v), sinal = v < 0 ? "−" : "", s = simbolo();
  if (a >= 1) return `${sinal}${s} ${(Math.round(a * 10) / 10).toLocaleString("pt-BR")} mi`;
  if (a > 0) return `${sinal}${s} ${Math.round(a * 1000)} mil`;
  return `${s} 0`;
};

// Valor de UM jogador. Quem não tem valor no Transfermarkt usa o estimado (estimado = true), mostrado com "~"
// na frente ("~€ 300 mil"); sem valor nenhum, "—" em vez de "€ 0". Totais (caixa, valor do elenco) usam dinheiro().
// Na tela, use o componente <Valor p={p} /> (Jogador.jsx), que também põe o aviso "valor estimado" ao passar o mouse.
export const valorJogador = (v, estimado = false) => (v > 0 ? (estimado ? "~" : "") + dinheiro(v) : "—");

// Preço para contratar: o valor do jogador, mas nunca menos que € 0,1 mi (jogadores sem valor)
export const PRECO_MINIMO = 0.1;
export const precoDeCompra = (p) => Math.max(p.v || 0, PRECO_MINIMO);

// Campos de digitação (orçamento, venda, compra):
// paraCampo mostra um valor em euro na moeda escolhida (em euro, até 3 casas: 0,025 = 25 mil);
// lerCampo devolve em euro o que foi digitado. Se a pessoa não mexeu no campo, devolve o valor
// original exato (assim, abrir e salvar sem mudar nada não cria diferenças de arredondamento).
export const paraCampo = (vEur) => {
  const casas = atual.moeda === "EUR" ? 1000 : 10;
  return String(Math.round(paraMoeda(vEur) * casas) / casas);
};
export const lerCampo = (texto, eurOriginal) =>
  eurOriginal != null && texto === paraCampo(eurOriginal) ? eurOriginal : paraEuro(Math.max(0, +texto || 0));

// Caixa = orçamento inicial + vendas − contratações (tudo em euro)
export function calcularDinheiro(plano) {
  let vendas = 0, compras = 0;
  for (const id in plano.st) if (plano.st[id].s === "vende") vendas += +plano.st[id].fee || 0;
  for (const m of plano.ins) compras += +m.fee || 0;
  return { vendas, compras, caixa: (plano.budget || 0) + vendas - compras };
}

// Texto do rodapé: "€1 = R$ 6,53 · US$ 1,10 (BCE, 20/11/2026)"
export function textoCotacao(c) {
  const n = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [a, m, d] = c.data.split("-");
  return `€1 = R$ ${n(c.BRL)} · US$ ${n(c.USD)} (${c.fonte === "BCE" ? "BCE" : "cotação de reserva, BCE"}, ${d}/${m}/${a})`;
}
