// Aba Elenco: o elenco do clube por setor, com quem chega no topo de cada seção.
// Mesmo visual do Mercado: anel e selo na cor do setor, bandeira e selo da nota.
import { D } from "../logica/dados.js";
import { SECT, ORDER, corDoSetor } from "../logica/constantes.js";
import { ctrTxt } from "../logica/formato.js";
import { dinheiro } from "../logica/dinheiro.js";
import { elencoOriginal, jogador, situacao } from "../logica/elenco.js";
import { Avatar, Bandeira, Nota, Pos, Valor } from "./Jogador.jsx";

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
            <h2><span><i className="ponto" style={{ background: corDoSetor(ps[0]) }}></i>{titulo}</span><span>{total}</span></h2>
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
  const pill = st.s === "vende" ? <span className="pill out">Vendido {dinheiro(+st.fee || 0)}</span>
    : st.s === "empresta" ? <span className="pill loan">Emprestado</span>
    : st.s === "libera" ? <span className="pill loan">Liberado</span> : null;
  return (
    <button className={"row" + (st.s !== "fica" ? " gone" : "")} onClick={() => app.abrirJogador(p.id)}>
      <Avatar p={p} z={42} />
      <div className="mid">
        <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
        <div className="sub meta">
          <Pos pos={p.pos} />{p.num ? "#" + p.num + " · " : ""}{p.a} anos
          {p.end26 && <><span className="pt"></span><span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
        </div>
      </div>
      <Nota st={p.st} className="so-largo" />
      <div className="rt"><div className="v num"><Valor p={p} /></div>{pill}</div>
    </button>
  );
}

// Jogador contratado (com o mini escudo do clube de onde veio)
function LinhaChegada({ app, m }) {
  const p = jogador(app.plano, m.id);
  return (
    <button className="row" onClick={() => app.abrirJogador(p.id)}>
      <Avatar p={p} z={42} clube={p.club !== "NOVO" ? p.club : null} />
      <div className="mid">
        <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
        <div className="sub meta"><Pos pos={p.pos} />{p.a} anos<span className="pt"></span>{p.club === "NOVO" ? "criado por você" : "veio do " + D.CL[p.club].n}</div>
      </div>
      <Nota st={p.st} className="so-largo" />
      <div className="rt">
        <div className="v num"><Valor p={p} /></div>
        <span className="pill in">Chega · {m.type === "emprestimo" ? "empréstimo" : m.fee ? dinheiro(m.fee) : "grátis"}</span>
      </div>
    </button>
  );
}
