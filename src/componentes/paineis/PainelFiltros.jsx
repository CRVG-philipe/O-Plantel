// Painel de filtros do Mercado. As mudanças só valem ao tocar em "Aplicar".
import { useState } from "react";
import { D } from "../../logica/dados.js";
import { FILTROS_PADRAO } from "../../logica/constantes.js";
import { Cabecalho } from "../Painel.jsx";
import { Opcao } from "./comum.jsx";

const IDADES = [[99, "Qualquer idade"], [21, "Até 21 anos"], [23, "Até 23 anos"], [26, "Até 26 anos"], [29, "Até 29 anos"]];
const ORDENS = [["rec", "Recomendados"], ["vd", "Maior valor"], ["va", "Menor valor"], ["a", "Mais jovens"], ["n", "Melhor nota"]];

export default function PainelFiltros({ app }) {
  const [t, setT] = useState({ ...app.filtros }); // rascunho dos filtros
  const muda = (campo, valor) => setT((x) => {
    const n = { ...x, [campo]: valor };
    if (n.club && n.lg && D.CL[n.club].lg !== n.lg) n.club = ""; // clube de outra liga não vale
    return n;
  });

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
          <option value="">Todos os clubes</option>
          {D.LEAGUES.map((l) => (
            <optgroup key={l.k} label={l.n}>
              {D.CLUBS.filter((c) => c.lg === l.k && c.k !== app.plano.club && (!t.lg || t.lg === l.k))
                .sort((a, b) => a.n.localeCompare(b.n))
                .map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            </optgroup>
          ))}
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
