// Painéis da "Lista de jogadores":
//   PainelFiltrosLista  país → liga → clube (em cascata), faixas de idade, valor e overall, nacionalidade,
//                       "só com foto" e "emprestados". Só vale ao tocar em "Aplicar".
//   PainelFicha         a ficha do jogador (fatos, overall e atributos, estatísticas, empréstimo), sem nada de time:
//                       o único atalho é "Abrir clube", para planejar o clube dele.
import { useMemo, useState } from "react";
import { D } from "../../logica/dados.js";
import { PAISES, POSN } from "../../logica/constantes.js";
import { ctrTxt } from "../../logica/formato.js";
import { LISTA_PADRAO, VALOR_MAX, nacionalidadesDaLista } from "../../logica/lista.js";
import { Cabecalho } from "../Painel.jsx";
import { Foto } from "../Imagens.jsx";
import { Atributos, Estatisticas, Faixa, Fatos, Opcao, ordenarFaixa } from "./comum.jsx";

const ligasEmOrdem = (P) => [...P.ligas].sort((a, b) => D.LG[a].div - D.LG[b].div);

export function PainelFiltrosLista({ app }) {
  const [t, setT] = useState(() => structuredClone(app.lista));
  // Cascata: trocar o país limpa liga e clube que não são dele; trocar a liga limpa o clube de outra liga
  const muda = (campo, valor) => setT((x) => {
    const n = { ...x, [campo]: valor };
    const P = PAISES.find((p) => p.sigla === n.pais);
    if (campo === "pais" && n.liga && P && !P.ligas.includes(n.liga)) n.liga = "";
    if ((campo === "pais" || campo === "liga") && n.clube) {
      const lg = D.CL[n.clube]?.lg;
      if ((n.liga && lg !== n.liga) || (P && !P.ligas.includes(lg))) n.clube = "";
    }
    return n;
  });
  const P = PAISES.find((p) => p.sigla === t.pais);
  const ligas = P ? ligasEmOrdem(P) : D.LEAGUES.map((l) => l.k);
  const clubes = D.CLUBS.filter((c) => (t.liga ? c.lg === t.liga : P ? P.ligas.includes(c.lg) : true)).sort((a, b) => a.n.localeCompare(b.n));
  const nats = useMemo(() => nacionalidadesDaLista(t), [t.pais, t.liga, t.clube]); // eslint-disable-line
  const aplicar = (f) => {
    app.setLista({ ...f, idade: ordenarFaixa(f.idade), valor: ordenarFaixa(f.valor), ovr: ordenarFaixa(f.ovr), pag: 1 });
    app.fecharPainel();
  };
  // "Limpar" mantém a busca, as posições e a ordem (ficam à vista na tela)
  const limpar = () => aplicar({ ...structuredClone(LISTA_PADRAO), q: app.lista.q, pos: app.lista.pos, ordem: app.lista.ordem });

  return (
    <>
      <Cabecalho titulo="Filtros" onFechar={app.fecharPainel} />
      <label className="field">País
        <select id="lfp" value={t.pais} onChange={(e) => muda("pais", e.target.value)}>
          <option value="">Todos os países</option>
          {PAISES.map((x) => <option key={x.sigla} value={x.sigla}>{x.n}</option>)}
        </select>
      </label>
      <label className="field">Liga
        <select id="lfl" value={t.liga} onChange={(e) => muda("liga", e.target.value)}>
          <option value="">{P ? "Todas as ligas do país" : "Todas as ligas"}</option>
          {ligas.map((k) => <option key={k} value={k}>{D.LG[k].n}</option>)}
        </select>
      </label>
      <label className="field">Clube
        <select id="lfc" value={t.clube} onChange={(e) => muda("clube", e.target.value)}>
          <option value="">Todos os clubes</option>
          {clubes.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
        </select>
      </label>
      <label className="field">Nacionalidade
        <select id="lfn" value={t.nat} onChange={(e) => muda("nat", e.target.value)}>
          <option value="">Todas as nacionalidades</option>
          {t.nat && !nats.some(([n]) => n === t.nat) && <option value={t.nat}>{t.nat} (0)</option>}
          {nats.map(([n, q]) => <option key={n} value={n}>{n} ({q.toLocaleString("pt-BR")})</option>)}
        </select>
      </label>
      <Faixa id="lfa" rotulo="Idade" unidade=" anos" valor={t.idade} onChange={(f) => muda("idade", f)} />
      <Faixa id="lfv" rotulo="Valor (€ milhões)" valor={t.valor} lo={0} hi={VALOR_MAX} onChange={(f) => muda("valor", f)} />
      <Faixa id="lfo" rotulo="Overall" valor={t.ovr} onChange={(f) => muda("ovr", f)} />
      <Opcao marcado={t.foto} titulo="Só com foto" onClick={() => muda("foto", !t.foto)} />
      <Opcao marcado={t.emp} titulo="Emprestados" detalhe="Só quem está emprestado a outro clube." onClick={() => muda("emp", !t.emp)} />
      <div className="acts" style={{ marginTop: 8 }}>
        <button className="btn" id="lclr" onClick={limpar}>Limpar</button>
        <button className="btn pri" id="lok" onClick={() => aplicar(t)}>Aplicar</button>
      </div>
    </>
  );
}

export function PainelFicha({ app, id }) {
  const p = D.BYID[id];
  if (!p) return null;
  const c = D.CL[p.club];
  return (
    <>
      <Cabecalho icone={<Foto p={p} z={56} />} titulo={p.n} sub={POSN[p.pos] + " · " + c.n + " · " + D.LG[c.lg].n} onFechar={app.fecharPainel} />
      <Fatos p={p} />
      {p.emp && (
        <p className="note" id="ficha-emp">
          Emprestado pelo {p.emp.de.n} até {ctrTxt(p.emp.ate)}{p.emp.contrato ? ` · contrato com o ${p.emp.de.n} até ${ctrTxt(p.emp.contrato)}` : ""}.
        </p>
      )}
      <Atributos p={p} />
      <Estatisticas p={p} />
      <button className="btn pri" id="abrir-clube" style={{ width: "100%", marginTop: 8 }} onClick={() => app.abrirClubeNaEscolha(p.club)}>
        Abrir clube · {c.n}
      </button>
    </>
  );
}
