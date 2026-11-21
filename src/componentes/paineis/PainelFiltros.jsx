// Painel de filtros do Mercado. As mudanças só valem ao tocar em "Aplicar".
import { useMemo, useState } from "react";
import { D } from "../../logica/dados.js";
import { FAIXA_TODA, FILTROS_PADRAO } from "../../logica/constantes.js";
import { faixaLigada, nacionalidadesDoMercado } from "../../logica/mercado.js";
import { Cabecalho } from "../Painel.jsx";
import { Bandeira } from "../Jogador.jsx";
import { Opcao } from "./comum.jsx";

const ORDENS = [["rec", "Recomendados"], ["vd", "Maior valor"], ["va", "Menor valor"], ["a", "Mais jovens"], ["n", "Melhor nota"], ["o", "Overall"]];

const ordenarFaixa = (f = FAIXA_TODA) => (f[0] <= f[1] ? f : [f[1], f[0]]);

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

// Faixa de 0 a 100 (ex.: Overall 70–80): duas alças para arrastar e duas caixas para digitar.
// Arrastando, o mínimo nunca passa do máximo; digitando, a faixa é posta em ordem ao aplicar (ordenarFaixa).
function Faixa({ id, rotulo, unidade = "", valor, onChange }) {
  const [a, b] = valor || FAIXA_TODA;
  const [lo, hi] = FAIXA_TODA;
  const mudaMin = (x) => onChange([Math.min(+x, b), b]);
  const mudaMax = (x) => onChange([a, Math.max(+x, a)]);
  const pct = (x) => ((x - lo) / (hi - lo)) * 100 + "%";
  const [x, y] = ordenarFaixa([a, b]), ligada = faixaLigada([x, y]);
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

export default function PainelFiltros({ app }) {
  const [t, setT] = useState({ ...app.filtros }); // rascunho dos filtros
  const muda = (campo, valor) => setT((x) => {
    const n = { ...x, [campo]: valor };
    if (n.club && n.lg && D.CL[n.club].lg !== n.lg) n.club = ""; // clube de outra liga não vale
    return n;
  });

  // Clubes que aparecem na lista: só os da liga escolhida (ou todos, separados por liga)
  const clubesDa = (lg) => D.CLUBS.filter((c) => c.lg === lg && c.k !== app.plano.club).sort((a, b) => a.n.localeCompare(b.n));
  const liga = t.lg ? D.LG[t.lg] : null;

  // Nacionalidades de quem está na liga/clube escolhidos, com quantos jogadores tem cada uma
  const nats = useMemo(() => nacionalidadesDoMercado(app.plano, t.lg, t.club), [app.plano, t.lg, t.club]);
  const natFora = t.nat && !nats.some(([n]) => n === t.nat); // a escolhida não existe nessa liga/clube

  // Ao aplicar, cada faixa fica em ordem (quem digitou 80 no mínimo e 70 no máximo ganha 70–80)
  const aplicar = (f) => { app.setFiltros({ ...f, idade: ordenarFaixa(f.idade), ovr: ordenarFaixa(f.ovr) }); app.fecharPainel(); app.setLimite(40); };

  return (
    <>
      <Cabecalho titulo="Filtros" onFechar={app.fecharPainel} />
      <label className="field">Liga
        <select id="fl" value={t.lg} onChange={(e) => muda("lg", e.target.value)}>
          <option value="">Todas as ligas</option>
          {D.LEAGUES.map((l) => <option key={l.k} value={l.k}>{l.n}</option>)}
        </select>
      </label>
      <label className="field">Clube
        <select id="fc" value={t.club} onChange={(e) => muda("club", e.target.value)}>
          <option value="">{liga ? "Todos os clubes da liga" : "Todos os clubes"}</option>
          {liga
            ? clubesDa(liga.k).map((c) => <option key={c.k} value={c.k}>{c.n}</option>)
            : D.LEAGUES.map((l) => (
              <optgroup key={l.k} label={l.n}>
                {clubesDa(l.k).map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
              </optgroup>
            ))}
        </select>
      </label>
      <label className="field">
        <span className="field-tit">Nacionalidade {t.nat ? <Bandeira nat={t.nat} /> : null}</span>
        <select id="fn" value={t.nat} onChange={(e) => muda("nat", e.target.value)}>
          <option value="">Todas as nacionalidades</option>
          {natFora ? <option value={t.nat}>{t.nat} (0)</option> : null}
          {nats.map(([n, q]) => <option key={n} value={n}>{n} ({q.toLocaleString("pt-BR")})</option>)}
        </select>
      </label>
      <Faixa id="fo" rotulo="Overall" valor={t.ovr} onChange={(f) => muda("ovr", f)} />
      <Faixa id="fa" rotulo="Idade" unidade=" anos" valor={t.idade} onChange={(f) => muda("idade", f)} />
      <label className="field">Ordenar por
        <select id="fs" value={t.sort} onChange={(e) => muda("sort", e.target.value)}>
          {ORDENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <Opcao marcado={t.fit} titulo="Só quem cabe no caixa" onClick={() => muda("fit", !t.fit)} />
      <Opcao marcado={t.free} titulo="Contrato acabando" detalhe="Termina antes da próxima temporada: podem chegar sem custo." onClick={() => muda("free", !t.free)} />
      <div className="acts" style={{ marginTop: 8 }}>
        <button className="btn" id="clr" onClick={() => aplicar({ ...FILTROS_PADRAO })}>Limpar</button>
        <button className="btn pri" id="ok" onClick={() => aplicar(t)}>Aplicar</button>
      </div>
    </>
  );
}
