// Botão segmentado € · R$ · US$ (aparece no topo de todas as telas).
// corAtiva: cor do texto do botão escolhido (nas telas coloridas, a cor do fundo).
import { MOEDAS } from "../logica/dinheiro.js";

export default function SeletorMoeda({ app, corAtiva }) {
  return (
    <span className="moeda" role="group" aria-label="Moeda">
      {Object.entries(MOEDAS).map(([m, s]) => (
        <button key={m} aria-pressed={m === app.moeda} onClick={() => app.trocarMoeda(m)}
          style={m === app.moeda && corAtiva ? { color: corAtiva } : undefined}>{s}</button>
      ))}
    </span>
  );
}
