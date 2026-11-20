// Antes de entrar num plano: tela inicial e escolha em etapas.
//   inicio  → título, números da base, "Seus planos" e "Planejar um clube"
//   pais    → grade de países (tocar avança)
//   divisao → só se o país tiver mais de uma liga (hoje, só o Brasil)
//   clube   → escudo grande, vizinhos, valor e jogadores, "Planejar 2027"/"Planejar 27/28"
// Todas têm fundo colorido com linhas de campo sutis; o conteúdo fica num bloco de até 480px.
import { useRef } from "react";
import { D } from "../logica/dados.js";
import { PAISES } from "../logica/constantes.js";
import { corDeFundo } from "../logica/formato.js";
import { dinheiro, calcularDinheiro } from "../logica/dinheiro.js";
import { saidas } from "../logica/elenco.js";
import { Escudo } from "./Imagens.jsx";
import SeletorMoeda from "./SeletorMoeda.jsx";
import Rodape from "./Rodape.jsx";

export const COR_INICIO = "#0f3d2b";   // verde-escuro da tela inicial
const COR_PAISES = "#1f2a24";          // fundo da grade de países

export default function EscolhaClube({ app }) {
  const { tela, pais, clubes, indice } = app;
  const temDivisao = PAISES[pais].ligas.length > 1;
  // "X de Y": no país ainda não sabemos o país, então contamos o caminho mais longo (3)
  const passo = { pais: [1, 3], divisao: [2, 3], clube: [temDivisao ? 3 : 2, temDivisao ? 3 : 2] }[tela];
  const cor = { inicio: COR_INICIO, pais: COR_PAISES, divisao: PAISES[pais].cor, clube: corDeFundo(clubes[indice]) }[tela];

  return (
    <Moldura cor={cor} app={app} passo={passo}>
      {tela === "inicio" && <TelaInicio app={app} cor={cor} />}
      {tela === "pais" && <EtapaPais app={app} />}
      {tela === "divisao" && <EtapaDivisao app={app} />}
      {tela === "clube" && <EtapaClube app={app} cor={cor} />}
    </Moldura>
  );
}

// Linhas de campo no fundo (branco a 8%): borda, meio, círculo central e as duas áreas
function LinhasDeCampo() {
  return (
    <svg className="campo" viewBox="0 0 300 520" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
        <rect x="16" y="16" width="268" height="488" rx="4" />
        <line x1="16" y1="260" x2="284" y2="260" />
        <circle cx="150" cy="260" r="46" />
        <rect x="80" y="16" width="140" height="72" />
        <rect x="80" y="432" width="140" height="72" />
      </g>
    </svg>
  );
}

// Fundo colorido + topo (logo e moeda) + linha "voltar · X de Y" (nas etapas) + rodapé
export function Moldura({ cor, app, passo, cotacao, children }) {
  return (
    <div className="esc" style={{ backgroundColor: cor }}>
      <LinhasDeCampo />
      <div className="esc-wrap">
        <div className="esc-top">
          <span className="esc-logo"><i></i>Plantel</span>
          {app && <SeletorMoeda app={app} corAtiva={cor} />}
        </div>
        {passo && (
          <div className="esc-passo">
            <button className="esc-round esc-voltar" aria-label="Voltar" onClick={app.voltar}>←</button>
            <span>{passo[0]} de {passo[1]}</span>
          </div>
        )}
        <main className="esc-corpo">{children}</main>
        <Rodape cotacao={app ? app.cotacao : cotacao} />
      </div>
    </div>
  );
}

// Deslizar o dedo para os lados: chama fn(1) (próximo) ou fn(-1) (anterior)
function useDeslizar(fn) {
  const x0 = useRef(null);
  return {
    onTouchStart: (e) => { x0.current = e.touches[0].clientX; },
    onTouchEnd: (e) => {
      if (x0.current === null) return;
      const dx = e.changedTouches[0].clientX - x0.current;
      x0.current = null;
      if (Math.abs(dx) > 40) fn(dx < 0 ? 1 : -1);
    },
  };
}

