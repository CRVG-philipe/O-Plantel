// Página do simulador da temporada (botão "Simular temporada", no topo do plano). Lógica em src/logica/simulacao/;
// o estado fica em "plantel:sim". Versão 1: só a liga, sem copas, lesões ou suspensões; os outros clubes não contratam.
//   Resumo        antes da temporada (previsão, quem chega e quem sai, vagas em aberto), durante (campanha e próximo jogo)
//                 e no fim (campeão, sua campanha, seleção da temporada no campinho, faixas)
//   Tabela        classificação com as faixas e os últimos 5 resultados
//   Jogos         placares de cada rodada; tocar num jogo mostra os gols
//   Estatísticas  artilharia, assistências, melhores notas e os números do seu clube
//   Ao vivo       o seu jogo minuto a minuto (gols, substituições e lances), com velocidade 1x a 8x
import { useEffect, useMemo, useState } from "react";
import { D } from "../logica/dados.js";
import { FORMS, corDoSetor } from "../logica/constantes.js";
import { rotuloVaga } from "../logica/compatibilidade.js";
import { short } from "../logica/formato.js";
import { Escudo, LogoLiga } from "./Imagens.jsx";
import { Avatar, Pos } from "./Jogador.jsx";
import { Cabecalho } from "./Painel.jsx";
import Rodape from "./Rodape.jsx";
import { idPar, opcoesDaPendencia, pares, rotuloLiga, temporadaAtual, vagasDaPendencia, zonasDaLiga } from "../logica/simulacao/composicao.js";
import { escalarClube } from "../logica/simulacao/escalar.js";
import {
  VELOCIDADES, assinaturaDoPlano, calendarioDe, criarEstado, jogadorSim, lerSim, lerVelocidade, linhasEstatisticas, minimoJogos,
  narracao, nomeClube, salvarSim, salvarVelocidade, selecaoDaTemporada, simularAte, tabelaAtual,
} from "../logica/simulacao/temporada.js";

// ---------- Formatos ----------
const pct = (x) => (x <= 0 ? "0%" : x < 1 ? "<1%" : Math.round(x) + "%");
const dec = (x, n = 1) => x.toFixed(n).replace(".", ",");
const sinal = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");
const nomeJog = (plano, id) => { const p = id && jogadorSim(plano, id); return p ? short(p.n) : "—"; };

// Estado salvo do clube, se ainda servir (liga e clubes existem); senão, uma temporada nova
function carregar(plano) {
  const e = lerSim(plano.club);
  const ok = e && D.LG[e.liga] && e.composicao?.clubes?.length && e.composicao.clubes.every((k) => D.CL[k]) && e.composicao.clubes.includes(plano.club);
  if (ok) return e;
  const novo = criarEstado(plano);
  salvarSim(plano.club, novo);
  return novo;
}

const ABAS = [["resumo", "Resumo"], ["tabela", "Tabela"], ["jogos", "Jogos"], ["estat", "Estatísticas"]];

