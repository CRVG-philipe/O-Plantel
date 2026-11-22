// Pedaços usados por mais de um painel.
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { FAIXA_TODA } from "../../logica/constantes.js";
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
      <div className="sth">Overall e atributos</div>
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

// Faixa [mínimo, máximo] em ordem (quem digitou 80 no mínimo e 70 no máximo ganha 70–80)
export const ordenarFaixa = (f = FAIXA_TODA) => (f[0] <= f[1] ? f : [f[1], f[0]]);

// Caixa de número da faixa. Guarda o texto enquanto a pessoa digita (para "80" não virar outra coisa no meio,
// quando ainda está "8"); cada número válido já vale, e ao sair da caixa o texto volta a mostrar o valor certo.
function Numero({ id, rotulo, valor, onChange, lo, hi }) {
  const [txt, setTxt] = useState(String(valor));
  const [focado, setFocado] = useState(false);
  return (
    <input type="number" inputMode="numeric" className="faixa-num" id={id} aria-label={rotulo} min={lo} max={hi}
      value={focado ? txt : String(valor)}
      onFocus={() => { setTxt(String(valor)); setFocado(true); }}
      onBlur={() => setFocado(false)}
      onChange={(e) => {
        setTxt(e.target.value);
        const x = Math.round(+e.target.value);
        if (e.target.value !== "" && x >= lo && x <= hi) onChange(x);
      }} />
  );
}

// Faixa de lo a hi (padrão 0 a 100; ex.: Overall 70–80): duas alças para arrastar e duas caixas para digitar.
// Arrastando, o mínimo nunca passa do máximo; digitando, a faixa é posta em ordem ao aplicar (ordenarFaixa).
export function Faixa({ id, rotulo, unidade = "", valor, onChange, lo = FAIXA_TODA[0], hi = FAIXA_TODA[1] }) {
  const [a, b] = valor || [lo, hi];
  const mudaMin = (x) => onChange([Math.min(+x, b), b]);
  const mudaMax = (x) => onChange([a, Math.max(+x, a)]);
  const pct = (x) => ((x - lo) / (hi - lo)) * 100 + "%";
  const [x, y] = ordenarFaixa([a, b]), ligada = x > lo || y < hi;
  return (
    <div className="field faixa" role="group" aria-labelledby={id + "-t"}>
      <div className="faixa-topo">
        <span id={id + "-t"}>{rotulo}</span>
        <b>{ligada ? `${x}–${y}${unidade}` : "qualquer"}</b>
      </div>
      <div className="faixa-corpo">
        <Numero id={id + "-min"} rotulo={rotulo + " mínimo"} valor={a} lo={lo} hi={hi} onChange={(n) => onChange([n, b])} />
        <div className="faixa-barra" style={{ "--a": pct(x), "--b": pct(y) }}>
          <i className="faixa-trilho" />
          <input type="range" min={lo} max={hi} value={a} aria-label={rotulo + " mínimo (arrastar)"} tabIndex={-1}
            style={{ zIndex: a > hi - 10 ? 3 : 2 }} onChange={(e) => mudaMin(e.target.value)} />
          <input type="range" min={lo} max={hi} value={b} aria-label={rotulo + " máximo (arrastar)"} tabIndex={-1}
            onChange={(e) => mudaMax(e.target.value)} />
        </div>
        <Numero id={id + "-max"} rotulo={rotulo + " máximo"} valor={b} lo={lo} hi={hi} onChange={(n) => onChange([a, n])} />
      </div>
    </div>
  );
}