// ---------- Tela inicial ----------
function TelaInicio({ app, cor }) {
  const { db } = app;
  const comValor = D.ALL.filter((p) => p.v > 0).length;
  // Planos salvos: o último aberto primeiro, depois em ordem alfabética
  const planos = Object.values(db.plans).filter((p) => D.CL[p.club])
    .sort((a, b) => (b.club === db.last) - (a.club === db.last) || D.CL[a.club].n.localeCompare(D.CL[b.club].n));
  return (
    <>
      <h1 className="ini-titulo">Monte o elenco<br />do seu time<br />para 2027</h1>
      <p className="ini-frase">Venda, contrate, escale e veja onde o elenco ainda tem buracos.</p>
      <div className="ini-numeros">
        <div className="esc-card"><b>{D.CLUBS.length}</b><span>clubes em {D.LEAGUES.length} ligas</span></div>
        <div className="esc-card"><b>{comValor.toLocaleString("pt-BR")}</b><span>jogadores com valor</span></div>
      </div>
      {planos.length > 0 && (
        <>
          <p className="ini-rotulo">Seus planos</p>
          <div className="ini-planos">
            {planos.map((p) => {
              const c = D.CL[p.club];
              return (
                <button key={p.club} className="esc-card ini-plano" onClick={() => app.abrirClube(p.club)}>
                  <span className="ini-badge"><Escudo k={p.club} z={28} /></span>
                  <span className="ini-plano-txt">
                    <b>{c.n} {D.LG[c.lg].plan}</b>
                    <span>+{p.ins.length} chegam · −{saidas(p).length} saem · caixa {dinheiro(calcularDinheiro(p).caixa)}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="esc-acao">
        <button className="esc-cta" style={{ color: cor }} onClick={app.planejarClube}>Planejar um clube</button>
      </div>
    </>
  );
}

// ---------- Etapa: país (grade de cartões) ----------
// "Brasileirão Série A · Brasileirão Série B" fica "Série A · Série B" no cartão
const ligasDoPais = (P) => P.ligas.map((k) => (P.ligas.length > 1 ? D.LG[k].n.replace(/^Brasileirão /, "") : D.LG[k].n)).join(" · ");

function EtapaPais({ app }) {
  return (
    <>
      <h1 className="esc-titulo">Escolha o país</h1>
      <div className="esc-paises">
        {PAISES.map((P, i) => (
          <button key={P.sigla} className="esc-pais" onClick={() => app.escolherPais(i)}>
            <span className="esc-flag" style={{ backgroundColor: P.cor }}><img src={`img/flags/${P.bandeira}`} alt="" /></span>
            <span className="esc-pais-nome">{P.n}</span>
            <span className="esc-pais-ligas">{ligasDoPais(P)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Etapa: divisão ----------
function EtapaDivisao({ app }) {
  const P = PAISES[app.pais];
  return (
    <>
      <p className="esc-rotulo">{P.n} · escolha a divisão</p>
      <div className="esc-divisoes">
        {P.ligas.map((k) => (
          <button key={k} className="esc-divisao" onClick={() => app.escolherDivisao(k)}>
            <span><b>{D.LG[k].n}</b><small>{D.CLUBS.filter((c) => c.lg === k).length} clubes</small></span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Etapa: clube ----------
function EtapaClube({ app, cor }) {
  const { clubes, indice, db } = app;
  const n = clubes.length;
  const c = clubes[indice], anterior = clubes[(indice - 1 + n) % n], proximo = clubes[(indice + 1) % n];
  const L = D.LG[c.lg];
  const valorTotal = c.p.reduce((s, r) => s + r[5], 0);
  const salvo = db.plans[c.k]; // já existe plano deste clube?
  const deslizar = useDeslizar(app.passo);
  return (
    <>
      <p className="esc-rotulo">{L.n}</p>
      <div className="esc-clubes" {...deslizar}>
        <span className="esc-vizinho" aria-hidden="true"><Escudo k={anterior.k} z={30} /></span>
        <div className="esc-escudo"><Escudo k={c.k} z={92} /></div>
        <span className="esc-vizinho" aria-hidden="true"><Escudo k={proximo.k} z={30} /></span>
      </div>
      <h1 className="esc-nome">{c.n}</h1>
      <p className="esc-sub">Técnico: {c.coach || "–"}</p>
      <div className="esc-cartoes">
        <div className="esc-cartao"><b>{dinheiro(valorTotal)}</b><span>valor do elenco</span></div>
        <div className="esc-cartao"><b>{c.p.length}</b><span>jogadores</span></div>
      </div>
      <div className="esc-acao esc-acoes">
        <button className="esc-round" aria-label="Clube anterior" onClick={() => app.passo(-1)}>‹</button>
        <button className="esc-cta" style={{ color: cor }} onClick={() => app.abrirClube(c.k)}>
          {salvo ? "Continuar meu plano" : "Planejar " + L.plan}
        </button>
        <button className="esc-round" aria-label="Próximo clube" onClick={() => app.passo(1)}>›</button>
      </div>
    </>
  );
}
