// Painel de um jogador que o clube emprestou a outro clube: manter emprestado, vender ou trazer de volta.
import { useState } from "react";
import { POSN } from "../../logica/constantes.js";
import { ctrTxt } from "../../logica/formato.js";
import { emprestadosFora, situacaoEmp } from "../../logica/elenco.js";
import { dinheiro } from "../../logica/dinheiro.js";
import { Cabecalho } from "../Painel.jsx";
import { Foto } from "../Imagens.jsx";
import { Fatos, Estatisticas, Opcao } from "./comum.jsx";

export default function PainelEmprestado({ app, id }) {
  const item = emprestadosFora(app.plano).find((o) => o.id === id);
  const p = item.p;
  const atual = situacaoEmp(app.plano, id);
  const [s, setS] = useState(atual.s);
  const valor = atual.s === "vender" ? +atual.fee || 0 : p.v;
  const onde = item.para.n || "outro clube";

  const opcoes = [
    ["manter", "Manter emprestado", `Segue no ${onde} até ${ctrTxt(item.ate)}. Não conta no elenco.`],
    ["vender", "Vender", valor > 0 ? `Entra ${dinheiro(valor)} no caixa.` : "Sem valor de mercado: não entra dinheiro."],
    ["voltar", "Trazer de volta", "Volta ao elenco e passa a contar em tudo (total, idade, escalação)."],
  ];

  const salvar = () => {
    app.mudar((P) => {
      P.emp = P.emp || {};
      if (s === "manter") delete P.emp[id];
      else P.emp[id] = { s, fee: s === "vender" ? valor : 0 };
    });
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Foto p={p} z={56} />} titulo={p.n} sub={POSN[p.pos] + " · emprestado ao " + onde} onFechar={app.fecharPainel} />
      <Fatos p={p} />
      <p className="note">Emprestado ao {onde} até {ctrTxt(item.ate)}{item.contrato ? ` · contrato com o clube até ${ctrTxt(item.contrato)}` : ""}.</p>
      {!p.avulso && <Estatisticas p={p} />}
      {opcoes.map(([k, t, d]) => <Opcao key={k} marcado={s === k} titulo={t} detalhe={d} onClick={() => setS(k)} />)}
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>Salvar</button>
    </>
  );
}
