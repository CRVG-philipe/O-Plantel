// Tela inicial: botões de liga, carrossel do clube e grade de escudos.
import { useRef } from "react";
import { D } from "../logica/dados.js";
import { eur } from "../logica/dinheiro.js";
import { Escudo } from "./Imagens.jsx";

export default function EscolhaClube({ app }) {
  const { liga, indice, clubes, db } = app;
  const c = clubes[indice];
  const valorTotal = c.p.reduce((s, r) => s + r[5], 0);
  const salvo = db.plans[c.k]; // plano já salvo deste clube (se houver)
  const L = D.LG[c.lg];

  // Deslizar o dedo no cartão troca de clube
  const x0 = useRef(null);
  const tocou = (e) => { x0.current = e.touches[0].clientX; };
  const soltou = (e) => {
    if (x0.current === null) return;
    const dx = e.changedTouches[0].clientX - x0.current;
    x0.current = null;
    if (Math.abs(dx) > 40) app.passo(dx < 0 ? 1 : -1);
  };

  return (
    <section id="pick" className="pick">
      <h1>Escolha o clube</h1>
      <p>Escolha a liga, navegue pelas setas ou toque no escudo.</p>
      <div className="chips" id="lgChips">
        {D.LEAGUES.map((l) => (
          <button key={l.k} aria-pressed={l.k === liga} onClick={() => app.escolherLiga(l.k)}>{l.n}</button>
        ))}
      </div>
      <div className="car">
        <button className="arr" id="prev" aria-label="Clube anterior" onClick={() => app.passo(-1)}>‹</button>
        <div className="stage" id="stage" onTouchStart={tocou} onTouchEnd={soltou}>
          <Escudo k={c.k} z={96} />
          <h2>{c.n}</h2>
          <div className="who">{L.n} · Técnico: {c.coach || "–"}</div>
          <div className="nums">
            <div><b>{c.p.length}</b><span>jogadores</span></div>
            <div><b>{eur(valorTotal)}</b><span>valor do elenco</span></div>
            <div>
              <b>{salvo ? "+" + salvo.ins.length + " −" + Object.values(salvo.st).filter((x) => x.s !== "fica").length : "–"}</b>
              <span>{salvo ? "seu plano" : "sem plano"}</span>
            </div>
          </div>
          <button className="btn pri" style={{ width: "100%" }} onClick={() => app.abrirClube(c.k)}>
            {salvo ? "Continuar meu plano" : "Planejar " + L.plan}
          </button>
          <div className="cnt">{indice + 1} de {clubes.length}</div>
        </div>
        <button className="arr" id="next" aria-label="Próximo clube" onClick={() => app.passo(1)}>›</button>
      </div>
      <div className="strip" id="strip">
        {clubes.map((x, i) => (
          <button key={x.k} aria-current={i === indice} aria-label={x.n} onClick={() => app.setIndice(i)}>
            <Escudo k={x.k} z={34} />
          </button>
        ))}
      </div>
    </section>
  );
}
