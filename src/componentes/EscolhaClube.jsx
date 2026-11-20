// Tela de escolha em 3 etapas: 1) país  2) divisão (só se o país tiver mais de uma liga)  3) clube.
// A tela inteira ganha a cor do país (etapas 1 e 2) ou do clube (etapa 3).
import { useRef } from "react";
import { D } from "../logica/dados.js";
import { PAISES } from "../logica/constantes.js";
import { corDeFundo } from "../logica/formato.js";
import { eur } from "../logica/dinheiro.js";
import { Escudo } from "./Imagens.jsx";
import Rodape from "./Rodape.jsx";

export default function EscolhaClube({ app }) {
  const { etapa, pais, clubes, indice } = app;
  const P = PAISES[pais];
  const temDivisao = P.ligas.length > 1;
  const total = temDivisao ? 3 : 2;                          // quantas etapas este país tem
  const atual = etapa === 0 ? 1 : etapa === 1 ? 2 : total;   // em qual delas estamos (1, 2 ou 3)
  const cor = etapa < 2 ? P.cor : corDeFundo(clubes[indice]);

  return <Moldura cor={cor} etapa={etapa} atual={atual} total={total} onVoltar={app.voltar}>
    {etapa === 0 && <EtapaPais app={app} cor={cor} />}
    {etapa === 1 && <EtapaDivisao app={app} />}
    {etapa === 2 && <EtapaClube app={app} cor={cor} />}
  </Moldura>;
}

// Fundo colorido, topo (voltar, logo, "X de Y"), pontinhos e rodapé
export function Moldura({ cor, etapa = 0, atual, total, onVoltar, children }) {
  return (
    <div className="esc" style={{ backgroundColor: cor }}>
      <div className="esc-tela">
        <div className="esc-top">
          <button className="esc-round esc-voltar" aria-label="Voltar" onClick={onVoltar} style={{ visibility: etapa ? "visible" : "hidden" }}>←</button>
          <span className="esc-logo"><i></i>Plantel</span>
          <span className="esc-passo">{total ? `${atual} de ${total}` : ""}</span>
        </div>
        <div className="esc-dots" aria-hidden="true">
          {Array.from({ length: total || 0 }, (_, k) => <span key={k} className={k + 1 === atual ? "on" : ""}></span>)}
        </div>
        <main className="esc-corpo">{children}</main>
      </div>
      <Rodape />
    </div>
  );
}

// Deslizar o dedo para os lados: chama fn(1) (próximo) ou fn(-1) (anterior)
function useDeslizar(fn) {
  const x0 = useRef(null);
  return {
    onTouchStart: (e) => { x0.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (x0.current === null) return;
      const dx = e.changedTouches[0].clientX - x0.current;
      x0.current = null;
      if (Math.abs(dx) > 40) fn(dx < 0 ? 1 : -1);
    },
  };
}

// ---------- Etapa 1: país ----------
function EtapaPais({ app, cor }) {
  const P = PAISES[app.pais];
  const deslizar = useDeslizar(app.passoPais);
  return (
    <>
      <p className="esc-rotulo">Escolha o país</p>
      <div className="esc-car" {...deslizar}>
        <button className="esc-round" aria-label="País anterior" onClick={() => app.passoPais(-1)}>‹</button>
        <div className="esc-bandeira"><img src={`img/flags/${P.bandeira}`} alt={`Bandeira: ${P.n}`} /></div>
        <button className="esc-round" aria-label="Próximo país" onClick={() => app.passoPais(1)}>›</button>
      </div>
      <h1 className="esc-nome">{P.n}</h1>
      <p className="esc-sub">{P.ligas.length > 1 ? `${P.ligas.length} divisões` : D.LG[P.ligas[0]].n}</p>
      <div className="esc-siglas">
        {PAISES.map((x, i) => (
          <button key={x.sigla} aria-pressed={i === app.pais} title={x.n} onClick={() => app.setPais(i)}>{x.sigla}</button>
        ))}
      </div>
      <div className="esc-rodape">
        <button className="esc-cta" style={{ color: cor }} onClick={app.continuarPais}>Continuar</button>
      </div>
    </>
  );
}

// ---------- Etapa 2: divisão ----------
function EtapaDivisao({ app }) {
  const P = PAISES[app.pais];
  return (
    <>
      <p className="esc-rotulo">{P.n} · escolha a divisão</p>
      <div className="esc-divisoes">
        {P.ligas.map((k) => (
          <button key={k} className="esc-divisao" onClick={() => app.escolherDivisao(k)}>
            <span><b>{D.LG[k].n}</b><small>{D.CLUBS.filter((c) => c.lg === k).length} clubes</small></span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Etapa 3: clube ----------
function EtapaClube({ app, cor }) {
  const { clubes, indice, db } = app;
  const n = clubes.length;
  const c = clubes[indice], anterior = clubes[(indice - 1 + n) % n], proximo = clubes[(indice + 1) % n];
  const L = D.LG[c.lg];
  const valorTotal = c.p.reduce((s, r) => s + r[5], 0);
  const salvo = db.plans[c.k]; // já existe plano deste clube?
  const deslizar = useDeslizar(app.passo);
  return (
    <>
      <p className="esc-rotulo">{L.n}</p>
      <div className="esc-clubes" {...deslizar}>
        <span className="esc-vizinho" aria-hidden="true"><Escudo k={anterior.k} z={30} /></span>
        <div className="esc-escudo"><Escudo k={c.k} z={92} /></div>
        <span className="esc-vizinho" aria-hidden="true"><Escudo k={proximo.k} z={30} /></span>
      </div>
      <h1 className="esc-nome">{c.n}</h1>
      <p className="esc-sub">Técnico: {c.coach || "–"}</p>
      <div className="esc-cartoes">
        <div className="esc-cartao"><b>{eur(valorTotal)}</b><span>valor do elenco</span></div>
        <div className="esc-cartao"><b>{c.p.length}</b><span>jogadores</span></div>
      </div>
      <div className="esc-rodape esc-acoes">
        <button className="esc-round" aria-label="Clube anterior" onClick={() => app.passo(-1)}>‹</button>
        <button className="esc-cta" style={{ color: cor }} onClick={() => app.abrirClube(c.k)}>
          {salvo ? "Continuar meu plano" : "Planejar " + L.plan}
        </button>
        <button className="esc-round" aria-label="Próximo clube" onClick={() => app.passo(1)}>›</button>
      </div>
    </>
  );
}
