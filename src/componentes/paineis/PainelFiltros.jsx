// Painel de filtros do Mercado. As mudanças só valem ao tocar em "Aplicar".
import { useMemo, useState } from "react";
import { D } from "../../logica/dados.js";
import { FILTROS_PADRAO } from "../../logica/constantes.js";
import { nacionalidadesDoMercado } from "../../logica/mercado.js";
import { Cabecalho } from "../Painel.jsx";
import { Bandeira } from "../Jogador.jsx";
import { Opcao } from "./comum.jsx";

const IDADES = [[99, "Qualquer idade"], [21, "Até 21 anos"], [23, "Até 23 anos"], [26, "Até 26 anos"], [29, "Até 29 anos"]];
const ORDENS = [["rec", "Recomendados"], ["vd", "Maior valor"], ["va", "Menor valor"], ["a", "Mais jovens"], ["n", "Melhor nota"], ["o", "Overall"]];

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

  const aplicar = (f) => { app.setFiltros(f); app.fecharPainel(); app.setLimite(40); };

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
      <label className="field">Idade máxima
        <select id="fa" value={String(t.age)} onChange={(e) => muda("age", +e.target.value)}>
          {IDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
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
