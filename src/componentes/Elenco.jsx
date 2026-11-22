// Aba Elenco: o elenco do clube por setor, com quem chega no topo de cada seção,
// e no fim os jogadores emprestados a outros clubes (que não contam no elenco).
// Mesmo visual do Mercado: anel e selo na cor do setor, bandeira e selo da nota.
import { D } from "../logica/dados.js";
import { SECT, ORDER, corDoSetor } from "../logica/constantes.js";
import { ctrTxt } from "../logica/formato.js";
import { dinheiro } from "../logica/dinheiro.js";
import { elencoOriginal, emprestadosFora, jogador, recebido, situacao, situacaoEmp, voltam } from "../logica/elenco.js";
import { Avatar, Ovr, Bandeira, Nota, Pos, Valor } from "./Jogador.jsx";
import { EstrangeirosNoElenco } from "./Estrangeiros.jsx";

export default function Elenco({ app }) {
  const { plano } = app;
  // Saiu do elenco: vendido, emprestado, liberado ou (recebido por empréstimo) devolvido
  const saiu = (id) => situacao(plano, id).s !== "fica" || situacaoEmp(plano, id).s === "devolver";
  const proprios = elencoOriginal(plano);
  const voltando = voltam(plano);
  const fora = emprestadosFora(plano).filter((o) => situacaoEmp(plano, o.id).s !== "voltar");
  return (
    <section className="panel on" id="p-elenco">
      <p className="hint">Toque em um jogador para decidir se ele fica, é vendido, emprestado ou liberado.</p>
      <div className="card est-card"><EstrangeirosNoElenco plano={plano} /></div>
      {SECT.map(([titulo, ps]) => {
        // Quem fica primeiro, depois quem sai; dentro disso, por posição e valor
        const o = proprios.filter((p) => ps.includes(p.pos)).sort((a, b) => saiu(a.id) - saiu(b.id) || ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || b.v - a.v);
        const chegam = plano.ins.filter((m) => ps.includes(jogador(plano, m.id).pos));
        const voltamAqui = voltando.filter((m) => ps.includes(m.p.pos));
        const total = o.filter((p) => !saiu(p.id)).length + chegam.length + voltamAqui.length;
        return (
          <div className="sec" key={titulo}>
            <h2><span><i className="ponto" style={{ background: corDoSetor(ps[0]) }}></i>{titulo}</span><span>{total}</span></h2>
            <div className="card">
              {chegam.map((m) => <LinhaChegada key={m.id} app={app} m={m} />)}
              {voltamAqui.map((m) => <LinhaEmprestado key={m.p.id} app={app} item={emprestadosFora(plano).find((x) => x.id === m.p.id)} />)}
              {o.map((p) => <LinhaPropria key={p.id} app={app} p={p} />)}
            </div>
          </div>
        );
      })}
      {fora.length > 0 && (
        <div className="sec" id="emprestados">
          <h2><span>Emprestados a outros clubes ({fora.length})</span><span className="mute">não contam no elenco</span></h2>
          <div className="card">
            {fora.map((item) => <LinhaEmprestado key={item.id} app={app} item={item} />)}
          </div>
        </div>
      )}
    </section>
  );
}

// Jogador do elenco original (com etiqueta se foi vendido/emprestado/liberado).
// Se veio emprestado de outro clube: linha "Emprestado · <dono> até <mês/ano>" e etiqueta se foi devolvido ou comprado.
function LinhaPropria({ app, p }) {
  const st = situacao(app.plano, p.id);
  const emp = recebido(app.plano, p) ? situacaoEmp(app.plano, p.id) : null;
  const pill = st.s === "vende" ? <span className="pill out">Vendido {dinheiro(+st.fee || 0)}</span>
    : st.s === "empresta" ? <span className="pill loan">Emprestado</span>
    : st.s === "libera" ? <span className="pill loan">Liberado</span>
    : emp?.s === "devolver" ? <span className="pill loan">Devolvido</span>
    : emp?.s === "comprar" ? <span className="pill in">Comprado {dinheiro(+emp.fee || 0)}</span> : null;
  const saiu = st.s !== "fica" || emp?.s === "devolver";
  return (
    <button className={"row" + (saiu ? " gone" : "")} onClick={() => app.abrirJogador(p.id)}>
      <Avatar p={p} z={42} /><Ovr p={p} />
      <div className="mid">
        <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
        <div className="sub meta">
          <Pos pos={p.pos} />{p.num ? "#" + p.num + " · " : ""}{p.a} anos
          {p.end26 && !emp && <><span className="pt"></span><span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
        </div>
        {emp && emp.s !== "comprar" && <div className="sub emp-linha">Emprestado · {p.emp.de.n} até {ctrTxt(p.emp.ate)}</div>}
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
      <Avatar p={p} z={42} clube={p.club !== "NOVO" ? p.club : null} /><Ovr p={p} />
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

// Jogador emprestado a outro clube: onde está e até quando (ou "Volta de empréstimo" / "Vendido")
function LinhaEmprestado({ app, item }) {
  const { p, para, ate } = item;
  const x = situacaoEmp(app.plano, p.id);
  const pill = x.s === "voltar" ? <span className="pill in">Volta de empréstimo</span>
    : x.s === "vender" ? <span className="pill out">Vendido {dinheiro(+x.fee || 0)}</span> : null;
  return (
    <button className={"row" + (x.s === "vender" ? " gone" : "")} onClick={() => app.abrirJogador(p.id)}>
      <Avatar p={p} z={42} clube={!p.avulso && D.CL[p.club] ? p.club : null} /><Ovr p={p} />
      <div className="mid">
        <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
        <div className="sub meta"><Pos pos={p.pos} />{p.a ? p.a + " anos" : ""}<span className="pt"></span>{x.s === "voltar" ? "voltou do " : "no "}{para.n || "outro clube"}</div>
        {x.s !== "voltar" && <div className="sub emp-linha">Emprestado até {ctrTxt(ate)}</div>}
      </div>
      <Nota st={p.st} className="so-largo" />
      <div className="rt"><div className="v num"><Valor p={p} /></div>{pill}</div>
    </button>
  );
}
