// Pedaços usados por mais de um painel.
import { D } from "../../logica/dados.js";
import { ctrTxt, dec } from "../../logica/formato.js";
import { classeNota, classeOvr, Ovr, Valor } from "../Jogador.jsx";

// Nomes dos 5 atributos, na ordem do overall.json
export const NOMES_ATRIBUTOS = {
  L: ["Ataque", "Técnica", "Tática", "Defesa", "Criatividade"],
  G: ["Defesas", "Antecipação", "Saída de bola", "Jogo aéreo", "Tática"],
};

// Radar (pentágono) pequeno em SVG: cada ponta é um atributo, de 0 (centro) a 100 (borda)
function Radar({ v, nomes }) {
  const R = 38, C = 50;
  const ponto = (i, raio) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [C + raio * Math.cos(ang), C + raio * Math.sin(ang)];
  };
  const forma = (raio) => [0, 1, 2, 3, 4].map((i) => ponto(i, raio).map((x) => x.toFixed(1)).join(",")).join(" ");
  const dados = v.map((x, i) => ponto(i, (R * Math.max(0, Math.min(100, x))) / 100).map((n) => n.toFixed(1)).join(",")).join(" ");
  return (
    <svg className="radar" viewBox="0 0 100 100" role="img" aria-label={"Radar: " + nomes.map((n, i) => `${n} ${v[i]}`).join(", ")}>
      {[1, 0.66, 0.33].map((f) => <polygon key={f} points={forma(R * f)} className="radar-grade" />)}
      {[0, 1, 2, 3, 4].map((i) => { const [x, y] = ponto(i, R); return <line key={i} x1={C} y1={C} x2={x} y2={y} className="radar-grade" />; })}
      <polygon points={dados} className="radar-dados" />
    </svg>
  );
}

// Overall e os 5 atributos (barras + radar). Sem atributos: só o overall e "atributos indisponíveis".
// Sem overall (jogador criado ou fora da base): não aparece.
export function Atributos({ p }) {
  if (p.ovr == null) return null;
  const nomes = p.atr && NOMES_ATRIBUTOS[p.atr.tipo];
  return (
    <div className="atr" id="atributos">
      <div className="sth">Overall e atributos{p.ovrEst && <span>overall estimado</span>}</div>
      <div className="atr-corpo">
        <Ovr p={p} grande />
        {nomes ? (
          <>
            <div className="atr-barras">
              {nomes.map((nome, i) => (
                <div className="atr-linha" key={nome}>
                  <span>{nome}</span>
                  <div className="atr-trilho"><i className={classeOvr(p.atr.v[i])} style={{ width: Math.max(0, Math.min(100, p.atr.v[i])) + "%" }}></i></div>
                  <b className="num">{p.atr.v[i]}</b>
                </div>
              ))}
            </div>
            <Radar v={p.atr.v} nomes={nomes} />
          </>
        ) : <div className="mute atr-sem">atributos indisponíveis</div>}
      </div>
    </div>
  );
}

// Quatro quadradinhos: idade, país, fim do contrato, valor
export function Fatos({ p }) {
  return (
    <div className="facts">
      <div><b>{p.a}</b><span>anos ({D.LG[p.lg]?.plan || "2027"})</span></div>
      <div><b style={{ fontSize: "12.5px", lineHeight: 1.5 }}>{p.nat || "–"}</b><span>país</span></div>
      <div><b>{ctrTxt(p.ctr)}</b><span>fim do contrato</span></div>
      <div><b><Valor p={p} /></b><span>valor</span></div>
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
