// Painel de um jogador do próprio elenco: fica, vende, empresta ou libera.
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { POSN } from "../../logica/constantes.js";
import { ctrTxt } from "../../logica/formato.js";
import { jogador, situacao } from "../../logica/elenco.js";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { Foto } from "../Imagens.jsx";
import { Fatos, Estatisticas, Opcao } from "./comum.jsx";

export default function PainelJogador({ app, id }) {
  const p = jogador(app.plano, id);
  const atual = situacao(app.plano, id);
  const [s, setS] = useState(atual.s);
  const [valor, setValor] = useState(atual.s === "vende" ? atual.fee : p.v);

  const opcoes = [
    ["fica", "Fica no elenco", p.end26 ? "O contrato acaba em " + ctrTxt(p.ctr) + ": precisa renovar." : ""],
    ["vende", "Vender", "Entra dinheiro no caixa."],
    ["empresta", "Emprestar", "Sai do elenco, sem dinheiro."],
    ["libera", "Liberar", "Rescisão ou fim de contrato."],
  ];

  const salvar = () => {
    app.mudar((P) => {
      if (s === "fica") delete P.st[id];
      else P.st[id] = { s, fee: s === "vende" ? Math.max(0, +valor || 0) : 0 };
    });
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Foto p={p} z={56} />} titulo={p.n} sub={POSN[p.pos] + " · " + D.CL[p.club].n} onFechar={app.fecharPainel} />
      <Fatos p={p} />
      <Estatisticas p={p} />
      {opcoes.map(([k, t, d]) => <Opcao key={k} marcado={s === k} titulo={t} detalhe={d} onClick={() => setS(k)} />)}
      {s === "vende" && (
        <label className="field">Valor da venda (€ milhões)
          <input id="fee" className="num" type="number" min="0" step="0.1" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={noComputador()} />
        </label>
      )}
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>Salvar</button>
    </>
  );
}
