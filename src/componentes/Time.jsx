// Aba Time: formação, campinho com os titulares (e até 2 reservas embaixo de cada um),
// reservas agrupados por vaga e o resto do elenco.
import { FORMS, ORDER, corDoSetor } from "../logica/constantes.js";
import { compatibilidade, NOME_VAGA, rotuloVaga } from "../logica/compatibilidade.js";
import { Avatar, Ovr, Bandeira, Nota, Pos, SeloNivel } from "./Jogador.jsx";
import { short } from "../logica/formato.js";
import { dinheiro } from "../logica/dinheiro.js";
import { elencoAtual, jogador } from "../logica/elenco.js";
import { escalarSozinho, forcaDoTime, MAX_RESERVAS, moverReservas, reservasDa, todosReservas } from "../logica/escalacao.js";

// Força com uma casa decimal, com vírgula ("78,4")
export const fmtForca = (m) => m.toFixed(1).replace(".", ",");
import { Foto } from "./Imagens.jsx";

export default function Time({ app }) {
  const { plano } = app;
  const vagas = FORMS[plano.form], sq = elencoAtual(plano);
  const titulares = new Set(Object.values(plano.xi));
  const noBanco = new Set(todosReservas(plano));
  const valorTime = Object.values(plano.xi).reduce((s, id) => s + (jogador(plano, id)?.v || 0), 0);
  const outros = sq.filter((p) => !titulares.has(p.id) && !noBanco.has(p.id)).sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos) || b.v - a.v);
  const comBanco = noBanco.size > 0;
  const forca = forcaDoTime(plano); // média de overall dos titulares

  const trocarFormacao = (f) => app.mudar((P) => { moverReservas(P, P.form, f); P.form = f; escalarSozinho(P); });
  const escalar = () => { app.mudar(escalarSozinho); app.aviso("Time escalado pelos mais valiosos"); };

  return (
    <section className="panel on" id="p-time">
      <div className="xhead">
        <select id="form" aria-label="Formação" value={plano.form} onChange={(e) => trocarFormacao(e.target.value)}>
          {Object.keys(FORMS).map((f) => <option key={f}>{f}</option>)}
        </select>
        <button className="btn" id="auto" style={{ minHeight: 40 }} onClick={escalar}>Escalar sozinho</button>
        <div className="xvs">
          <div className="xv" id="forca" title={forca ? `Média de overall de ${forca.n} titulares` : undefined}>
            Força do time<b className="num">{forca ? fmtForca(forca.media) : "—"}</b>
          </div>
          <div className="xv">Valor do time<b className="num">{dinheiro(valorTime)}</b></div>
        </div>
      </div>
      <div className={"pitch" + (comBanco ? " com-banco" : "")}>
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
          const nv = p ? compatibilidade(r, p.pos).nivel : null;
          const res = reservasDa(plano, i).map((id) => jogador(plano, id)).filter(Boolean);
          return (
            // Com reservas no campo, as vagas sobem um pouco e o goleiro desce, para as pilhas não se encostarem
            <div className="vaga" key={i} style={{ left: x + "%", top: (comBanco ? (r === "GOL" ? 85 : 2 + y * 0.86) : y) + "%" }}>
              <button className={"slot" + (p ? "" : " empty")} style={{ "--pc": corDoSetor(r) }}
                aria-label={`${NOME_VAGA[r]}: ${p ? p.n : "vazio"}${nv === "improvisado" ? " (improvisado)" : ""}`}
                onClick={() => app.abrirPainel("posicao", { i })}>
                <span className="dot">{p ? <Foto p={p} z={40} /> : "+"}</span>
                <span className={"lb" + (nv === "boa" ? " boa" : nv === "improvisado" ? " improvisado" : "")}>{p ? (nv === "improvisado" ? "⚠ " : "") + short(p.n) : rotuloVaga(r)}</span>
              </button>
              {res.length < MAX_RESERVAS && (
                <button className="mini-add" aria-label={`Adicionar reserva de ${NOME_VAGA[r]}`} title="Adicionar reserva" onClick={() => app.abrirPainel("posicao", { i, reserva: true })}>+</button>
              )}
              {res.length > 0 && (
                <div className="mini-banco">
                  {res.map((q, k) => (
                    <button key={q.id} className="mini" aria-label={`${k + 1}º reserva de ${NOME_VAGA[r]}: ${q.n}`} onClick={() => app.abrirPainel("reserva", { i, id: q.id })}>
                      <Foto p={q} z={14} /><span>{short(q.n)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint" style={{ textAlign: "center" }}>Toque em uma posição para trocar o titular, ou no "+" embaixo dela para pôr reservas.</p>

      <div className="sec" id="reservas">
        <h2><span>Reservas</span><span className="num">Banco: {noBanco.size}/{vagas.length * MAX_RESERVAS}</span></h2>
        <div className="card">
          {comBanco ? vagas.map(([r], i) => {
            const res = reservasDa(plano, i);
            if (!res.length) return null;
            const t = plano.xi[i] && jogador(plano, plano.xi[i]);
            return (
              <div className="grupo-res" key={i}>
                <div className="grupo-tit"><b>{NOME_VAGA[r]}</b><span>titular: {t ? t.n : "vazio"}</span></div>
                {res.map((id, k) => {
                  const p = jogador(plano, id);
                  return (
                    <button className="row" key={id} style={{ minHeight: 48 }} onClick={() => app.abrirPainel("reserva", { i, id })}>
                      <Avatar p={p} z={34} /><Ovr p={p} />
                      <div className="mid">
                        <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
                        <div className="sub">{k + 1}º reserva · {p.pos} · <SeloNivel nivel={compatibilidade(r, p.pos).nivel} /></div>
                      </div>
                      <Nota st={p.st} className="so-largo" />
                    </button>
                  );
                })}
              </div>
            );
          }) : <div className="empty">Nenhum reserva ainda. Toque no "+" embaixo de uma posição.</div>}
        </div>
      </div>

      <details className="bench">
        <summary>Fora do time e do banco ({outros.length})</summary>
        <div className="card">
          {outros.length ? outros.map((p) => (
            <div className="row" key={p.id} style={{ minHeight: 48 }}>
              <Avatar p={p} z={34} /><Ovr p={p} />
              <div className="mid"><div className="nm">{p.n}<Bandeira nat={p.nat} /></div></div>
              <Nota st={p.st} className="so-largo" />
              <div className="rt"><Pos pos={p.pos} /></div>
            </div>
          )) : <div className="empty">Todo o elenco está no time ou no banco.</div>}
        </div>
      </details>
    </section>
  );
}
