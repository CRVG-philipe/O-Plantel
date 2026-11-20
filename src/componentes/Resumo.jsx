// Aba Resumo: alertas, dinheiro, números do elenco, profundidade por posição, chegam e saem.
import { useEffect, useRef, useState } from "react";
import { D } from "../logica/dados.js";
import { NEED } from "../logica/constantes.js";
import { eur, calcularDinheiro } from "../logica/dinheiro.js";
import { alertas, elencoAtual, elencoOriginal, jogador, saidas, textoDoPlano } from "../logica/elenco.js";

const ROTULO_SAIDA = { vende: "venda", empresta: "empréstimo", libera: "liberado" };

export default function Resumo({ app }) {
  const { plano } = app;
  const m = calcularDinheiro(plano), sq = elencoAtual(plano), o = saidas(plano), al = alertas(plano), own = elencoOriginal(plano);
  const L = D.LG[D.CL[plano.club].lg];
  const prof = NEED.map(([l, ps, min]) => ({ l, min, n: sq.filter((p) => ps.includes(p.pos)).length }));
  const mx = Math.max(6, ...prof.map((x) => x.n));

  // "Copiar resumo": tenta copiar; se o navegador não deixar, mostra o texto numa caixa
  const [textoManual, setTextoManual] = useState(null);
  const caixa = useRef(null);
  useEffect(() => { if (textoManual !== null) caixa.current?.select(); }, [textoManual]);
  const copiar = () => {
    const t = textoDoPlano(plano);
    const mostrar = () => setTextoManual(t);
    try { navigator.clipboard.writeText(t).then(() => app.aviso("Resumo copiado"), mostrar); } catch (err) { mostrar(); }
  };

  return (
    <section className="panel on" id="p-resumo">
      <div className="sec">
        <h2><span>Pontos de atenção</span></h2>
        <div className="card">
          {al.length ? al.map((t) => <div className="alert" key={t}><i></i><span>{t}</span></div>)
            : <div className="alert ok"><i></i><span>Tudo certo. O elenco está equilibrado.</span></div>}
        </div>
      </div>

      <div className="sec">
        <h2><span>Dinheiro</span></h2>
        <div className="card">
          <div className="kv"><span>Orçamento inicial</span><span className="num">{eur(plano.budget || 0)}</span></div>
          <div className="kv"><span>Vendas</span><span className="num" style={{ color: "var(--pos)" }}>+{eur(m.vendas)}</span></div>
          <div className="kv"><span>Contratações</span><span className="num" style={{ color: "var(--neg)" }}>{m.compras ? "−" + eur(m.compras) : "€0"}</span></div>
          <div className="kv tot"><span>Caixa final</span><span className="num" style={{ color: m.caixa < 0 ? "var(--neg)" : "inherit" }}>{eur(m.caixa)}</span></div>
        </div>
      </div>

      <div className="sec">
        <h2><span>Elenco</span></h2>
        <div className="card">
          <div className="kv"><span>Jogadores</span><span className="num">{sq.length}</span></div>
          <div className="kv"><span>Valor de mercado</span><span className="num">{eur(sq.reduce((s, p) => s + p.v, 0))} <span className="mute">(era {eur(own.reduce((s, p) => s + p.v, 0))})</span></span></div>
          <div className="kv"><span>Idade média em 2027</span><span className="num">{(sq.reduce((s, p) => s + p.a, 0) / (sq.length || 1)).toFixed(1)} anos</span></div>
          <div className="kv"><span>Estrangeiros</span><span className="num">{sq.filter((p) => p.nat && p.nat !== L.nat).length}</span></div>
        </div>
      </div>

      <div className="sec">
        <h2><span>Jogadores por posição</span><span>mínimo recomendado</span></h2>
        <div className="card" style={{ padding: "4px 0" }}>
          {prof.map((x) => (
            <div className="dr" key={x.l}>
              <span>{x.l}</span>
              <div className="trk">
                <i className={x.n < x.min ? "low" : ""} style={{ width: (x.n / mx) * 100 + "%" }}></i>
                <s style={{ left: (x.min / mx) * 100 + "%" }}></s>
              </div>
              <b className="num" style={{ textAlign: "right" }}>{x.n}/{x.min}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <h2><span>Chegam</span><span>{plano.ins.length}</span></h2>
        <div className="card">
          {plano.ins.length ? plano.ins.map((mv) => {
            const p = jogador(plano, mv.id);
            return (
              <div className="kv" key={mv.id}>
                <span>{p.n} <span className="mute">· {p.pos}</span></span>
                <span className="num">{mv.type === "emprestimo" ? "empréstimo" : mv.fee ? eur(mv.fee) : "grátis"}</span>
              </div>
            );
          }) : <div className="empty" style={{ padding: 16 }}>Nenhuma contratação.</div>}
        </div>
      </div>

      <div className="sec">
        <h2><span>Saem</span><span>{o.length}</span></h2>
        <div className="card">
          {o.length ? o.map(({ p, x }) => (
            <div className="kv" key={p.id}>
              <span>{p.n} <span className="mute">· {p.pos}</span></span>
              <span className="num">{x.s === "vende" ? eur(+x.fee || 0) : ROTULO_SAIDA[x.s]}</span>
            </div>
          )) : <div className="empty" style={{ padding: 16 }}>Ninguém saiu.</div>}
        </div>
      </div>

      <div className="acts">
        <button className="btn pri" id="copy" onClick={copiar}>Copiar resumo</button>
        <button className="btn" id="chg" onClick={() => app.abrirPainel("clube")}>Reiniciar progresso</button>
      </div>
      <div id="copyBox">
        {textoManual !== null && <textarea className="copy" readOnly value={textoManual} ref={caixa} />}
      </div>
    </section>
  );
}
