// Painel de um jogador do próprio elenco: fica, vende, empresta ou libera.
// Se ele veio emprestado de outro clube: manter emprestado, devolver ou comprar.
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { POSN } from "../../logica/constantes.js";
import { ctrTxt } from "../../logica/formato.js";
import { jogador, recebido, situacao, situacaoEmp } from "../../logica/elenco.js";
import { dinheiro, lerCampo, paraCampo, simbolo } from "../../logica/dinheiro.js";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { Foto } from "../Imagens.jsx";
import { Fatos, Estatisticas, Opcao } from "./comum.jsx";

export default function PainelJogador({ app, id }) {
  const p = jogador(app.plano, id);
  if (recebido(app.plano, p)) return <PainelRecebido app={app} p={p} />;
  return <PainelProprio app={app} p={p} id={id} />;
}

function PainelProprio({ app, p, id }) {
  const atual = situacao(app.plano, id);
  const [s, setS] = useState(atual.s);
  // Valor da venda: guardado em euro, mostrado/digitado na moeda escolhida
  const valorEur = atual.s === "vende" ? atual.fee : p.v;
  const [valor, setValor] = useState(() => paraCampo(valorEur));

  const opcoes = [
    ["fica", "Fica no elenco", p.end26 ? "O contrato acaba em " + ctrTxt(p.ctr) + ": precisa renovar." : ""],
    ["vende", "Vender", "Entra dinheiro no caixa."],
    ["empresta", "Emprestar", "Sai do elenco, sem dinheiro."],
    ["libera", "Liberar", "Rescisão ou fim de contrato."],
  ];

  const salvar = () => {
    app.mudar((P) => {
      if (s === "fica") delete P.st[id];
      else P.st[id] = { s, fee: s === "vende" ? lerCampo(valor, valorEur) : 0 };
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
        <label className="field">Valor da venda ({simbolo()} milhões)
          <input id="fee" className="num" type="number" min="0" step="0.1" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={noComputador()} />
        </label>
      )}
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>Salvar</button>
    </>
  );
}

// Jogador que o clube pegou emprestado: manter (padrão), devolver ao dono ou comprar.
// O valor da compra começa no valor de mercado e pode ser editado (guardado em euro, digitado na moeda escolhida).
function PainelRecebido({ app, p }) {
  const atual = situacaoEmp(app.plano, p.id);
  const [s, setS] = useState(atual.s);
  const precoEur = atual.s === "comprar" ? +atual.fee || 0 : p.v;
  const [valor, setValor] = useState(() => paraCampo(precoEur));
  const { de, ate, contrato } = p.emp;

  const opcoes = [
    ["manter", "Manter emprestado", `Continua no elenco até ${ctrTxt(ate)}, sem custo.`],
    ["devolver", "Devolver", `Volta para o ${de.n}. Sai do elenco, sem dinheiro.`],
    ["comprar", "Comprar", `Paga ao ${de.n} (valor de mercado: ${dinheiro(p.v)}) e ele vira jogador do clube.`],
  ];

  const salvar = () => {
    app.mudar((P) => {
      P.emp = P.emp || {};
      delete P.st[p.id];
      if (s === "manter") delete P.emp[p.id];
      else P.emp[p.id] = { s, fee: s === "comprar" ? lerCampo(valor, precoEur) : 0 };
    });
    app.fecharPainel();
  };

  return (
    <>
      <Cabecalho icone={<Foto p={p} z={56} />} titulo={p.n} sub={POSN[p.pos] + " · emprestado pelo " + de.n} onFechar={app.fecharPainel} />
      <Fatos p={p} />
      <p className="note">Emprestado pelo {de.n} até {ctrTxt(ate)}{contrato ? ` · contrato com o ${de.n} até ${ctrTxt(contrato)}` : ""}.</p>
      <Estatisticas p={p} />
      {opcoes.map(([k, t, d]) => <Opcao key={k} marcado={s === k} titulo={t} detalhe={d} onClick={() => setS(k)} />)}
      {s === "comprar" && (
        <label className="field">Valor da compra ({simbolo()} milhões)
          <input id="fee" className="num" type="number" min="0" step="0.1" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus={noComputador()} />
        </label>
      )}
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={salvar}>Salvar</button>
    </>
  );
}
