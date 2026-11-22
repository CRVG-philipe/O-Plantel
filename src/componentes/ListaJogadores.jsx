// "Lista de jogadores": todos os jogadores do site, fora de qualquer time.
// Busca (com apelidos), posições, filtros num painel, ordem, páginas de 50 e a ficha do jogador ao tocar.
// Nada aqui depende de um time: sem caixa, sem recomendação, sem "cabe no caixa", sem contratar.
// Os filtros ficam na URL (Plantel.jsx grava), para dar para compartilhar o link.
import { useEffect, useMemo, useRef } from "react";
import { D } from "../logica/dados.js";
import { ctrTxt } from "../logica/formato.js";
import { ORDER, corDoSetor } from "../logica/constantes.js";
import { POR_PAGINA, ORDENS_LISTA, contarFiltrosLista, filtrarLista } from "../logica/lista.js";
import { Avatar, Bandeira, MiniStats, Ovr, Pos, Valor } from "./Jogador.jsx";
import { Rolavel } from "./Mercado.jsx";

export default function ListaJogadores({ app }) {
  const F = app.lista;
  const muda = (campos) => app.setLista({ ...F, ...campos, pag: campos.pag ?? 1 });
  const todos = useMemo(() => filtrarLista(F), [F.q, F.pais, F.liga, F.clube, F.pos.join(), F.idade.join(), F.valor.join(), F.ovr.join(), F.nat, F.fim, F.emp, F.ordem]); // eslint-disable-line
  const paginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const pag = Math.min(F.pag, paginas);
  const pagina = todos.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const nFiltros = contarFiltrosLista(F);
  const topo = useRef();
  const irPag = (p) => { muda({ pag: p }); topo.current?.scrollIntoView?.({ block: "start" }); };
  const alternarPos = (pos) => muda({ pos: F.pos.includes(pos) ? F.pos.filter((x) => x !== pos) : [...F.pos, pos] });
  const onde = [F.clube && D.CL[F.clube]?.n, !F.clube && F.liga && D.LG[F.liga]?.n].filter(Boolean)[0];

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <section className="panel on" id="p-lista">
      <div className="lista-cab" ref={topo}>
        <h1>Lista de jogadores</h1>
        <p className="hint">{D.ALL.length.toLocaleString("pt-BR")} jogadores de {D.LEAGUES.length} ligas. Toque em um para ver a ficha.</p>
      </div>
      <div className="search">
        <label className="inp">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="lq" type="search" placeholder="Buscar jogador ou clube" aria-label="Buscar jogador" value={F.q} onChange={(e) => muda({ q: e.target.value })} />
        </label>
        <button className="fbtn" id="lfOpen" onClick={() => app.abrirPainel("filtrosLista")}>Filtros{nFiltros ? <b>{nFiltros}</b> : null}</button>
      </div>
      <Rolavel id="lpos">
        <button aria-pressed={!F.pos.length} onClick={() => muda({ pos: [] })}>Todas</button>
        {ORDER.map((pos) => (
          <button key={pos} aria-pressed={F.pos.includes(pos)} onClick={() => alternarPos(pos)}>
            <i className="ponto" style={{ background: corDoSetor(pos) }}></i>{pos}
          </button>
        ))}
      </Rolavel>
      <div className="ordem">
        <span id="lcont">{todos.length.toLocaleString("pt-BR")} jogadores{onde ? " · " + onde : ""}</span>
        <label className="ordem-sel">Ordenar:
          <select id="lordem" value={F.ordem} onChange={(e) => muda({ ordem: e.target.value })}>
            {Object.entries(ORDENS_LISTA).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
      </div>
      <div id="lList">
        {pagina.length ? (
          <div className="card">
            {pagina.map((p) => (
              <button className="row" key={p.id} onClick={() => app.abrirPainel("ficha", { id: p.id })}>
                <Avatar p={p} z={46} clube={p.club} /><Ovr p={p} />
                <div className="mid">
                  <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
                  <div className="sub meta"><Pos pos={p.pos} />{p.a} anos<span className="pt"></span>{D.CL[p.club].n}
                    {p.end26 && <><span className="pt"></span><span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
                    {p.emp && <><span className="pt"></span><span className="w">emprestado</span></>}
                  </div>
                  <MiniStats p={p} />
                </div>
                <div className="rt vl"><div className="v num"><Valor p={p} /></div></div>
              </button>
            ))}
          </div>
        ) : <div className="empty">Nenhum jogador encontrado.</div>}
      </div>
      {paginas > 1 && (
        <nav className="paginas" aria-label="Páginas">
          <button className="btn" id="lant" disabled={pag <= 1} onClick={() => irPag(pag - 1)}>‹ Anterior</button>
          <span id="lpag">Página {pag} de {paginas.toLocaleString("pt-BR")}</span>
          <button className="btn" id="lprox" disabled={pag >= paginas} onClick={() => irPag(pag + 1)}>Próxima ›</button>
        </nav>
      )}
    </section>
  );
}
