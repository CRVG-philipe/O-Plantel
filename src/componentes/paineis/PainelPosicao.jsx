// Painel de uma vaga do campinho: escolher quem joga ali.
import { useState } from "react";
import { FORMS, FIT, POSN } from "../../logica/constantes.js";
import { dinheiro } from "../../logica/dinheiro.js";
import { elencoAtual } from "../../logica/elenco.js";
import { Cabecalho } from "../Painel.jsx";
import { Avatar } from "../Jogador.jsx";

export default function PainelPosicao({ app, i }) {
  const { plano } = app;
  const [todos, setTodos] = useState(false); // mostrar também quem está fora de posição
  const r = FORMS[plano.form][i][0], atual = plano.xi[i];
  // 0 = posição exata, 1+ = adaptado, 9 = fora de posição
  const rank = (p) => { const k = FIT[r].indexOf(p.pos); return k < 0 ? 9 : k; };
  const completa = elencoAtual(plano).sort((a, b) => rank(a) - rank(b) || b.v - a.v);
  const lista = todos ? completa : completa.filter((p) => rank(p) < 9 || p.id === atual);
  const escondidos = completa.length - lista.length;

  const escolher = (id) => {
    app.mudar((P) => {
      // Se ele já era titular em outra vaga, troca os dois de lugar
      const anterior = Object.keys(P.xi).find((k) => P.xi[k] === id);
      if (anterior !== undefined) { if (atual) P.xi[anterior] = atual; else delete P.xi[anterior]; }
      P.xi[i] = id;
    });
    app.fecharPainel();
  };
  const esvaziar = () => { app.mudar((P) => { delete P.xi[i]; }); app.fecharPainel(); };

  return (
    <>
      <Cabecalho titulo={POSN[r]} sub="Escolha quem joga nesta posição" onFechar={app.fecharPainel} />
      <div className="card">
        {lista.map((p) => {
          const titularEmOutra = Object.values(plano.xi).includes(p.id);
          return (
            <button className="row" key={p.id} style={{ minHeight: 52 }} onClick={() => escolher(p.id)}>
              <Avatar p={p} z={38} />
              <div className="mid">
                <div className="nm">{p.n}{p.id === atual && <> <span className="pill in">atual</span></>}</div>
                <div className="sub">
                  {p.pos}
                  {rank(p) > 0 && <> · <span className="w">{rank(p) < 9 ? "adaptado" : "fora de posição"}</span></>}
                  {titularEmOutra && p.id !== atual ? " · titular em outra posição" : ""}
                </div>
              </div>
              <div className="rt v num">{dinheiro(p.v)}</div>
            </button>
          );
        })}
        {escondidos > 0 && <button className="more" id="all" onClick={() => setTodos(true)}>Ver outros {escondidos} jogadores (fora de posição)</button>}
      </div>
      {atual && <button className="btn danger" id="clear" style={{ width: "100%", marginTop: 10 }} onClick={esvaziar}>Deixar vazio</button>}
    </>
  );
}