export default function Simulador({ app }) {
  const { plano } = app;
  const k = plano.club;
  const assinatura = assinaturaDoPlano(plano);
  const [estado, setEstado] = useState(() => carregar(plano));
  const [vista, setVista] = useState("resumo");
  const [aoVivo, setAoVivo] = useState(null); // índice da rodada que está sendo assistida (null = fora do jogo ao vivo)
  const cal = useMemo(() => calendarioDe(estado), [estado.semente, estado.composicao]); // eslint-disable-line
  const total = cal.length, fim = estado.rodadaAtual >= total;
  const tabela = useMemo(() => tabelaAtual(estado), [estado]);

  const guardar = (e) => { salvarSim(k, e); setEstado(e); };
  // Refaz antes de começar, com a mesma semente (as vagas e a previsão só mudam pelo que foi mexido)
  const refazer = (mudar = {}) => guardar(criarEstado(plano, { semente: estado.semente, escolhas: estado.escolhas, substitui: estado.substitui, ...mudar }));
  const ir = (v) => { setVista(v); setAoVivo(null); window.scrollTo(0, 0); };
  const simular = (ate) => guardar(simularAte(estado, plano, ate));
  const jogarAoVivo = () => { const r = estado.rodadaAtual; guardar(simularAte(estado, plano, r + 1)); setAoVivo(r); window.scrollTo(0, 0); };
  const reSimular = () => { guardar(criarEstado(plano, { escolhas: estado.escolhas, substitui: estado.substitui })); ir("resumo"); app.aviso("Nova temporada sorteada"); };
  const recomecar = () => { refazer(); ir("resumo"); };
  const continuar = () => guardar({ ...estado, assinatura });
  const opcoes = () => app.abrirPainel("simOpcoes", { atual: estado.rodadaAtual, total, onAte: simular, onResimular: reSimular, onRecomecar: recomecar });

  // Antes da 1ª rodada, se o plano mudou (contratou, vendeu, mexeu no time), a previsão é refeita na hora
  useEffect(() => {
    if (estado.rodadaAtual === 0 && estado.assinatura !== assinatura) refazer();
  }, [assinatura]); // eslint-disable-line

  const mudou = estado.rodadaAtual > 0 && estado.assinatura !== assinatura;
  const pos = tabela.findIndex((l) => l.k === k) + 1;
  // Durante o jogo ao vivo, o topo não mostra a posição (ela já conta o resultado e estragaria a surpresa)
  const status = aoVivo !== null ? `Rodada ${aoVivo + 1} de ${total} · ao vivo`
    : estado.rodadaAtual === 0 ? `Antes da temporada · ${total} rodadas`
    : fim ? `Temporada encerrada · campeão: ${nomeClube(tabela[0].k)}`
      : `Rodada ${estado.rodadaAtual} de ${total} · ${nomeClube(k)} em ${pos}º`;
  const indice = ABAS.findIndex(([v]) => v === vista);

  return (
    <div className="simp" id="simulador">
      <header className="simp-topo">
        <div className="col">
          <div className="simp-barra">
            <button className="simp-voltar" id="sim-voltar" onClick={app.fecharSimulador} aria-label="Voltar ao plano">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              <span>Plano</span>
            </button>
            <LogoLiga k={estado.liga} z={38} />
            <div className="simp-titulo">
              <b id="sim-liga">{rotuloLiga(estado.liga)}</b>
              <span id="sim-status">{status}</span>
            </div>
          </div>
          <div className="simp-prog" aria-hidden="true"><i style={{ width: ((aoVivo !== null ? aoVivo : estado.rodadaAtual) / total) * 100 + "%" }}></i></div>
          {aoVivo === null && (
            <div className="tabs simp-abas" role="tablist" style={{ "--i": indice, "--n": ABAS.length }}>
              <span className="ind" aria-hidden="true"></span>
              {ABAS.map(([v, nome]) => <button key={v} role="tab" id={"sv-" + v} aria-selected={vista === v} onClick={() => ir(v)}>{nome}</button>)}
            </div>
          )}
        </div>
      </header>

      <main className="col simp-main">
        {aoVivo !== null ? (
          <AoVivo key={aoVivo} estado={estado} r={aoVivo} plano={plano} k={k} total={total}
            onSair={(v = "resumo") => ir(v)} onProxima={jogarAoVivo} />
        ) : (
          <>
            {estado.avisos?.map((t) => <p className="sim-aviso" key={t}>{t}</p>)}
            {mudou && (
              <div className="sim-aviso sim-mudou" id="sim-mudou" role="alert">
                <span>Seu elenco mudou — reiniciar a temporada?</span>
                <span className="sim-mudou-bts">
                  <button className="btn pri" id="sim-reiniciar" onClick={recomecar}>Reiniciar</button>
                  <button className="btn" id="sim-continuar" onClick={continuar}>Continuar assim</button>
                </span>
              </div>
            )}
            {vista === "resumo" && (estado.rodadaAtual === 0 ? <Antes estado={estado} k={k} refazer={refazer} app={app} />
              : fim ? <Fim estado={estado} tabela={tabela} k={k} plano={plano} />
                : <Andamento estado={estado} tabela={tabela} k={k} cal={cal} plano={plano} jogarAoVivo={jogarAoVivo} verJogos={() => ir("jogos")} />)}
            {vista === "tabela" && <Tabela estado={estado} tabela={tabela} k={k} />}
            {vista === "jogos" && <Jogos estado={estado} cal={cal} k={k} plano={plano} jogarAoVivo={jogarAoVivo} />}
            {vista === "estat" && <Estatisticas estado={estado} k={k} plano={plano} />}
          </>
        )}
      </main>
      <Rodape cotacao={app.cotacao} />

      {aoVivo === null && (
        <div className="simp-acoes">
          <div className="col simp-acoes-in">
            {!fim ? (
              <>
                <button className="btn simp-mais" id="sim-opcoes" aria-label="Mais opções" title="Mais opções" onClick={opcoes}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                </button>
                <button className="btn" id="sim-fim" onClick={() => simular(total)}>Simular até o fim</button>
                <button className="btn pri" id="sim-aovivo" onClick={jogarAoVivo}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
                  Jogar rodada {estado.rodadaAtual + 1}
                </button>
              </>
            ) : (
              <>
                <button className="btn" onClick={() => ir("tabela")}>Ver tabela</button>
                <button className="btn pri" id="sim-de-novo" onClick={reSimular}>Simular de novo</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Painel "Mais opções" ----------
export function PainelSimOpcoes({ app, atual, total, onAte, onResimular, onRecomecar }) {
  const [n, setN] = useState("");
  const alvo = Math.min(total, Math.max(atual + 1, parseInt(n, 10) || Math.min(total, atual + 5)));
  const fazer = (fn) => { app.fecharPainel(); fn(); };
  return (
    <>
      <Cabecalho titulo="Mais opções" sub={`Rodada ${atual} de ${total}`} onFechar={app.fecharPainel} />
      <button className="opt" id="sim-prox" onClick={() => fazer(() => onAte(atual + 1))}>
        <span className="r"></span><span>Simular só a próxima rodada<small>Sem assistir: o resultado aparece direto.</small></span>
      </button>
      <div className="sim-ate">
        <label htmlFor="sim-ate-n">Simular até a rodada</label>
        <input id="sim-ate-n" className="num" type="number" inputMode="numeric" min={atual + 1} max={total} placeholder={String(Math.min(total, atual + 5))}
          value={n} onChange={(e) => setN(e.target.value)} />
        <button className="btn pri" id="sim-ate" onClick={() => fazer(() => onAte(alvo))}>Simular</button>
      </div>
      <div className="acts" style={{ marginTop: 14 }}>
        <button className="btn" id="sim-recomecar" onClick={() => fazer(onRecomecar)}>Recomeçar</button>
        <button className="btn" id="sim-resimular" onClick={() => fazer(onResimular)}>Re-simular</button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>Recomeçar volta à rodada 0 com o mesmo sorteio. Re-simular sorteia uma temporada nova (vagas em aberto, previsão e jogos).</p>
    </>
  );
}

// ---------- Peças ----------
function Ultimos({ l }) {
  return <span className="sim-ult">{l.ultimos.slice(-5).map((r, j) => <i key={j} className={"r-" + r}>{r}</i>)}</span>;
}
function SeloMov({ x }) {
  if (x.confirmado) return <span className="sim-selo sim-selo-conf">confirmado</span>;
  if (x.projecao) return <span className="sim-selo sim-selo-proj">projeção</span>;
  if (x.escolhido) return <span className="sim-selo sim-selo-escolhido">escolhido</span>;
  return <span className="sim-selo">simulado</span>;
}
const textoMov = (x, entra) => {
  if (!x.para) return "deixa o site";
  if (entra) return (x.tipo === "acesso" ? "subiu da " : "caiu da ") + D.LG[x.de].n;
  return (x.tipo === "acesso" ? "sobe para a " : "cai para a ") + D.LG[x.para].n;
};

// ---------- Resumo: antes da temporada ----------
function Antes({ estado, k, refazer, app }) {
  const { composicao: comp, previsao, liga } = estado;
  const meu = previsao[k];
  const temQueda = Object.values(previsao).some((x) => x.queda > 0), temAcesso = Object.values(previsao).some((x) => x.acesso > 0);
  const ordem = Object.entries(previsao).sort((a, b) => a[1].pos - b[1].pos);
  const pend = Object.entries(estado.pendenciasResolvidas);
  const mudarModo = (par, r, modo) => refazer({ escolhas: { ...estado.escolhas, [idPar(par)]: { modo, sel: modo === "escolher" ? [...r.movem] : [] } } });
  const marcar = (par, x) => {
    const id = idPar(par), esc = estado.escolhas[id] || { modo: "escolher", sel: [] }, vagas = vagasDaPendencia(par);
    let sel = [...(esc.sel || [])];
    if (par.pendentes?.playoffs) {
      const duelo = par.pendentes.playoffs.find((d) => d.includes(x));
      sel = sel.filter((y) => !duelo.includes(y)).concat(x);
    } else if (sel.includes(x)) sel = sel.filter((y) => y !== x);
    else if (sel.length >= vagas) { app.aviso(`Marque no máximo ${vagas}`); return; }
    else sel.push(x);
    refazer({ escolhas: { ...estado.escolhas, [id]: { modo: "escolher", sel } } });
  };
  const Mov = ({ x, entra }) => (
    <div className="sim-mov-linha" key={x.k}>
      <Escudo k={x.k} z={28} />
      <span className="sim-mov-txt"><b className="sim-nome">{nomeClube(x.k)}</b><span className={x.tipo === "acesso" ? "sobe" : "desce"}>{textoMov(x, entra)}</span></span>
      <SeloMov x={x} />
    </div>
  );

  return (
    <>
      {meu && (
        <div className="sim-hero" id="sim-prev-meu">
          <div className="sim-hero-clube"><Escudo k={k} z={40} /><span><b>{nomeClube(k)}</b><small>Previsão para a {rotuloLiga(liga)}</small></span></div>
          <div className="sim-hero-nums">
            <div className="sim-big"><b className="num">{Math.round(meu.pos)}º</b><span>previsão</span></div>
            <div><b className="num">{pct(meu.titulo)}</b><span>chance de título</span></div>
            {temQueda && <div><b className="num desce">{pct(meu.queda)}</b><span>risco de queda</span></div>}
            {temAcesso && <div><b className="num sobe">{pct(meu.acesso)}</b><span>chance de acesso</span></div>}
          </div>
          <p className="sim-hero-nota">Média de 300 temporadas simuladas com o seu elenco e a sua escalação.</p>
        </div>
      )}

      {!!D.CL[k]?.criado && <Substituto estado={estado} k={k} refazer={refazer} />}

      <section className="sec" id="sim-composicao">
        <h2><span>Quem chega e quem sai</span><span>{comp.clubes.length} clubes</span></h2>
        {comp.entram.length || comp.saem.length || comp.substituido ? (
          <div className="sim-mov-grade">
            <div className="card">
              <div className="sim-mov-tit">Chegam <span>{comp.entram.length + (comp.substituido ? 1 : 0)}</span></div>
              {comp.entram.map((x) => <Mov key={x.k} x={x} entra />)}
              {comp.substituido && (
                <div className="sim-mov-linha"><Escudo k={k} z={28} /><span className="sim-mov-txt"><b className="sim-nome">{nomeClube(k)}</b><span>no lugar do {nomeClube(comp.substituido)}</span></span></div>
              )}
            </div>
            <div className="card">
              <div className="sim-mov-tit">Saem <span>{comp.saem.length + (comp.substituido ? 1 : 0)}</span></div>
              {comp.saem.map((x) => <Mov key={x.k} x={x} />)}
              {comp.substituido && (
                <div className="sim-mov-linha"><Escudo k={comp.substituido} z={28} /><span className="sim-mov-txt"><b className="sim-nome">{nomeClube(comp.substituido)}</b><span>dá lugar ao seu time</span></span></div>
              )}
            </div>
          </div>
        ) : <div className="card"><div className="empty" style={{ padding: 16 }}>Mesmos clubes da temporada atual.</div></div>}
      </section>

      {pend.length > 0 && (
        <details className="sim-pends" id="sim-pendencias">
          <summary>
            <span><b>Vagas em aberto</b><small>{pend.length} {pend.length > 1 ? "decisões ainda não definidas" : "decisão ainda não definida"} na vida real · sorteadas com o motor</small></span>
            <span className="sim-pends-acao">Ajustar</span>
          </summary>
          {pend.map(([id, r]) => {
            const par = pares().find((p) => idPar(p) === id);
            return par && <Pendencia key={id} par={par} r={r} esc={estado.escolhas[id]} onModo={(m) => mudarModo(par, r, m)} onMarcar={(x) => marcar(par, x)} />;
          })}
        </details>
      )}

      <section className="sec" id="sim-previsao">
        <h2><span>Previsão da liga</span><span>{temQueda ? "título · queda" : temAcesso ? "título · acesso" : "título"}</span></h2>
        <div className="card">
          {ordem.map(([c, x], i) => (
            <div className={"sim-prev" + (c === k ? " meu" : "")} key={c}>
              <span className="sim-n">{i + 1}</span>
              <Escudo k={c} z={22} />
              <span className="sim-nome">{nomeClube(c)}</span>
              <span className="sim-prev-barra" title={`posição média ${dec(x.pos)}º`}><i style={{ width: Math.max(2, x.titulo) + "%" }}></i></span>
              <span className="num sim-prev-n"><span>{pct(x.titulo)}</span>
                {temQueda && <span className={x.queda >= 50 ? "desce" : "mute"}>{pct(x.queda)}</span>}{temAcesso && <span className={x.acesso >= 50 ? "sobe" : "mute"}>{pct(x.acesso)}</span>}</span>
            </div>
          ))}
        </div>
        <p className="note sim-leg">Ordem pela posição média. A barra é a chance de título.</p>
      </section>
    </>
  );
}

// Time criado do zero: qual clube da liga ele substitui (padrão: o mais fraco)
function Substituto({ estado, k, refazer }) {
  const opcoes = useMemo(() => {
    const lista = [...estado.composicao.clubes.filter((x) => x !== k), estado.composicao.substituido].filter(Boolean);
    return lista.map((x) => ({ x, f: escalarClube(x, estado.liga).forca })).sort((a, b) => a.f - b.f);
  }, [estado.composicao, estado.liga, k]);
  return (
    <label className="field sim-subst" id="sim-subst">Seu time entra no lugar de
      <select id="sim-substitui" value={estado.composicao.substituido || ""} onChange={(e) => refazer({ substitui: e.target.value })}>
        {opcoes.map(({ x, f }, i) => <option key={x} value={x}>{nomeClube(x)} (força {dec(f)}){i === 0 ? " · o mais fraco" : ""}</option>)}
      </select>
    </label>
  );
}

function Pendencia({ par, r, esc, onModo, onMarcar }) {
  const vagas = vagasDaPendencia(par), opcoes = opcoesDaPendencia(par), sel = esc?.sel || [];
  const tipo = par.tipo === "acesso" ? "Acesso" : par.tipo === "sai" ? "Saída" : "Rebaixamento";
  const destino = par.para ? D.LG[par.para].n : "fora do site";
  const sub = par.modo === "projecao" ? `${par.n} vagas · a temporada ${temporadaAtual(par.de)} ainda não acabou${par.aproximado ? " · regra aproximada" : ""}`
    : par.pendentes?.playoffs ? `${vagas} vagas em playoff (ida e volta)` : `${vagas} ${vagas > 1 ? "vagas" : "vaga"} em aberto`;
  return (
    <div className="card sim-pend" id={"pend-" + idPar(par).replace(">", "-")}>
      <div className="sim-pend-cab">
        <b>{tipo}: {D.LG[par.de].n} → {destino}</b>
        {par.modo === "projecao" && <span className="sim-selo sim-selo-proj">projeção</span>}
        <small>{sub}</small>
      </div>
      <div className="seg" role="group" aria-label="Como resolver">
        <button aria-pressed={r.modo === "simular"} onClick={() => r.modo !== "simular" && onModo("simular")}>Simular</button>
        <button aria-pressed={r.modo === "escolher"} onClick={() => r.modo !== "escolher" && onModo("escolher")}>Escolher</button>
      </div>
      {r.modo === "simular" ? (
        <ul className="sim-det">{r.detalhe.map((t) => <li key={t}>{t}</li>)}</ul>
      ) : par.pendentes?.playoffs ? (
        <div className="sim-duelos">
          {par.pendentes.playoffs.map((duelo) => (
            <div className="sim-duelo" key={duelo.join()}>
              {duelo.map((x) => <button key={x} className="sim-op" aria-pressed={sel.includes(x)} onClick={() => onMarcar(x)}><Escudo k={x} z={20} /><span>{nomeClube(x)}</span></button>)}
            </div>
          ))}
        </div>
      ) : (
        <div className="sim-opcoes">
          {opcoes.map((x) => <button key={x} className="sim-op" aria-pressed={sel.includes(x)} onClick={() => onMarcar(x)}><Escudo k={x} z={20} /><span>{nomeClube(x)}</span></button>)}
        </div>
      )}
      {r.modo === "escolher" && (
        <p className="note sim-conta">{par.pendentes?.playoffs ? "Marque o vencedor de cada confronto" : `Marque ${vagas}`}: {Math.min(sel.length, vagas)}/{vagas}
          {r.incompleto && <> · o que falta vem da simulação ({r.movem.filter((x) => !sel.includes(x)).map(nomeClube).join(", ")})</>}</p>
      )}
    </div>
  );
}

// ---------- Resumo: durante a temporada ----------
function Andamento({ estado, tabela, k, cal, plano, jogarAoVivo, verJogos }) {
  const i = tabela.findIndex((l) => l.k === k), l = tabela[i];
  const prox = cal[estado.rodadaAtual]?.find(([c, f]) => c === k || f === k);
  const prev = estado.previsao[k];
  // Último jogo do seu clube
  let ultimo = null;
  for (let r = estado.rodadaAtual - 1; r >= 0 && !ultimo; r--) { const j = estado.resultados[r].find((x) => x[0] === k || x[1] === k); if (j) ultimo = { r, j }; }
  return (
    <div id="sim-andamento">
      <div className="sim-hero sim-campanha">
        <div className="sim-hero-clube"><Escudo k={k} z={40} /><span><b>{nomeClube(k)}</b><small>{l.j} jogos · previsão {prev ? Math.round(prev.pos) + "º" : "—"}</small></span></div>
        <div className="sim-hero-nums sim-n4">
          <div className="sim-big"><b className="num">{i + 1}º</b><span>lugar</span></div>
          <div><b className="num">{l.pts}</b><span>pontos</span></div>
          <div><b className="num">{l.v}-{l.e}-{l.d}</b><span>V-E-D</span></div>
          <div><b className="num">{sinal(l.gp - l.gc)}</b><span>saldo</span></div>
        </div>
        <div className="sim-hero-ult"><span>Últimos jogos</span><Ultimos l={l} /></div>
      </div>

      <div className="sim-jogos-par">
        {prox ? (
          <div className="card sim-prox" id="sim-prox-jogo">
            <span className="sim-rot">Próximo jogo · rodada {estado.rodadaAtual + 1}</span>
            <div className="sim-confronto"><span><Escudo k={prox[0]} z={30} /><b className="sim-nome">{nomeClube(prox[0])}</b></span><i>×</i><span><Escudo k={prox[1]} z={30} /><b className="sim-nome">{nomeClube(prox[1])}</b></span></div>
            <button className="btn pri" onClick={jogarAoVivo}>Assistir ao vivo</button>
          </div>
        ) : <div className="card sim-prox"><span className="sim-rot">Rodada {estado.rodadaAtual + 1}</span><p className="mute" style={{ margin: 0 }}>Seu clube folga nesta rodada.</p></div>}
        {ultimo && (
          <button className="card sim-prox sim-ultimo" onClick={verJogos}>
            <span className="sim-rot">Último jogo · rodada {ultimo.r + 1}</span>
            <div className="sim-confronto"><span><Escudo k={ultimo.j[0]} z={30} /><b className="sim-nome">{nomeClube(ultimo.j[0])}</b></span><i className="num">{ultimo.j[2]} × {ultimo.j[3]}</i><span><Escudo k={ultimo.j[1]} z={30} /><b className="sim-nome">{nomeClube(ultimo.j[1])}</b></span></div>
            <span className="mute sim-autores">{ultimo.j[4].filter((e) => (e[1] === 0 ? ultimo.j[0] : ultimo.j[1]) === k).map((e) => nomeJog(plano, e[2])).join(", ") || "sem gols do seu clube"}</span>
          </button>
        )}
      </div>

      <section className="sec">
        <h2><span>Classificação</span><span>pontos</span></h2>
        <TabelaCurta tabela={tabela} k={k} zonas={zonasDaLiga(estado.liga, tabela.length)} />
      </section>
    </div>
  );
}

// Os 5 primeiros e a vizinhança do seu clube
function TabelaCurta({ tabela, k, zonas }) {
  const i = tabela.findIndex((l) => l.k === k);
  const mostra = [...new Set([0, 1, 2, 3, 4, i - 1, i, i + 1].filter((x) => x >= 0 && x < tabela.length))].sort((a, b) => a - b);
  return (
    <div className="card">
      {mostra.map((j, n) => (
        <div className={"sim-linha" + (tabela[j].k === k ? " meu" : "") + (n > 0 && j - mostra[n - 1] > 1 ? " sim-salto" : "")} key={tabela[j].k}>
          <span className="sim-n" style={{ "--z": zonas[j]?.cor || "transparent" }}>{j + 1}</span>
          <Escudo k={tabela[j].k} z={22} />
          <span className="sim-nome">{nomeClube(tabela[j].k)}</span>
          <b className="num">{tabela[j].pts}</b>
        </div>
      ))}
    </div>
  );
}

// ---------- Resumo: fim da temporada ----------
function Fim({ estado, tabela, k, plano }) {
  const zonas = zonasDaLiga(estado.liga, tabela.length);
  const campeao = tabela[0];
  const faixas = [];
  zonas.forEach((z, i) => {
    if (!z) return;
    let f = faixas.find((x) => x.nome === z.nome);
    if (!f) faixas.push((f = { ...z, clubes: [] }));
    f.clubes.push({ k: tabela[i].k, pos: i + 1 });
  });
  const selecao = selecaoDaTemporada(estado, plano);
  const i = tabela.findIndex((l) => l.k === k), prev = estado.previsao[k];
  const esperado = prev ? Math.round(prev.pos) : null, dif = esperado ? esperado - (i + 1) : 0;
  return (
    <div id="sim-fim-temporada">
      <div className="sim-campeao" id="sim-campeao">
        <span className="sim-taca" aria-hidden="true">🏆</span>
        <Escudo k={campeao.k} z={64} />
        <small>Campeão da {rotuloLiga(estado.liga)}</small>
        <b>{nomeClube(campeao.k)}</b>
        <span className="num">{campeao.pts} pontos · {campeao.v} vitórias · saldo {sinal(campeao.gp - campeao.gc)}</span>
      </div>

      {prev && (
        <section className="sec" id="sim-prev-res">
          <h2><span>Sua campanha</span><span>{nomeClube(k)}</span></h2>
          <div className="card sim-campanha-fim">
            <div><span>Previsão</span><b className="num">{dec(prev.pos)}º</b></div>
            <i aria-hidden="true">→</i>
            <div><span>Resultado</span><b className="num">{i + 1}º</b></div>
            <div className="sim-campanha-dif"><span className={dif > 0 ? "sobe" : dif < 0 ? "desce" : "mute"}>{dif > 0 ? "Acima do esperado" : dif < 0 ? "Abaixo do esperado" : "Dentro do esperado"}</span>
              <small className="num">{tabela[i].pts} pontos · {sinal(dif)} {Math.abs(dif) === 1 ? "posição" : "posições"}</small></div>
          </div>
        </section>
      )}

      <section className="sec" id="sim-selecao">
        <h2><span>Seleção da temporada</span><span>4-3-3 · melhores notas</span></h2>
        <div className="sim-campo">
          {selecao.map(({ vaga, x }, j) => {
            const [, left, top] = FORMS["4-3-3"][j];
            return (
              <div className="sim-campo-jog" key={j} style={{ left: left + "%", top: top + "%" }}>
                {x ? <Avatar p={x.p} z={38} clube={x.k} /> : <span className="sim-campo-vazio">{rotuloVaga(vaga)}</span>}
                <span className="sim-campo-nome">{x ? short(x.p.n) : "—"}</span>
                {x && <span className="sim-campo-nota num">{dec(x.nota, 2)}</span>}
              </div>
            );
          })}
        </div>
        <div className="card sim-selecao-lista">
          {selecao.map(({ vaga, x }, j) => (
            <div className="kv" key={j}>
              <span className="kv-nome">
                <span className="pos" style={{ "--pc": corDoSetor(vaga) }}>{rotuloVaga(vaga)}</span>
                {x ? <><Escudo k={x.k} z={20} /><span className="sim-nome">{x.p.n}</span></> : <span className="mute">—</span>}
              </span>
              {x && <span className="num">{dec(x.nota, 2)} <span className="mute">· {x.j} jogos</span></span>}
            </div>
          ))}
        </div>
      </section>

      {faixas.map((f) => (
        <section className="sec sim-faixa" key={f.nome}>
          <h2><span><i className="ponto" style={{ background: f.cor }}></i>{f.nome}</span><span>{f.clubes.length}</span></h2>
          <div className="card sim-faixa-clubes">
            {f.clubes.map((c) => (
              <span className={"sim-faixa-clube" + (c.k === k ? " meu" : "")} key={c.k}><span className="sim-n">{c.pos}</span><Escudo k={c.k} z={22} /><span className="sim-nome">{nomeClube(c.k)}</span></span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- Tabela ----------
function Tabela({ estado, tabela, k }) {
  const zonas = zonasDaLiga(estado.liga, tabela.length);
  const legenda = [];
  zonas.forEach((z) => { if (z && !legenda.some((x) => x.nome === z.nome)) legenda.push(z); });
  return (
    <>
      <div className="card sim-tab-wrap">
        <table className="sim-tabela" id="sim-tabela">
          <thead><tr><th>#</th><th className="cl">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th className="ult">Últimos 5</th></tr></thead>
          <tbody>
            {tabela.map((l, i) => (
              <tr key={l.k} className={l.k === k ? "meu" : ""}>
                <td className="zp" style={{ "--z": zonas[i]?.cor || "transparent" }} title={zonas[i]?.nome}>{i + 1}</td>
                <td className="cl"><span><Escudo k={l.k} z={20} /><span className="sim-nome">{nomeClube(l.k)}</span></span></td>
                <td><b>{l.pts}</b></td><td>{l.j}</td><td>{l.v}</td><td>{l.e}</td><td>{l.d}</td><td>{sinal(l.gp - l.gc)}</td>
                <td className="ult"><Ultimos l={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legenda.length > 0 && <div className="sim-legenda" id="sim-legenda">{legenda.map((z) => <span key={z.nome}><i style={{ background: z.cor }}></i>{z.nome}</span>)}</div>}
    </>
  );
}

// ---------- Jogos (rodada a rodada) ----------
function Jogos({ estado, cal, k, plano, jogarAoVivo }) {
  const [r, setR] = useState(() => Math.max(0, Math.min(cal.length - 1, estado.rodadaAtual - 1)));
  const [aberto, setAberto] = useState(null);
  const jogada = r < estado.rodadaAtual;
  const jogos = jogada ? estado.resultados[r] : cal[r].map(([c, f]) => [c, f, null, null, []]);
  const ordenados = [...jogos].sort((a, b) => (b[0] === k || b[1] === k) - (a[0] === k || a[1] === k));
  const mudar = (n) => { setR(n); setAberto(null); };
  return (
    <div id="sim-rodadas">
      <div className="sim-nav">
        <button className="btn" id="rod-ant" aria-label="Rodada anterior" disabled={r === 0} onClick={() => mudar(r - 1)}>‹</button>
        <div><b id="rod-n">Rodada {r + 1} de {cal.length}</b><span className="mute">{jogada ? "encerrada" : r === estado.rodadaAtual ? "próxima" : "a jogar"}</span></div>
        <button className="btn" id="rod-prox" aria-label="Próxima rodada" disabled={r >= cal.length - 1} onClick={() => mudar(r + 1)}>›</button>
      </div>
      {r === estado.rodadaAtual && <button className="btn pri sim-jogar-rodada" onClick={jogarAoVivo}>Jogar esta rodada ao vivo</button>}
      {!ordenados.some((j) => j[0] === k || j[1] === k) && <p className="note">Seu clube folga nesta rodada.</p>}
      <div className="card">
        {ordenados.map((j) => {
          const [c, f, gc, gf, ev] = j, meu = c === k || f === k, id = c + f, ab = aberto === id || (meu && jogada && aberto === null);
          return (
            <div className={"sim-jogo" + (meu ? " meu" : "")} key={id} id={meu ? "sim-jogo-meu" : undefined}>
              <button className="sim-jogo-linha" disabled={!jogada || !ev.length} aria-expanded={jogada ? ab : undefined} onClick={() => setAberto(ab ? "" : id)}>
                <span className="c"><span className="sim-nome">{nomeClube(c)}</span><Escudo k={c} z={22} /></span>
                <b className="num sim-placar-n">{jogada ? `${gc} × ${gf}` : "×"}</b>
                <span className="f"><Escudo k={f} z={22} /><span className="sim-nome">{nomeClube(f)}</span></span>
              </button>
              {ab && ev.length > 0 && (
                <div className="sim-gols">
                  <ul>{ev.filter((e) => e[1] === 0).map((e, n) => <li key={n}><span className="num mute">{e[0]}'</span> {nomeJog(plano, e[2])}{e[3] && <span className="mute"> ({nomeJog(plano, e[3])})</span>}</li>)}</ul>
                  <ul>{ev.filter((e) => e[1] === 1).map((e, n) => <li key={n}>{nomeJog(plano, e[2])}{e[3] && <span className="mute"> ({nomeJog(plano, e[3])})</span>} <span className="num mute">{e[0]}'</span></li>)}</ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Estatísticas ----------
function Estatisticas({ estado, k, plano }) {
  const [parte, setParte] = useState("art");
  const linhas = useMemo(() => linhasEstatisticas(estado, plano), [estado, plano]);
  if (!estado.rodadaAtual) return <div className="card"><div className="empty">Simule pelo menos uma rodada para ver as estatísticas.</div></div>;
  const min = minimoJogos(estado);
  const listas = {
    art: { titulo: "Artilharia", l: linhas.filter((x) => x.g > 0).sort((a, b) => b.g - a.g || a.j - b.j).slice(0, 15), v: (x) => x.g, un: "gols" },
    ass: { titulo: "Assistências", l: linhas.filter((x) => x.a > 0).sort((a, b) => b.a - a.a || a.j - b.j).slice(0, 15), v: (x) => x.a, un: "assist." },
    nota: { titulo: "Melhores notas", l: linhas.filter((x) => x.j >= min).sort((a, b) => b.nota - a.nota).slice(0, 15), v: (x) => dec(x.nota, 2), un: "nota" },
  };
  const meus = linhas.filter((x) => x.k === k).sort((a, b) => b.j - a.j || b.nota - a.nota);
  const PARTES = [["art", "Artilharia"], ["ass", "Assistências"], ["nota", "Notas"], ["meu", nomeClube(k)]];
  return (
    <>
      <div className="seg sim-partes" role="group" aria-label="Estatísticas">
        {PARTES.map(([p, nome]) => <button key={p} id={"se-" + p} aria-pressed={parte === p} onClick={() => setParte(p)}>{nome}</button>)}
      </div>
      {parte !== "meu" ? (
        <section className="sec" id={{ art: "sim-artilharia", ass: "sim-assist", nota: "sim-notas" }[parte]}>
          <h2><span>{listas[parte].titulo}</span>{parte === "nota" && <span>mínimo de {min} {min > 1 ? "jogos" : "jogo"}</span>}</h2>
          <div className="card">
            {listas[parte].l.length ? listas[parte].l.map((x, i) => (
              <div className={"sim-jog" + (x.k === k ? " meu" : "") + (i < 3 ? " sim-jog-podio" : "")} key={x.id}>
                <span className="sim-n">{i + 1}</span>
                <Avatar p={x.p} z={38} clube={x.k} />
                <span className="sim-jog-txt"><b className="sim-nome">{x.p.n}</b><span className="mute sim-nome">{nomeClube(x.k)} · {x.j} jogos</span></span>
                <span className="sim-jog-v"><b className="num">{listas[parte].v(x)}</b><small>{listas[parte].un}</small></span>
              </div>
            )) : <div className="empty" style={{ padding: 16 }}>Ninguém ainda.</div>}
          </div>
        </section>
      ) : (
        <section className="sec" id="sim-meu-clube">
          <h2><span>{nomeClube(k)}</span><span>J · G · A · nota</span></h2>
          <div className="card">
            {meus.map((x) => (
              <div className="sim-jog" key={x.id}>
                <Avatar p={x.p} z={34} />
                <span className="sim-jog-txt"><b className="sim-nome">{x.p.n}</b><span className="mute"><Pos pos={x.p.pos} /></span></span>
                <span className="num sim-st"><span>{x.j}</span><span>{x.g}</span><span>{x.a}</span><b>{dec(x.nota, 2)}</b></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---------- Ao vivo ----------
// O jogo já foi simulado (o resultado está salvo); aqui ele é mostrado minuto a minuto.
const COMO = {
  fora: (n) => `${n} finaliza, mas a bola vai para fora.`,
  defesa: (n) => `${n} chuta e o goleiro faz a defesa.`,
  trave: (n) => `Na trave! ${n} quase marca.`,
};
function AoVivo({ estado, r, plano, k, total, onSair, onProxima }) {
  const jogos = estado.resultados[r] || [];
  const i = jogos.findIndex((j) => j[0] === k || j[1] === k);
  const meu = i >= 0 ? jogos[i] : null;
  const lances = useMemo(() => (i >= 0 ? narracao(estado, plano, r, i) : []), [r]); // eslint-disable-line
  const [min, setMin] = useState(0);
  const [vel, setVel] = useState(lerVelocidade);
  const [pausa, setPausa] = useState(false);
  const acabou = min >= 90;
  // Relógio: 1 minuto a cada VELOCIDADES[vel] ms; uma pausa mais longa no intervalo
  useEffect(() => {
    if (pausa || acabou) return;
    const t = setTimeout(() => setMin((m) => Math.min(90, m + 1)), VELOCIDADES[vel] * (min === 45 ? 4 : 1));
    return () => clearTimeout(t);
  }, [min, pausa, vel, acabou]);
  const mudarVel = (v) => { setVel(v); salvarVelocidade(v); };
  const placar = (j) => [j[4].filter((e) => e[1] === 0 && e[0] <= min).length, j[4].filter((e) => e[1] === 1 && e[0] <= min).length];
  const nomeLado = (lado) => nomeClube(meu[lado]);
  // Lances até o minuto atual (o mais novo em cima), com o início e o intervalo no meio
  const feed = [{ min: 0, tipo: "marco", txt: "Começa o jogo!" }, ...lances, { min: 45, tipo: "marco", txt: "Intervalo.", fimDoMinuto: true }]
    .map((x, n) => ({ ...x, n }))
    .sort((p, q) => p.min - q.min || (p.fimDoMinuto ? 1 : 0) - (q.fimDoMinuto ? 1 : 0) || p.n - q.n)
    .filter((x) => x.min <= min)
    .reverse();
  const relogio = acabou ? "Fim de jogo" : min === 45 ? "Intervalo" : min === 0 ? "Começando" : `${min}'`;
  const [a, b] = meu ? placar(meu) : [0, 0];
  const ultimaRodada = r + 1 >= total;

  return (
    <div id="sim-ao-vivo">
      <div className="av-placar" style={meu ? { "--ca": D.CL[meu[0]]?.c || "#444", "--cb": D.CL[meu[1]]?.c || "#444" } : undefined}>
        <span className="av-rot">Rodada {r + 1} · {rotuloLiga(estado.liga)}</span>
        {meu ? (
          <div className="av-times">
            <span className="av-time"><Escudo k={meu[0]} z={52} /><b>{nomeClube(meu[0])}</b></span>
            <span className="av-gols num" id="av-placar" aria-live="polite">{a}<i>–</i>{b}</span>
            <span className="av-time"><Escudo k={meu[1]} z={52} /><b>{nomeClube(meu[1])}</b></span>
          </div>
        ) : <p className="av-folga">Seu clube folga nesta rodada. Acompanhe os outros jogos.</p>}
        <span className={"av-relogio" + (acabou ? " fim" : "")} id="av-relogio">{!acabou && <i aria-hidden="true"></i>}{relogio}</span>
        <div className="av-linha" aria-hidden="true">
          <i style={{ width: (min / 90) * 100 + "%" }}></i>
          {/* Cada gol só aparece na linha quando acontece (antes disso, entregaria o placar) */}
          {meu && meu[4].filter((e) => e[0] <= min).map((e, n) => <s key={n} className={e[1] ? "b" : "a"} style={{ left: (e[0] / 90) * 100 + "%" }}></s>)}
        </div>
      </div>

      {meu && (
        <section className="sec">
          <h2><span>Lance a lance</span><span>{feed.filter((x) => x.tipo === "chance" || x.tipo === "gol").length} finalizações até agora</span></h2>
          <div className="card av-feed" id="av-feed">
            {acabou && <div className="av-ev av-marco"><b>90'</b><span>Fim de jogo: {nomeLado(0)} {meu[2]} × {meu[3]} {nomeLado(1)}.</span></div>}
            {feed.map((x) => (
              <div className={"av-ev av-" + x.tipo} key={x.n}>
                <b className="num">{x.min}'</b>
                {x.tipo === "marco" ? <span>{x.txt}</span>
                  : x.tipo === "gol" ? (
                    <span><strong>GOL do {nomeLado(x.lado)}!</strong> {nomeJog(plano, x.autor)}{x.assist && <span className="mute"> · assistência de {nomeJog(plano, x.assist)}</span>}</span>
                  ) : x.tipo === "sub" ? (
                    <span><span className="mute">{nomeLado(x.lado)}:</span> entra {nomeJog(plano, x.entra)}, sai {nomeJog(plano, x.sai)}.</span>
                  ) : <span><span className="mute">{nomeLado(x.lado)}:</span> {COMO[x.como](nomeJog(plano, x.autor))}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="sec">
        <h2><span>Outros jogos</span><span>ao vivo</span></h2>
        <div className="card">
          {jogos.filter((j, n) => n !== i).map((j) => {
            const [x, y] = placar(j);
            return (
              <div className="sim-jogo" key={j[0] + j[1]}>
                <div className="sim-jogo-linha">
                  <span className="c"><span className="sim-nome">{nomeClube(j[0])}</span><Escudo k={j[0]} z={20} /></span>
                  <b className="num sim-placar-n">{x} × {y}</b>
                  <span className="f"><Escudo k={j[1]} z={20} /><span className="sim-nome">{nomeClube(j[1])}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="simp-acoes">
        <div className="col simp-acoes-in av-ctrl">
          {!acabou ? (
            <>
              <button className="btn simp-mais" id="av-pausa" aria-label={pausa ? "Continuar" : "Pausar"} onClick={() => setPausa(!pausa)}>
                {pausa ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
                  : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>}
              </button>
              <div className="seg av-vel" role="group" aria-label="Velocidade">
                {Object.keys(VELOCIDADES).map((v) => <button key={v} aria-pressed={vel === v} onClick={() => mudarVel(v)}>{v}</button>)}
              </div>
              <button className="btn" id="av-pular" onClick={() => setMin(90)}>Pular</button>
            </>
          ) : (
            <>
              <button className="btn" id="av-sair" onClick={() => onSair("tabela")}>Ver tabela</button>
              {!ultimaRodada ? <button className="btn pri" id="av-proxima" onClick={onProxima}>Jogar rodada {r + 2}</button>
                : <button className="btn pri" id="av-fim" onClick={() => onSair("resumo")}>Ver o fim da temporada</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
