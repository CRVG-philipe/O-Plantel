// O painel que sobe de baixo (no computador, aparece no meio da tela).
// Toda decisão do app acontece aqui dentro: o conteúdo vem dos arquivos em paineis/.
import { memo } from "react";

export default function Painel({ aberto, onFechar, children }) {
  return (
    // Clicar no fundo escuro (fora do painel) fecha
    <div className={"ov" + (aberto ? " on" : "")} id="ov" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="sheet" id="sheet" role="dialog" aria-modal="true">
        <div className="grab"></div>
        {children}
      </div>
    </div>
  );
}

// Topo do painel: ícone (foto/escudo), título, subtítulo e botão de fechar
export function Cabecalho({ icone, titulo, sub, onFechar }) {
  return (
    <div className="sh">
      {icone}
      <div>
        <h3>{titulo}</h3>
        {sub ? <div className="mute" style={{ fontSize: "13.5px" }}>{sub}</div> : null}
      </div>
      <button className="x" aria-label="Fechar" onClick={onFechar}>✕</button>
    </div>
  );
}

// "Congela" o conteúdo enquanto o painel fecha: ele some com a animação
// mostrando o que estava na tela, sem se atualizar com as mudanças recém-salvas.
export const Congelado = memo(({ children }) => children, (antes, depois) => !depois.vivo);

// No computador, o primeiro campo de texto do painel já vem selecionado (como antes)
export const noComputador = () => matchMedia("(min-width:700px)").matches;
