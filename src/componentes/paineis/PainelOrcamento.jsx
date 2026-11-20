// Painel do orçamento inicial (abre sozinho na primeira vez que se planeja um clube).
// O valor é digitado na moeda escolhida e guardado em euro.
import { useState } from "react";
import { ATALHOS, lerCampo, moedaAtual, paraCampo, simbolo } from "../../logica/dinheiro.js";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelOrcamento({ app, primeiro }) {
  const inicialEur = app.plano.budget ?? 20;
  // { eur: valor de partida em euro (ou null se veio de um atalho), texto: o que está no campo }
  const [valor, setValor] = useState(() => ({ eur: inicialEur, texto: paraCampo(inicialEur) }));

  const salvar = () => {
    app.mudar((P) => { P.budget = lerCampo(valor.texto, valor.eur); });
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Escudo k={app.plano.club} z={48} />}
        titulo={primeiro ? "Quanto você tem para gastar?" : "Orçamento"}
        sub={primeiro ? "Você pode mudar isso depois, tocando no caixa." : ""}
        onFechar={app.fecharPainel} />
      <label className="field">Orçamento inicial ({simbolo()} milhões)
        <input id="bv" className="num" type="number" min="0" step="1" inputMode="decimal" value={valor.texto} onChange={(e) => setValor({ eur: null, texto: e.target.value })} autoFocus={noComputador()} />
      </label>
      <div className="presets">
        {ATALHOS[moedaAtual()].map((x) => <button key={x} onClick={() => setValor({ eur: null, texto: String(x) })}>{simbolo()} {x} mi</button>)}
      </div>
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>{primeiro ? "Começar" : "Salvar"}</button>
    </>
  );
}
