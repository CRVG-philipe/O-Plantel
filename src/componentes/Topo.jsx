// Barra fixa do topo: logo, botão do clube, resumo (caixa, jogadores, chegam/saem) e abas.
import { D } from "../logica/dados.js";
import { eur, calcularDinheiro } from "../logica/dinheiro.js";
import { elencoAtual, saidas } from "../logica/elenco.js";
import { Escudo } from "./Imagens.jsx";

const ABAS = [["elenco", "Elenco"], ["mercado", "Mercado"], ["time", "Time"], ["resumo", "Resumo"]];

export default function Topo({ app }) {
  const { plano } = app;
  return (
    <div className="top">
      <div className="col">
        <div className="bar">
          <div className="logo"><i></i>Plantel</div>
          <span id="clubSlot" style={{ marginLeft: "auto" }}>
            {plano && (
              <button className="clubBtn" id="chg" aria-label="Trocar clube" onClick={() => app.abrirPainel("clube")}>
                <Escudo k={plano.club} />
                <span style={{ maxWidth: "40vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{D.CL[plano.club].n}</span>
              </button>
            )}
          </span>
        </div>
        {plano && <ResumoEAbas app={app} />}
      </div>
    </div>
  );
}

function ResumoEAbas({ app }) {
  const { plano, aba } = app;
  const m = calcularDinheiro(plano);
  return (
    <div id="planBar">
      <div className="sum" id="sum">
        <button id="bud" className={m.caixa < 0 ? "neg" : ""} onClick={() => app.abrirPainel("orcamento", { primeiro: false })}>
          <b className="num">{eur(m.caixa)}</b><span>Caixa · editar</span>
        </button>
        <button onClick={() => app.irPara("elenco")}>
          <b className="num">{elencoAtual(plano).length}</b><span>Jogadores</span>
        </button>
        <button onClick={() => app.irPara("resumo")}>
          <b className="num">+{plano.ins.length} −{saidas(plano).length}</b><span>Chegam · saem</span>
        </button>
      </div>
      <div className="tabs" role="tablist" id="tabs">
        {ABAS.map(([k, nome]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => app.irPara(k)}>{nome}</button>
        ))}
      </div>
    </div>
  );
}
