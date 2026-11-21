// Painéis de uma vaga do campinho:
//   PainelPosicao  escolher o titular (ou, com reserva = true, um reserva) da vaga;
//   PainelReserva  um reserva já escolhido: promover a titular ou tirar do banco.
// A lista mostra o selo de compatibilidade (ideal/boa/improvisado) e vem ordenada por nível e depois por nota.
import { useState } from "react";
import { FORMS } from "../../logica/constantes.js";
import { compatibilidade, NOME_VAGA, rotuloVaga } from "../../logica/compatibilidade.js";
import { elencoAtual, jogador } from "../../logica/elenco.js";
import { adicionarReserva, promover, removerReserva, reservasDa, todosReservas } from "../../logica/escalacao.js";
import { Cabecalho } from "../Painel.jsx";
import { Avatar, Ovr, Nota, SeloNivel, Valor } from "../Jogador.jsx";

const notaDe = (p) => (p.st && p.st[0] ? p.st[3] || 0 : 0);

export default function PainelPosicao({ app, i, reserva = false }) {
  const { plano } = app;
  const [todos, setTodos] = useState(false); // mostrar também quem está fora da tabela de compatibilidade
  const r = FORMS[plano.form][i][0], atual = plano.xi[i];
  const titulares = new Set(Object.values(plano.xi)), noBanco = new Set(todosReservas(plano));
  const ordem = (p) => compatibilidade(r, p.pos).ordem;
  // Reserva: só quem não é titular nem reserva de outra vaga
  const candidatos = elencoAtual(plano).filter((p) => !reserva || (!titulares.has(p.id) && !noBanco.has(p.id)));
  const completa = candidatos.sort((a, b) => ordem(a) - ordem(b) || notaDe(b) - notaDe(a) || b.v - a.v);
  const lista = todos ? completa : completa.filter((p) => ordem(p) < 4 || p.id === atual);
  const escondidos = completa.length - lista.length;
  const ocupados = reserva ? elencoAtual(plano).length - candidatos.length : 0;

  const escolher = (id) => {
    app.mudar((P) => {
      if (reserva) { adicionarReserva(P, i, id); return; }
      removerReserva(P, id); // quem vira titular sai do banco
      // Se ele já era titular em outra vaga, troca os dois de lugar
      const anterior = Object.keys(P.xi).find((k) => P.xi[k] === id);
      if (anterior !== undefined) { if (atual) P.xi[anterior] = atual; else delete P.xi[anterior]; }
      P.xi[i] = id;
    });
    app.fecharPainel();
  };
  const esvaziar = () => { app.mudar((P) => { delete P.xi[i]; }); app.fecharPainel(); };
  const n = reservasDa(plano, i).length + 1;

  return (
    <>
      <Cabecalho titulo={(reserva ? `${n}º reserva · ` : "") + NOME_VAGA[r]}
        sub={reserva ? `Quem entra se o titular (${atual ? jogador(plano, atual).n : "vaga vazia"}) não puder jogar` : "Escolha quem joga nesta posição"}
        onFechar={app.fecharPainel} />
      <div className="card">
        {lista.map((p) => {
          const titularEmOutra = titulares.has(p.id) && p.id !== atual;
          const c = compatibilidade(r, p.pos);
          return (
            <button className="row" key={p.id} style={{ minHeight: 52 }} onClick={() => escolher(p.id)}>
              <Avatar p={p} z={38} /><Ovr p={p} />
              <div className="mid">
                <div className="nm">{p.n}{p.id === atual && <> <span className="pill in">atual</span></>}</div>
                <div className="sub">
                  {p.pos} · <SeloNivel nivel={c.nivel} />
                  {titularEmOutra ? " · titular em outra posição" : noBanco.has(p.id) ? " · reserva em outra vaga" : ""}
                </div>
              </div>
              <Nota st={p.st} />
              <div className="rt v num"><Valor p={p} /></div>
            </button>
          );
        })}
        {!lista.length && <div className="empty">Ninguém disponível.</div>}
        {escondidos > 0 && <button className="more" id="all" onClick={() => setTodos(true)}>Ver outros {escondidos} jogadores (improvisados)</button>}
      </div>
      {reserva && ocupados > 0 && <p className="note">{ocupados} jogadores não aparecem porque já são titulares ou reservas de outra vaga.</p>}
      {!reserva && atual && <button className="btn danger" id="clear" style={{ width: "100%", marginTop: 10 }} onClick={esvaziar}>Deixar vazio</button>}
    </>
  );
}

// Um reserva já escolhido: promover a titular (troca com o titular) ou tirar do banco
export function PainelReserva({ app, i, id }) {
  const { plano } = app;
  const p = jogador(plano, id), r = FORMS[plano.form][i][0];
  const k = reservasDa(plano, i).indexOf(id) + 1;
  const titular = plano.xi[i] && jogador(plano, plano.xi[i]);
  const c = compatibilidade(r, p.pos);
  const feito = (fn, aviso) => { app.mudar(fn); app.fecharPainel(); if (aviso) app.aviso(aviso); };
  return (
    <>
      <Cabecalho icone={<Avatar p={p} z={48} />} titulo={p.n} sub={`${k}º reserva · ${NOME_VAGA[r]} (${rotuloVaga(r)})`} onFechar={app.fecharPainel} />
      <p className="note">{p.pos} nesta vaga: <SeloNivel nivel={c.nivel} />{titular ? ` · titular: ${titular.n}` : " · a vaga está sem titular"}</p>
      <div className="acts" style={{ marginTop: 8 }}>
        <button className="btn" id="tirar" onClick={() => feito((P) => removerReserva(P, id))}>Tirar do banco</button>
        <button className="btn pri" id="promover" onClick={() => feito((P) => promover(P, i, id), p.n + " promovido a titular")}>Promover a titular</button>
      </div>
    </>
  );
}
