// Aba Time: formação, campinho com os titulares e lista de reservas.
import { FORMS, FIT, ORDER, POSN, corDoSetor } from "../logica/constantes.js";
import { Avatar, Bandeira, Nota, Pos } from "./Jogador.jsx";
import { short } from "../logica/formato.js";
import { dinheiro } from "../logica/dinheiro.js";
import { elencoAtual, jogador } from "../logica/elenco.js";
import { escalarSozinho } from "../logica/escalacao.js";
import { Foto } from "./Imagens.jsx";

export default function Time({ app }) {
  const { plano } = app;
  const vagas = FORMS[plano.form], sq = elencoAtual(plano);
  const titulares = new Set(Object.values(plano.xi));
  const valorTime = Object.values(plano.xi).reduce((s, id) => s + (jogador(plano, id)?.v || 0), 0);
  const reservas = sq.filter((p) => !titulares.has(p.id)).sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || b.v - a.v);

  const trocarFormacao = (f) => app.mudar((P) => { P.form = f; escalarSozinho(P); });
  const escalar = () => { app.mudar(escalarSozinho); app.aviso("Time escalado pelos mais valiosos"); };

  return (
    <section className="panel on" id="p-time">
      <div className="xhead">
        <select id="form" aria-label="Formação" value={plano.form} onChange={(e) => trocarFormacao(e.target.value)}>
          {Object.keys(FORMS).map((f) => <option key={f}>{f}</option>)}
        </select>
        <button className="btn" id="auto" style={{ minHeight: 40 }} onClick={escalar}>Escalar sozinho</button>
        <div className="xv">Valor do time<b className="num">{dinheiro(valorTime)}</b></div>
      </div>
      <div className="pitch">
        <svg viewBox="0 0 68 92" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth=".4">
            <rect x="3" y="3" width="62" height="86" rx="1.5" />
            <line x1="3" y1="46" x2="65" y2="46" />
            <circle cx="34" cy="46" r="7.5" />
            <rect x="18" y="3" width="32" height="13" />
            <rect x="18" y="76" width="32" height="13" />
          </g>
        </svg>
        {vagas.map(([r, x, y], i) => {
          const p = plano.xi[i] && jogador(plano, plano.xi[i]);
          const foraDePosicao = p && !FIT[r].slice(0, 1).includes(p.pos);
          return (
            <button key={i} className={"slot" + (p ? "" : " empty")} style={{ left: x + "%", top: y + "%", "--pc": corDoSetor(r) }} aria-label={`${POSN[r]}: ${p ? p.n : "vazio"}`}
              onClick={() => app.abrirPainel("posicao", { i })}>
              <span className="dot">{p ? <Foto p={p} z={40} /> : "+"}</span>
              <span className={"lb" + (foraDePosicao ? " w" : "")}>{p ? short(p.n) : r}</span>
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ textAlign: "center" }}>Toque em uma posição para trocar o jogador.</p>
      <details className="bench">
        <summary>Reservas ({reservas.length})</summary>
        <div className="card">
          {reservas.length ? reservas.map((p) => (
            <div className="row" key={p.id} style={{ minHeight: 48 }}>
              <Avatar p={p} z={34} />
              <div className="mid"><div className="nm">{p.n}<Bandeira nat={p.nat} /></div></div>
              <Nota st={p.st} className="so-largo" />
              <div className="rt"><Pos pos={p.pos} /></div>
            </div>
          )) : <div className="empty">Sem reservas.</div>}
        </div>
      </details>
    </section>
  );
}
