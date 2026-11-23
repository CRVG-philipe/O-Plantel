// Menu do clube: os planos do clube (abrir, renomear, novo do zero, duplicar, excluir), trocar de clube ou reiniciar o
// progresso do plano aberto (pede dois toques). Vários planos do mesmo clube: ver logica/planos.js.
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { dinheiro, calcularDinheiro } from "../../logica/dinheiro.js";
import { saidas } from "../../logica/elenco.js";
import { nomeDoPlano, planosDoClube } from "../../logica/planos.js";
import { Cabecalho } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelClube({ app }) {
  const k = app.plano.club, c = D.CL[k], n = c.n;
  const [armado, setArmado] = useState(false); // true depois do primeiro toque em "Reiniciar"
  const id = app.planoId, planos = planosDoClube(app.db, k);
  const [nome, setNome] = useState(app.plano.nome || "");

  const reiniciar = () => {
    if (!armado) return setArmado(true);
    app.reiniciarClube();
  };
  const abrir = (x) => { app.fecharPainel(); if (x !== id) app.abrirPlano(x); };
  const salvarNome = () => { app.renomearPlano(id, nome); app.aviso(nome.trim() ? `Plano renomeado: ${nome.trim()}` : "Nome do plano apagado"); };

  return (
    <>
      <Cabecalho icone={<Escudo k={k} z={48} />} titulo={n + " " + D.LG[c.lg].plan} sub={c.criado ? "Time criado por você · " + D.LG[c.lg].n : "Técnico: " + c.coach} onFechar={app.fecharPainel} />

      <span className="field-tit">Planos do {n}</span>
      <div className="planos-clube" id="planos-clube">
        {planos.map(([x, p]) => (
          <div className="plano-linha" key={x}>
            <button className="opt" aria-pressed={x === id} id={"abrir-plano-" + x} onClick={() => abrir(x)}>
              <span className="r"></span>
              <span>{nomeDoPlano(x, p)}{x === id ? " (aberto)" : ""}<small>+{p.ins.length} chegam · −{saidas(p).length} saem · caixa {dinheiro(calcularDinheiro(p).caixa)}</small></span>
            </button>
            {planos.length > 1 && (
              <button className="esc-round plano-excluir" aria-label={`Excluir ${nomeDoPlano(x, p)}`} title="Excluir plano" onClick={() => app.abrirPainel("excluirPlano", { k: x })}>
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <label className="field plano-nome">Nome do plano aberto
        <span className="plano-nome-l">
          <input id="nome-plano" type="text" maxLength={40} placeholder={nomeDoPlano(id, { })} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvarNome()} />
          <button className="btn" id="salvar-nome-plano" onClick={salvarNome}>Salvar</button>
        </span>
      </label>
      <button className="opt" id="novo-plano" onClick={() => app.novoPlanoDoClube(false)}>
        <span>Novo plano do zero<small>Começa com o elenco original do {n}. Os outros planos continuam salvos.</small></span>
      </button>
      <button className="opt" id="duplicar-plano" onClick={() => app.novoPlanoDoClube(true)}>
        <span>Duplicar este plano<small>Cópia do {nomeDoPlano(id, app.plano)}, para testar outra ideia sem mexer nele.</small></span>
      </button>

      {c.criado && (
        <button className="opt" id="editar-time" onClick={() => app.abrirPainel("time", { k })}>
          <span>Editar time<small>Nome, sigla, cores, escudo, liga e caixa inicial.</small></span>
        </button>
      )}
      <button className="opt" id="swap" onClick={app.trocarClube}>
        <span>Trocar de clube<small>{planos.length > 1 ? `Seus ${planos.length} planos do ${n} continuam salvos.` : `Seu plano do ${n} continua salvo.`}</small></span>
      </button>
      <button className="opt" id="wipe" style={armado ? { boxShadow: "0 0 0 2px var(--neg)" } : undefined} onClick={reiniciar}>
        <span style={{ color: "var(--neg)" }}>
          {armado ? "Toque de novo para apagar tudo" : (planos.length > 1 ? `Reiniciar o ${nomeDoPlano(id, app.plano)}` : "Reiniciar todo o progresso do " + n)}
          <small>{armado ? "Isso apaga vendas, contratações, escalação e orçamento deste plano. Não dá para desfazer."
            : c.criado ? "Esvazia o elenco e volta ao caixa inicial." : "Volta o elenco ao original e pede o orçamento de novo."}</small>
        </span>
      </button>
    </>
  );
}