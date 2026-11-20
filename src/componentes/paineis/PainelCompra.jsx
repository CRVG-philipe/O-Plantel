// Painel de contratação de um jogador de outro clube (ou criado pelo usuário).
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { POSN } from "../../logica/constantes.js";
import { ctrTxt } from "../../logica/formato.js";
import { jogador } from "../../logica/elenco.js";
import { encaixarNoTime } from "../../logica/escalacao.js";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { Foto } from "../Imagens.jsx";
import { Fatos, Estatisticas, Opcao } from "./comum.jsx";

export default function PainelCompra({ app, id }) {
  const p = jogador(app.plano, id);
  const ja = app.plano.ins.find((m) => m.id === id); // já foi contratado?
  const [tipo, setTipo] = useState(ja ? ja.type : p.end26 ? "livre" : "compra");
  const [valor, setValor] = useState(ja ? ja.fee : p.v);

  const opcoes = [
    ["compra", "Comprar", "Paga a transferência."],
    ["emprestimo", "Empréstimo", "Normalmente sem custo ou com taxa baixa."],
    ["livre", "Sem custo", p.end26 ? "O contrato dele acaba em " + ctrTxt(p.ctr) + "." : "Ex.: fim de contrato ou rescisão."],
  ];

  const escolherTipo = (k) => { setTipo(k); setValor(k === "compra" ? p.v : 0); };

  const desfazer = () => {
    app.mudar((P) => {
      P.ins = P.ins.filter((m) => m.id !== id);
      P.custom = P.custom.filter((c) => c.id !== id);
    });
    app.fecharPainel();
  };

  const confirmar = () => {
    const rec = { id, type: tipo, fee: tipo === "livre" ? 0 : Math.max(0, +valor || 0) };
    app.mudar((P) => {
      const existente = P.ins.find((m) => m.id === id);
      if (existente) Object.assign(existente, rec);
      else { P.ins.push(rec); encaixarNoTime(P, p); }
    });
    if (!ja) app.aviso(p.n + " contratado");
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Foto p={p} z={56} />} titulo={p.n} sub={POSN[p.pos] + (D.CL[p.club] ? " · " + D.CL[p.club].n : "")} onFechar={app.fecharPainel} />
      <Fatos p={p} />
      {p.club !== "NOVO" && <Estatisticas p={p} />}
      {opcoes.map(([k, t, d]) => <Opcao key={k} marcado={tipo === k} titulo={t} detalhe={d} onClick={() => escolherTipo(k)} />)}
      {tipo !== "livre" && (
        <label className="field">{tipo === "compra" ? "Valor da compra" : "Taxa do empréstimo"} (€ milhões)
          <input id="fee" className="num" type="number" min="0" step="0.1" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={noComputador()} />
        </label>
      )}
      <div className="acts" style={{ marginTop: 8 }}>
        {ja ? <button className="btn danger" id="rm" onClick={desfazer}>Desfazer contratação</button>
          : <button className="btn" id="cn" onClick={app.fecharPainel}>Cancelar</button>}
        <button className="btn pri" id="ok" onClick={confirmar}>{ja ? "Salvar" : "Contratar"}</button>
      </div>
    </>
  );
}
