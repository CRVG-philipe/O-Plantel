// Aba Elenco: o elenco do clube por setor, com quem chega no topo de cada seção.
import { D } from "../logica/dados.js";
import { SECT, ORDER } from "../logica/constantes.js";
import { ctrTxt } from "../logica/formato.js";
import { eur } from "../logica/dinheiro.js";
import { elencoOriginal, jogador, situacao } from "../logica/elenco.js";
import { Foto } from "./Imagens.jsx";

export default function Elenco({ app }) {
  const { plano } = app;
  const st = (id) => situacao(plano, id).s;
  const proprios = elencoOriginal(plano);
  return (
    <section className="panel on" id="p-elenco">
      <p className="hint">Toque em um jogador para decidir se ele fica, é vendido, emprestado ou liberado.</p>
      {SECT.map(([titulo, ps]) => {
        // Quem fica primeiro, depois quem sai; dentro disso, por posição e valor
        const o = proprios.filter((p) => ps.includes(p.pos)).sort((a, b) => (st(a.id) !== "fica") - (st(b.id) !== "fica") || ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || b.v - a.v);
        const chegam = plano.ins.filter((m) => ps.includes(jogador(plano, m.id).pos));
        const total = o.filter((p) => st(p.id) === "fica").length + chegam.length;
        return (
          <div className="sec" key={titulo}>
            <h2><span>{titulo}</span><span>{total}</span></h2>
            <div className="card">
              {chegam.map((m) => <LinhaChegada key={m.id} app={app} m={m} />)}
              {o.map((p) => <LinhaPropria key={p.id} app={app} p={p} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Jogador do elenco original (com etiqueta se foi vendido/emprestado/liberado)
function LinhaPropria({ app, p }) {
  const st = situacao(app.plano, p.id);
  const pill = st.s === "vende" ? <span className="pill out">Vendido {eur(+st.fee || 0)}</span>
    : st.s === "empresta" ? <span className="pill loan">Emprestado</span>
    : st.s === "libera" ? <span className="pill loan">Liberado</span> : null;
  return (
    <button className={"row" + (st.s !== "fica" ? " gone" : "")} onClick={() => app.abrirJogador(p.id)}>
      <Foto p={p} z={42} />
      <div className="mid">
        <div className="nm">{p.n}</div>
        <div className="sub">
          {p.num ? "#" + p.num + " · " : ""}{p.pos} · {p.a} anos
          {p.end26 && <> · <span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
        </div>
      </div>
      <div className="rt"><div className="v num">{eur(p.v)}</div>{pill}</div>
    </button>
  );
}

// Jogador contratado
function LinhaChegada({ app, m }) {
  const p = jogador(app.plano, m.id);
  return (
    <button className="row" onClick={() => app.abrirJogador(p.id)}>
      <Foto p={p} z={42} />
      <div className="mid">
        <div className="nm">{p.n}</div>
        <div className="sub">{p.pos} · {p.a} anos · {p.club === "NOVO" ? "criado por você" : "veio do " + D.CL[p.club].n}</div>
      </div>
      <div className="rt">
        <div className="v num">{eur(p.v)}</div>
        <span className="pill in">Chega · {m.type === "emprestimo" ? "empréstimo" : m.fee ? eur(m.fee) : "grátis"}</span>
      </div>
    </button>
  );
}
