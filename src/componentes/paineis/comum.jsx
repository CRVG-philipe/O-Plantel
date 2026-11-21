// Pedaços usados por mais de um painel.
import { D } from "../../logica/dados.js";
import { ctrTxt, dec } from "../../logica/formato.js";
import { valorJogador } from "../../logica/dinheiro.js";
import { classeNota } from "../Jogador.jsx";

// Quatro quadradinhos: idade, país, fim do contrato, valor
export function Fatos({ p }) {
  return (
    <div className="facts">
      <div><b>{p.a}</b><span>anos ({D.LG[p.lg]?.plan || "2027"})</span></div>
      <div><b style={{ fontSize: "12.5px", lineHeight: 1.5 }}>{p.nat || "–"}</b><span>país</span></div>
      <div><b>{ctrTxt(p.ctr)}</b><span>fim do contrato</span></div>
      <div><b>{valorJogador(p.v)}</b><span>valor</span></div>
    </div>
  );
}

// Estatísticas da temporada atual.
// [0,0,0,0] = não entrou em campo: mostra "0 jogos", sem nota e sem médias ("—").
export function Estatisticas({ p }) {
  const s = p.st;
  if (!s) {
    return (
      <div className="stt">
        <div className="sth">Temporada atual · todas as competições<span>Sofascore</span></div>
        <div className="mute" style={{ fontSize: 14 }}>Estatísticas indisponíveis para este jogador.</div>
      </div>
    );
  }
  const [j, g, a, r] = s;
  const media = (x) => (j > 0 ? dec(x / j) : "—");
  const itens = [[j, "Jogos"], [g, "Gols"], [a, "Assistências"], [media(g), "Gols por jogo"], [media(a), "Assist. por jogo"], [j > 0 && r ? <span className={`nota ${classeNota(r)}`}>{dec(r)}</span> : "—", "Nota média"]];
  return (
    <div className="stt">
      <div className="sth">Temporada atual · todas as competições<span>Sofascore · {D.DATA.updated}</span></div>
      <div className="stg">{itens.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
    </div>
  );
}

// Botão de opção (bolinha marcada quando escolhido)
export function Opcao({ marcado, titulo, detalhe, onClick, ...resto }) {
  return (
    <button className="opt" aria-pressed={marcado} onClick={onClick} {...resto}>
      <span className="r"></span>
      <span>{titulo}{detalhe ? <small>{detalhe}</small> : null}</span>
    </button>
  );
}
