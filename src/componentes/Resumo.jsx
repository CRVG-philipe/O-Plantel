// Aba Resumo: alertas, dinheiro, números do elenco, profundidade por posição, chegam e saem.
import { useEffect, useRef, useState } from "react";
import { D } from "../logica/dados.js";
import { NEED, corDoSetor } from "../logica/constantes.js";
import { Ovr, Pos } from "./Jogador.jsx";
import { dinheiro, calcularDinheiro } from "../logica/dinheiro.js";
import { alertas, comprados, devolvidos, elencoAtual, elencoOriginal, jogador, saidas, textoDoPlano, timeCompleto, vendidosFora, voltam } from "../logica/elenco.js";
import { compatibilidade, rotuloVaga } from "../logica/compatibilidade.js";
import { short } from "../logica/formato.js";
import { forcaAntes, forcaDoTime } from "../logica/escalacao.js";
import { EstrangeirosNoElenco } from "./Estrangeiros.jsx";
import { fmtForca } from "./Time.jsx";

const ROTULO_SAIDA = { vende: "venda", empresta: "empréstimo", libera: "liberado" };

// Lista de uma escolha de empréstimo (voltam, devolvidos, comprados); vazia, não aparece
function ListaEmprestimo({ id, titulo, lista, valor }) {
  if (!lista.length) return null;
  return (
    <div className="sec" id={id}>
      <h2><span>{titulo}</span><span>{lista.length}</span></h2>
      <div className="card">
        {lista.map((m) => (
          <div className="kv" key={m.p.id}>
            <span className="kv-nome"><Ovr p={m.p} /><Pos pos={m.p.pos} /><span>{m.p.n}</span></span>
            <span className="num">{valor(m)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Resumo({ app }) {
  const { plano } = app;
  const m = calcularDinheiro(plano), sq = elencoAtual(plano), o = saidas(plano), al = alertas(plano), own = elencoOriginal(plano);
  const vt = voltam(plano), dv = devolvidos(plano), cp = comprados(plano), vf = vendidosFora(plano); // empréstimos
  const prof = NEED.map(([l, ps, min]) => ({ l, min, ps, n: sq.filter((p) => ps.includes(p.pos)).length }));
  const mx = Math.max(6, ...prof.map((x) => x.n));
  // Força do time: antes (elenco original escalado sozinho) e depois (titulares do plano)
  const fa = forcaAntes(plano, app.criterio), fd = forcaDoTime(plano), dif = fa && fd ? Math.round((fd.media - fa.media) * 10) / 10 : 0;

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
          <div className="kv"><span>Orçamento inicial</span><span className="num">{dinheiro(plano.budget || 0)}</span></div>
          <div className="kv"><span>Vendas</span><span className="num" style={{ color: "var(--pos)" }}>+{dinheiro(m.vendas)}</span></div>
          <div className="kv"><span>Contratações</span><span className="num" style={{ color: "var(--neg)" }}>{m.compras ? "−" + dinheiro(m.compras) : dinheiro(0)}</span></div>
          <div className="kv tot"><span>Caixa final</span><span className="num" style={{ color: m.caixa < 0 ? "var(--neg)" : "inherit" }}>{dinheiro(m.caixa)}</span></div>
        </div>
      </div>

      <div className="sec">
        <h2><span>Elenco</span></h2>
        <div className="card">
          <div className="kv"><span>Jogadores</span><span className="num">{sq.length}</span></div>
          <div className="kv"><span>Valor de mercado</span><span className="num">{dinheiro(sq.reduce((s, p) => s + p.v, 0))} <span className="mute">(era {dinheiro(own.reduce((s, p) => s + p.v, 0))})</span></span></div>
          <div className="kv"><span>Idade média em 2027</span><span className="num">{(sq.reduce((s, p) => s + p.a, 0) / (sq.length || 1)).toFixed(1).replace(".", ",")} anos</span></div>
          <div className="kv" id="forca-resumo"><span>Força do time <span className="mute">(média de overall dos titulares)</span></span>
            <span className="num">{fa ? fmtForca(fa.media) : "—"} → <b>{fd ? fmtForca(fd.media) : "—"}</b>{fa && fd && <span className={dif > 0 ? "sobe" : dif < 0 ? "desce" : "mute"}> ({dif > 0 ? "+" : dif < 0 ? "−" : "±"}{fmtForca(Math.abs(dif))})</span>}</span>
          </div>
          <EstrangeirosNoElenco plano={plano} />
        </div>
      </div>

      <div className="sec">
        <h2><span>Jogadores por posição</span><span>mínimo recomendado</span></h2>
        <div className="card" style={{ padding: "4px 0" }}>
          {prof.map((x) => (
            <div className="dr" key={x.l}>
              <span>{x.l}</span>
              <div className="trk">
                <i className={x.n < x.min ? "low" : ""} style={{ width: (x.n / mx) * 100 + "%", "--cor": corDoSetor(x.ps[0]) }}></i>
                <s style={{ left: (x.min / mx) * 100 + "%" }}></s>
              </div>
              <b className="num" style={{ textAlign: "right" }}>{x.n}/{x.min}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="sec" id="resumo-time">
        <h2><span>Time ({plano.form})</span><span>titular · reservas</span></h2>
        <div className="card">
          {timeCompleto(plano).map(({ i, vaga, titular, reservas }) => (
            <div className="kv" key={i}>
              <span className="kv-nome">
                <span className="pos" style={{ "--pc": corDoSetor(vaga) }}>{rotuloVaga(vaga)}</span>{titular && <Ovr p={titular} />}
                <span className={titular && compatibilidade(vaga, titular.pos).nivel === "improvisado" ? "neg" : ""}>{titular ? titular.n : "vazio"}</span>
              </span>
              <span className="mute res-lista">{reservas.length ? reservas.map((p) => short(p.n)).join(", ") : "—"}</span>
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
                <span className="kv-nome"><Ovr p={p} /><Pos pos={p.pos} /><span>{p.n}</span></span>
                <span className="num">{mv.type === "emprestimo" ? "empréstimo" : mv.fee ? dinheiro(mv.fee) : "grátis"}</span>
              </div>
            );
          }) : <div className="empty" style={{ padding: 16 }}>Nenhuma contratação.</div>}
        </div>
      </div>

      <div className="sec">
        <h2><span>Saem</span><span>{o.length + vf.length}</span></h2>
        <div className="card">
          {o.length + vf.length ? <>
            {o.map(({ p, x }) => (
              <div className="kv" key={p.id}>
                <span className="kv-nome"><Ovr p={p} /><Pos pos={p.pos} /><span>{p.n}</span></span>
                <span className="num">{x.s === "vende" ? dinheiro(+x.fee || 0) : ROTULO_SAIDA[x.s]}</span>
              </div>
            ))}
            {vf.map(({ p, x }) => (
              <div className="kv" key={p.id}>
                <span className="kv-nome"><Ovr p={p} /><Pos pos={p.pos} /><span>{p.n}</span></span>
                <span className="num">{dinheiro(+x.fee || 0)} <span className="mute">(estava emprestado)</span></span>
              </div>
            ))}
          </> : <div className="empty" style={{ padding: 16 }}>Ninguém saiu.</div>}
        </div>
      </div>

      {/* Empréstimos: só aparecem as listas que têm alguém */}
      <ListaEmprestimo id="voltam" titulo="Voltam de empréstimo" lista={vt} valor={({ p }) => "volta"} />
      <ListaEmprestimo id="devolvidos" titulo="Devolvidos" lista={dv} valor={({ p }) => "ao " + p.emp.de.n} />
      <ListaEmprestimo id="comprados" titulo="Comprados (estavam emprestados)" lista={cp} valor={({ x }) => dinheiro(+x.fee || 0)} />

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
