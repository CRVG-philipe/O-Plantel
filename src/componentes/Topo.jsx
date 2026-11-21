// Barra fixa do topo: logo, moeda, botão do clube, cards de resumo (caixa, jogadores, chegam/saem) e abas.
// Visual: brilho suave na cor do clube, escudo do clube como marca-d'água e indicador deslizante nas abas.
import { useEffect, useRef } from "react";
import { D } from "../logica/dados.js";
import { dinheiro, calcularDinheiro, simbolo } from "../logica/dinheiro.js";
import { elencoAtual, nChegam, nSaem } from "../logica/elenco.js";
import { Escudo } from "./Imagens.jsx";
import SeletorMoeda from "./SeletorMoeda.jsx";
import BotaoTema from "./BotaoTema.jsx";

const ABAS = [["elenco", "Elenco"], ["mercado", "Mercado"], ["time", "Time"], ["resumo", "Resumo"]];

export default function Topo({ app }) {
  const { plano } = app;
  const c = plano && D.CL[plano.club];
  const ref = useRef();

  // Guarda a altura do topo em --topo-h, para a busca do Mercado grudar logo abaixo dele
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--topo-h", el.offsetHeight + "px"));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // Endereço completo: dentro de uma variável do CSS, um endereço relativo seria lido a partir
    // da pasta do arquivo CSS (/assets/) no site publicado, e a imagem não seria achada.
    <div className="top" ref={ref} style={c && c.hd ? { "--escudo": `url("${new URL(`img/teams/${c.hd}.webp`, document.baseURI).href}")` } : undefined}>
      <div className="col">
        <div className="bar">
          <div className="logo"><i></i>Plantel</div>
          <span style={{ marginLeft: "auto" }}><SeletorMoeda app={app} /></span>
          <BotaoTema app={app} />
          <span id="clubSlot">
            {plano && (
              <button className="clubBtn" id="chg" aria-label="Trocar clube" onClick={() => app.abrirPainel("clube")}>
                <Escudo k={plano.club} />
                <span className="clubNome" style={{ maxWidth: "40vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.n}</span>
              </button>
            )}
          </span>
        </div>
        {plano && <ResumoEAbas app={app} />}
      </div>
    </div>
  );
}

const IconePessoas = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" /><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.4 3.5 5.2" /></svg>
);
const IconeTroca = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></svg>
);

function ResumoEAbas({ app }) {
  const { plano, aba } = app;
  const m = calcularDinheiro(plano), sq = elencoAtual(plano);
  const idade = (sq.reduce((s, p) => s + p.a, 0) / (sq.length || 1)).toFixed(1).replace(".", ",");
  // Barra do caixa: quanto do dinheiro disponível (orçamento + vendas) ainda sobra; negativo = barra cheia em vermelho
  const disponivel = (plano.budget || 0) + m.vendas;
  const sobra = m.caixa < 0 ? 100 : disponivel > 0 ? Math.min(100, (m.caixa / disponivel) * 100) : 0;
  const indice = ABAS.findIndex(([k]) => k === aba);
  return (
    <div id="planBar">
      <div className="sum" id="sum">
        <button id="bud" className={"stat" + (m.caixa < 0 ? " neg" : "")} onClick={() => app.abrirPainel("orcamento", { primeiro: false })}>
          <span className="ic" aria-hidden="true">{simbolo()}</span>
          <b className="num">{dinheiro(m.caixa)}</b>
          <span className="l">Caixa · <u>editar</u></span>
          <span className="barra" aria-hidden="true"><span style={{ width: sobra + "%" }}></span></span>
        </button>
        <button className="stat" onClick={() => app.irPara("elenco")}>
          <span className="ic" aria-hidden="true"><IconePessoas /></span>
          <b className="num">{sq.length}</b>
          <span className="l">Jogadores<span className="media"> · média {idade} anos</span></span>
        </button>
        <button className="stat stat-mov" onClick={() => app.irPara("resumo")}>
          <span className="ic" aria-hidden="true"><IconeTroca /></span>
          <b className="num"><span className="up">+{nChegam(plano)}</span> <span className="dn">−{nSaem(plano)}</span></b>
          <span className="l">Chegam · saem</span>
        </button>
      </div>
      <div className="tabs" role="tablist" id="tabs" style={{ "--i": indice }}>
        <span className="ind" aria-hidden="true"></span>
        {ABAS.map(([k, nome]) => (
          <button key={k} role="tab" aria-selected={aba === k} onClick={() => app.irPara(k)}>{nome}</button>
        ))}
      </div>
    </div>
  );
}
