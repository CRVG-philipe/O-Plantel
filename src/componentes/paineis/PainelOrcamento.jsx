// Painel do orçamento inicial (abre sozinho na primeira vez que se planeja um clube).
import { useState } from "react";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelOrcamento({ app, primeiro }) {
  const [valor, setValor] = useState(app.plano.budget ?? 20);

  const salvar = () => {
    app.mudar((P) => { P.budget = Math.max(0, +valor || 0); });
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Escudo k={app.plano.club} z={48} />}
        titulo={primeiro ? "Quanto você tem para gastar?" : "Orçamento"}
        sub={primeiro ? "Você pode mudar isso depois, tocando no caixa." : ""}
        onFechar={app.fecharPainel} />
      <label className="field">Orçamento inicial (€ milhões)
        <input id="bv" className="num" type="number" min="0" step="1" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={noComputador()} />
      </label>
      <div className="presets">
        {[0, 10, 20, 50, 100].map((x) => <button key={x} onClick={() => setValor(x)}>€{x} mi</button>)}
      </div>
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>{primeiro ? "Começar" : "Salvar"}</button>
    </>
  );
}
