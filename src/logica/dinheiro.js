// Tudo sobre dinheiro: formatar valores e calcular o caixa do plano.

// Valores estão em milhões de euros: 30 vira "€30 mi", 0.6 vira "€600 mil"
export const eur = (v) => {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  return a >= 1 ? s + "€" + (Math.round(a * 10) / 10).toLocaleString("pt-BR") + " mi" : a > 0 ? s + "€" + Math.round(a * 1000) + " mil" : "€0";
};

// Caixa = orçamento inicial + vendas − contratações
export function calcularDinheiro(plano) {
  let vendas = 0, compras = 0;
  for (const id in plano.st) if (plano.st[id].s === "vende") vendas += +plano.st[id].fee || 0;
  for (const m of plano.ins) compras += +m.fee || 0;
  return { vendas, compras, caixa: (plano.budget || 0) + vendas - compras };
}
