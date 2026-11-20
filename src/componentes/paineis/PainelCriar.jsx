// Painel "Criar jogador": para alguém que não está nas ligas da base.
import { useRef } from "react";
import { ORDER, POSN } from "../../logica/constantes.js";
import { encaixarNoTime } from "../../logica/escalacao.js";
import { lerCampo, simbolo } from "../../logica/dinheiro.js";
import { Cabecalho, noComputador } from "../Painel.jsx";

export default function PainelCriar({ app }) {
  const nome = useRef(), pos = useRef(), idade = useRef(), valor = useRef();

  const criar = () => {
    const n = nome.current.value.trim();
    if (!n) return nome.current.focus();
    const id = "NOVO" + Date.now();
    const v = lerCampo(valor.current.value, null); // digitado na moeda escolhida, guardado em euro
    const p = { id, n, pos: pos.current.value, a: +idade.current.value || 22, v, nat: "", club: "NOVO", num: "", ctr: "" };
    app.mudar((P) => {
      P.custom.push(p);
      P.ins.push({ id, type: "compra", fee: v });
      encaixarNoTime(P, p);
    });
    app.fecharPainel();
    app.aviso(n + " contratado");
  };

  return (
    <>
      <Cabecalho titulo="Criar jogador" sub="Para alguém de fora das ligas da base" onFechar={app.fecharPainel} />
      <label className="field">Nome<input id="cN" ref={nome} maxLength={40} autoComplete="off" autoFocus={noComputador()} /></label>
      <label className="field">Posição
        <select id="cP" ref={pos}>{ORDER.map((p) => <option key={p} value={p}>{POSN[p]}</option>)}</select>
      </label>
      <div className="acts">
        <label className="field">Idade<input id="cA" ref={idade} type="number" min="15" max="45" defaultValue="22" inputMode="numeric" /></label>
        <label className="field">Valor ({simbolo()} mi)<input id="cV" ref={valor} type="number" min="0" step="0.1" defaultValue="1" inputMode="decimal" /></label>
      </div>
      <button className="btn pri" id="ok" style={{ width: "100%" }} onClick={criar}>Criar e contratar</button>
    </>
  );
}
