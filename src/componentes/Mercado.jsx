// Aba Mercado: busca, botões de posição, filtros e lista de jogadores de outros clubes.
import { D } from "../logica/dados.js";
import { CHIPS } from "../logica/constantes.js";
import { ctrTxt, statLine } from "../logica/formato.js";
import { dinheiro } from "../logica/dinheiro.js";
import { buscarJogadores, contarFiltros } from "../logica/mercado.js";
import { Foto } from "./Imagens.jsx";

export default function Mercado({ app }) {
  const { plano, busca, chip, limite, filtros } = app;
  const lista = buscarJogadores(plano, busca, chip, filtros);
  const nFiltros = contarFiltros(filtros);
  const criar = () => app.abrirPainel("criar");

  return (
    <section className="panel on" id="p-mercado">
      <div className="search">
        <input id="q" type="search" placeholder="Buscar jogador" aria-label="Buscar jogador" value={busca}
          onChange={(e) => { app.setBusca(e.target.value); app.setLimite(40); }} />
        <button className="fbtn" id="fOpen" onClick={() => app.abrirPainel("filtros")}>Filtros{nFiltros ? <b>{nFiltros}</b> : null}</button>
      </div>
      <div className="chips" id="pos">
        {CHIPS.map(([t], i) => (
          <button key={t} aria-pressed={i === chip} onClick={() => { app.setChip(i); app.setLimite(40); }}>{t}</button>
        ))}
      </div>
      <div id="mList">
        {lista.length ? (
          <>
            <div className="card">
              {lista.slice(0, limite).map((p) => (
                <button className="row" key={p.id} onClick={() => app.abrirJogador(p.id)}>
                  <Foto p={p} z={42} />
                  <div className="mid">
                    <div className="nm">{p.n}</div>
                    <div className="sub">
                      {p.pos} · {p.a} anos · {D.CL[p.club].n}
                      {p.end26 && <> · <span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
                    </div>
                    <div className="sub st">{statLine(p)}</div>
                  </div>
                  <div className="rt"><div className="v num">{dinheiro(p.v)}</div></div>
                  <span className="add" aria-hidden="true">+</span>
                </button>
              ))}
              {lista.length > limite && (
                <button className="more" id="more" onClick={() => app.setLimite(limite + 40)}>Mostrar mais ({lista.length - limite})</button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
              Não achou? <button className="more" id="newP" style={{ width: "auto", padding: 0, minHeight: 0, display: "inline" }} onClick={criar}>Criar jogador</button>
            </p>
          </>
        ) : (
          <div className="empty">
            Nenhum jogador encontrado.<br />
            <button className="more" id="newP" style={{ width: "auto" }} onClick={criar}>Criar jogador</button>
          </div>
        )}
      </div>
    </section>
  );
}
