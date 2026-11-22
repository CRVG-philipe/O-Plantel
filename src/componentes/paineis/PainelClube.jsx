// Menu do clube: trocar de clube ou reiniciar o progresso (pede dois toques).
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { Cabecalho } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelClube({ app }) {
  const k = app.plano.club, c = D.CL[k], n = c.n;
  const [armado, setArmado] = useState(false); // true depois do primeiro toque em "Reiniciar"

  const reiniciar = () => {
    if (!armado) return setArmado(true);
    app.reiniciarClube();
  };

  return (
    <>
      <Cabecalho icone={<Escudo k={k} z={48} />} titulo={n + " " + D.LG[c.lg].plan} sub={c.criado ? "Time criado por você · " + D.LG[c.lg].n : "Técnico: " + c.coach} onFechar={app.fecharPainel} />
      {c.criado && (
        <button className="opt" id="editar-time" onClick={() => app.abrirPainel("time", { k })}>
          <span>Editar time<small>Nome, sigla, cores, escudo, liga e caixa inicial.</small></span>
        </button>
      )}
      <button className="opt" id="swap" onClick={app.trocarClube}>
        <span>Trocar de clube<small>Seu plano do {n} continua salvo.</small></span>
      </button>
      <button className="opt" id="wipe" style={armado ? { boxShadow: "0 0 0 2px var(--neg)" } : undefined} onClick={reiniciar}>
        <span style={{ color: "var(--neg)" }}>
          {armado ? "Toque de novo para apagar tudo" : "Reiniciar todo o progresso do " + n}
          <small>{armado ? "Isso apaga vendas, contratações, escalação e orçamento. Não dá para desfazer."
            : c.criado ? "Esvazia o elenco e volta ao caixa inicial." : "Volta o elenco ao original e pede o orçamento de novo."}</small>
        </span>
      </button>
    </>
  );
}
