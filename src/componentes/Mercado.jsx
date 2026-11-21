// Aba Mercado: busca (fixa ao rolar), botões de posição, filtros e lista de jogadores de outros clubes.
import { useEffect, useMemo, useRef } from "react";
import { D } from "../logica/dados.js";
import { CHIPS, corDoSetor } from "../logica/constantes.js";
import { ctrTxt } from "../logica/formato.js";
import { dinheiro, calcularDinheiro, precoDeCompra, valorJogador } from "../logica/dinheiro.js";
import { buscarJogadores, contarFiltros } from "../logica/mercado.js";
import { notasDoMercado } from "../logica/recomendacao.js";
import { Avatar, Bandeira, MiniStats, Nota, Pos } from "./Jogador.jsx";

const ORDEM = { rec: "Recomendados", vd: "Valor ↓", va: "Valor ↑", a: "Idade ↑", n: "Nota ↓" };
const N_SELO = 10; // os 10 primeiros da lista em "Recomendados" ganham o selo
export const LEGENDA = [["gol", "Goleiro"], ["def", "Defesa"], ["mei", "Meio"], ["ata", "Ataque"]];

export default function Mercado({ app }) {
  const { plano, busca, chip, limite, filtros } = app;
  // Notas de recomendação: só recalcula quando o plano muda (outro clube, venda, contratação, caixa),
  // e não a cada tecla digitada na busca
  const notas = useMemo(() => notasDoMercado(plano), [plano]);
  const lista = buscarJogadores(plano, busca, chip, filtros, notas);
  // Selo "Recomendado": só na ordem Recomendados e sem texto na busca (aí a lista é a recomendação pura)
  const comSelo = filtros.sort === "rec" && !busca.trim() ? N_SELO : 0;
  const nFiltros = contarFiltros(filtros);
  const caixa = calcularDinheiro(plano).caixa;
  const criar = () => app.abrirPainel("criar");
  const campo = useRef();

  // Atalho: "/" coloca o cursor na busca (se não estiver digitando em outro campo)
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || document.querySelector(".ov.on")) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      campo.current?.focus();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  return (
    <section className="panel on" id="p-mercado">
      <div className="busca-fixa">
        <div className="search">
          <label className="inp">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input id="q" ref={campo} type="search" placeholder="Buscar jogador ou clube" aria-label="Buscar jogador" value={busca}
              onChange={(e) => { app.setBusca(e.target.value); app.setLimite(40); }} />
            <kbd aria-hidden="true">/</kbd>
          </label>
          <button className="fbtn" id="fOpen" onClick={() => app.abrirPainel("filtros")}>Filtros{nFiltros ? <b>{nFiltros}</b> : null}</button>
        </div>
        <div className="chips" id="pos">
          {CHIPS.map(([t, ps], i) => (
            <button key={t} aria-pressed={i === chip} onClick={() => { app.setChip(i); app.setLimite(40); }}>
              {ps && <i className="ponto" style={{ background: corDoSetor(ps[0]) }}></i>}{t}
            </button>
          ))}
        </div>
      </div>
      <div className="ordem"><span>{lista.length.toLocaleString("pt-BR")} jogadores</span><span>Ordenar: <b>{ORDEM[filtros.sort]}</b></span></div>
      <div id="mList">
        {lista.length ? (
          <>
            <div className="card">
              {lista.slice(0, limite).map((p, i) => {
                const preco = precoDeCompra(p), cabe = preco <= caixa;
                return (
                  <button className={"row" + (cabe ? "" : " too")} key={p.id} onClick={() => app.abrirJogador(p.id)}>
                    <Avatar p={p} z={46} clube={p.club} />
                    <div className="mid">
                      <div className="nm">{p.n}<Bandeira nat={p.nat} /></div>
                      <div className="sub meta">
                        <Pos pos={p.pos} />{p.a} anos<span className="pt"></span>{D.CL[p.club].n}
                        {p.end26 && <><span className="pt"></span><span className="w">contrato até {ctrTxt(p.ctr)}</span></>}
                      </div>
                      <MiniStats p={p} comNota />
                    </div>
                    <Nota st={p.st} className="so-largo" />
                    <div className="rt vl">
                      <div className="v num">{valorJogador(p.v)}</div>
                      <div className={"s" + (cabe ? "" : " falta")}>{cabe ? "cabe no caixa" : "faltam " + dinheiro(preco - caixa)}</div>
                      {i < comSelo && <span className="selo-rec" title={`Nota de recomendação: ${notas.get(p.id)} de 100`}>★ Recomendado</span>}
                    </div>
                    <span className="add" aria-hidden="true">+</span>
                  </button>
                );
              })}
              {lista.length > limite && (
                <button className="more" id="more" onClick={() => app.setLimite(limite + 40)}>Mostrar mais ({lista.length - limite})</button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
              Não achou? <button className="more" id="newP" style={{ width: "auto", padding: 0, minHeight: 0, display: "inline" }} onClick={criar}>Criar jogador</button>
            </p>
            <Legenda />
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

// Legenda das cores dos setores
export function Legenda() {
  return (
    <div className="legenda" aria-hidden="true">
      {LEGENDA.map(([s, t]) => <span key={s}><i style={{ background: `var(--${s})` }}></i>{t}</span>)}
    </div>
  );
}
