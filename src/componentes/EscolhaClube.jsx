// Antes de entrar num plano: tela inicial e escolha em etapas.
//   inicio  → título, números da base, "Seus planos" e "Planejar um clube"
//   pais    → grade de países (tocar avança)
//   divisao → só se o país tiver mais de uma liga (hoje, só o Brasil)
//   clube   → escudo grande, vizinhos, valor e jogadores, "Planejar 2027"/"Planejar 27/28"
// Todas têm fundo colorido com linhas de campo sutis; o conteúdo fica num bloco de até 480px.
import { useRef, useState } from "react";
import { D } from "../logica/dados.js";
import { CONTINENTES, PAISES } from "../logica/constantes.js";
import { corDeFundo, norm } from "../logica/formato.js";
import { dinheiro, calcularDinheiro } from "../logica/dinheiro.js";
import { saidas } from "../logica/elenco.js";
import { Escudo, LogoLiga } from "./Imagens.jsx";
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
                // Cartão (abre o plano) e, ao lado, a lixeira (pede confirmação antes de excluir)
                <div key={p.club} className="ini-plano-linha">
                  <button className="esc-card ini-plano" onClick={() => app.abrirClube(p.club)}>
                    <span className="ini-badge"><Escudo k={p.club} z={28} /></span>
                    <span className="ini-plano-txt">
                      <b>{c.n} {D.LG[c.lg].plan}</b>
                      <span>+{p.ins.length} chegam · −{saidas(p).length} saem · <span className="sem-quebra">caixa {dinheiro(calcularDinheiro(p).caixa)}</span></span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                  <button className="esc-round ini-excluir" aria-label={`Excluir plano do ${c.n}`} title="Excluir plano"
                    onClick={() => app.abrirPainel("excluirPlano", { k: p.club })}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
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
// Ligas do país em ordem de divisão (1ª, 2ª)
const ligasEmOrdem = (P) => [...P.ligas].sort((a, b) => D.LG[a].div - D.LG[b].div);
// "Brasileirão Série A · Brasileirão Série B" fica "Série A · Série B" no cartão
const ligasDoPais = (P) => ligasEmOrdem(P).map((k) => (P.ligas.length > 1 ? D.LG[k].n.replace(/^Brasileirão /, "") : D.LG[k].n)).join(" · ");

// Grade de países agrupada por continente, com busca por país ou liga no topo
function EtapaPais({ app }) {
  const [busca, setBusca] = useState("");
  const q = norm(busca.trim());
  const visiveis = PAISES.map((P, i) => ({ P, i }))
    .filter(({ P }) => !q || norm(P.n).includes(q) || P.ligas.some((k) => norm(D.LG[k].n).includes(q)));
  return (
    <>
      <h1 className="esc-titulo">Escolha o país</h1>
      <label className="esc-busca">
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input type="search" placeholder="Buscar país ou liga" aria-label="Buscar país" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </label>
      {CONTINENTES.map((ct) => {
        const doContinente = visiveis.filter(({ P }) => P.continente === ct);
        if (!doContinente.length) return null;
        return (
          <section key={ct} className="esc-grupo" aria-label={ct}>
            <h2 className="esc-continente">{ct}</h2>
            <div className="esc-paises">
              {doContinente.map(({ P, i }) => (
                <button key={P.sigla} className="esc-pais" onClick={() => app.escolherPais(i)}>
                  <span className="esc-flag" style={{ backgroundColor: P.cor }}><img src={`img/flags/${P.bandeira}`} alt="" loading="lazy" /></span>
                  <span className="esc-pais-nome">{P.n}</span>
                  <span className="esc-pais-ligas">{ligasDoPais(P)}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {!visiveis.length && <p className="esc-rotulo">Nenhum país ou liga encontrado.</p>}
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
        {ligasEmOrdem(P).map((k) => (
          <button key={k} className="esc-divisao" onClick={() => app.escolherDivisao(k)}>
            <LogoLiga k={k} />
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
  // Animação da troca: lembra o clube anterior e para que lado foi (1 = próximo, -1 = anterior, 0 = acabou de abrir).
  // O escudo novo entra por esse lado, o antigo sai pelo outro, e o texto vem logo atrás.
  const mov = useRef({ i: indice, dir: 0, antes: null });
  if (mov.current.i !== indice) {
    const d = (indice - mov.current.i + n) % n;
    mov.current = { i: indice, dir: d === n - 1 ? -1 : 1, antes: clubes[mov.current.i] };
  }
  const { dir, antes } = mov.current;
  return (
    <div className="esc-etapa-clube" style={{ "--dir": dir, "--dy": dir ? "0px" : "10px" }}>
      <p className="esc-rotulo">{L.n}</p>
      <div className="esc-clubes" {...deslizar}>
        <span className="esc-vizinho" aria-hidden="true"><span key={anterior.k}><Escudo k={anterior.k} z={30} /></span></span>
        {/* key: a cada clube o círculo é desenhado de novo, e as animações recomeçam */}
        <div className="esc-escudo" key={c.k}>
          {antes && <span className="esc-escudo-sai" aria-hidden="true"><Escudo k={antes.k} z={92} /></span>}
          <span className="esc-escudo-entra"><Escudo k={c.k} z={92} /></span>
        </div>
        <span className="esc-vizinho" aria-hidden="true"><span key={proximo.k}><Escudo k={proximo.k} z={30} /></span></span>
      </div>
      <div className="esc-info" key={c.k}>
        <h1 className="esc-nome">{c.n}</h1>
        <p className="esc-sub">Técnico: {c.coach || "–"}</p>
        <div className="esc-cartoes">
          <div className="esc-cartao"><b>{dinheiro(valorTotal)}</b><span>valor do elenco</span></div>
          <div className="esc-cartao"><b>{c.p.length}</b><span>jogadores</span></div>
        </div>
      </div>
      <div className="esc-acao esc-acoes">
        <button className="esc-round" aria-label="Clube anterior" onClick={() => app.passo(-1)}>‹</button>
        <button className="esc-cta" style={{ color: cor }} onClick={() => app.abrirClube(c.k)}>
          {salvo ? "Continuar meu plano" : "Planejar " + L.plan}
        </button>
        <button className="esc-round" aria-label="Próximo clube" onClick={() => app.passo(1)}>›</button>
      </div>
    </div>
  );
}
