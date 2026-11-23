// Página do simulador da temporada (botão "Simular temporada", no topo do plano). Lógica em src/logica/simulacao/;
// o estado fica em "plantel:sim". Versão 2 (etapa 1): temporada atual real e formatos especiais das ligas (split, playoffs,
// Apertura/Clausura...). Etapa 2: copas. Etapa 3: janela da IA (card "Janela da IA" no Resumo antes da temporada e
// selo "Novo" no elenco dos clubes, que abre ao tocar num clube da tabela). Sem lesões ou suspensões.
//   Resumo        antes da temporada (previsão, quem chega e quem sai, vagas em aberto), durante (campanha e próximo jogo)
//                 e no fim (campeão, sua campanha, seleção da temporada no campinho, faixas)
//   Tabela        seletor de fase (pontos, split, grupos, torneios, anual) com as faixas; mata-mata como chaveamento
//   Jogos         placares de cada rodada; tocar num jogo mostra os gols
//   Estatísticas  artilharia, assistências, melhores notas e os números do seu clube
//   Ao vivo       o seu jogo minuto a minuto (gols, substituições e lances), com velocidade 1x a 8x
import { useEffect, useMemo, useState } from "react";
import { D } from "../logica/dados.js";
import { FORMS, corDoSetor } from "../logica/constantes.js";
import { rotuloVaga } from "../logica/compatibilidade.js";
import { short } from "../logica/formato.js";
import { Escudo, LogoLiga } from "./Imagens.jsx";
import { Avatar, Ovr, Pos } from "./Jogador.jsx";
import { dinheiro } from "../logica/dinheiro.js";
import { elencoAtual } from "../logica/elenco.js";
import { novaSemente } from "../logica/simulacao/aleatorio.js";
import { chegaram, difsDoMercado, elencoDepois, listaTransferencias } from "../logica/simulacao/mercadoIA.js";
import { calcularResto } from "../logica/simulacao/janelaResto.js";
import { Cabecalho } from "./Painel.jsx";
import Rodape from "./Rodape.jsx";
import { idPar, opcoesDaPendencia, pares, rotuloLiga, temporadaAtual, vagasDaPendencia, zonasDaLiga } from "../logica/simulacao/composicao.js";
import { formatoDa } from "../logica/simulacao/formatos.js";
import { atualDa, dataAtual } from "../logica/simulacao/atual.js";
import { campanhaCopa, comoEntra, defCopa, finaisPendentes, nomeCopa, participantesDe, vistasCopa } from "../logica/simulacao/copas.js";
import { escalarClube, idsDoPlano } from "../logica/simulacao/escalar.js";
import {
  VELOCIDADES, assinaturaDoPlano, calcularPrevisaoCopas, campeaoDe, copasDe, criarEstado, datasDe, esqCopa, jogadorSim, jogarProximoJogo,
  jogosDaRodada, jogosDaRodadaCopa, juntarResto, lerSim, pedidoDoResto, timeNaTemporada, lerVelocidade, linhasEstatisticas, minimoJogos, narracao, nomeClube, nomeDaData, nomeDaRodada,
  nomeDaRodadaCopa, proximoJogo, resultadosDe, salvarSim, salvarVelocidade, selecaoDaTemporada, simularAte, simularDatas, tabelaAtual,
  titulosDe, totalDatas, totalRodadas, vistaAtual, vistasTabela,
} from "../logica/simulacao/temporada.js";

// ---------- Formatos ----------
const pct = (x) => (x <= 0 ? "0%" : x < 1 ? "<1%" : Math.round(x) + "%");
const dec = (x, n = 1) => x.toFixed(n).replace(".", ",");
const sinal = (n) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");
const nomeJog = (plano, id) => { const p = id && jogadorSim(plano, id); return p ? short(p.n) : "—"; };
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : iso || "");
// Nome da rodada para a tela: "Rodada 12 de 38" na fase de pontos simples; "Playoffs · Quartas (ida) · 33/40" no resto
function rotuloRodada(estado, r, total) {
  const n = nomeDaRodada(estado, r);
  return /^Rodada \d+$/.test(n) ? `${n} de ${total}` : `${n} · ${r + 1}/${total}`;
}
// Texto do botão de jogar: "Jogar rodada 15", "Jogar Quartas (ida)"
function rotuloJogar(estado, r) {
  const n = nomeDaRodada(estado, r), ult = n.split(" · ").pop();
  return /^Rodada \d+$/.test(ult) ? "Jogar " + ult.replace("Rodada", "rodada") : "Jogar " + ult;
}

// Estado salvo do clube, se ainda servir (liga e clubes existem); senão, uma temporada nova
// (a previsão das copas, a parte mais demorada, é calculada logo depois de a tela abrir)
function carregar(plano) {
  const e = lerSim(plano.club);
  const ok = e && D.LG[e.liga] && e.composicao?.clubes?.length && e.composicao.clubes.every((k) => D.CL[k]) && e.composicao.clubes.includes(plano.club);
  if (ok) return e;
  const novo = criarEstado(plano, { semPrevisaoCopas: true });
  salvarSim(plano.club, novo);
  return novo;
}

const ABAS = [["resumo", "Resumo"], ["tabela", "Tabela"], ["jogos", "Jogos"], ["estat", "Estatísticas"]];
// Nome curto de uma copa para botões: sem o ano ("Copa Libertadores 2027" → "Libertadores")
export const copaCurta = (id) => nomeCopa(id).replace(/\s+\d{4}(\/\d{2})?$/, "").replace(/^Copa (?!do |del |de )/, "");
// Texto do botão de jogar: "Jogar rodada 15", "Jogar Libertadores"
function rotuloProximo(estado, k) {
  const px = proximoJogo(estado, k);
  if (!px) return "Jogar próximo jogo";
  const x = datasDe(estado)[px.d];
  if (!px.jogo) return "Jogar próximo jogo";
  return x.c === "liga" ? rotuloJogar(estado, x.r) : "Jogar " + copaCurta(x.c);
}

export default function Simulador({ app }) {
  const { plano } = app;
  const k = plano.club;
  const assinatura = assinaturaDoPlano(plano);
  const [estado, setEstado] = useState(() => carregar(plano));
  const [vista, setVista] = useState("resumo");
  const [comp, setComp] = useState("liga"); // competição mostrada em Tabela, Jogos e Estatísticas
  const [aoVivo, setAoVivo] = useState(null); // { c, r, d } do jogo que está sendo assistido (null = fora do jogo ao vivo)
  const total = useMemo(() => totalRodadas(estado), [estado.semente, estado.composicao, estado.liga]); // eslint-disable-line
  const nDatas = totalDatas(estado);
  const dataAt = estado.dataAtual || 0;
  const fim = dataAt >= nDatas;
  const tabela = useMemo(() => tabelaAtual(estado), [estado]);
  const ids = copasDe(estado);

  const guardar = (e) => { salvarSim(k, e); setEstado(e); };
  // Para resultados que chegam depois (previsão das copas, janela do resto do mundo): aplica sobre o estado mais novo
  const atualizar = (fn) => setEstado((e) => { const n = fn(e); if (n !== e) salvarSim(k, n); return n; });
  // (a janela da IA guarda o interruptor e a semente própria, do "Refazer janela")
  const criar = (mudar = {}) => criarEstado(plano, { semente: estado.semente, escolhas: estado.escolhas, substitui: estado.substitui, escolhasFinais: estado.escolhasFinais || {}, semPrevisaoCopas: true,
    mercadoAtivo: estado.mercadoAtivo !== false, mercadoSemente: estado.mercadoSemente ?? null, ...mudar });
  // Refaz antes de começar, com a mesma semente (as vagas e a previsão só mudam pelo que foi mexido)
  const refazer = (mudar = {}) => guardar(criar(mudar));
  const ir = (v) => { setVista(v); setAoVivo(null); window.scrollTo(0, 0); };
  const simularData = (ate) => guardar(simularDatas(estado, plano, ate));
  const simularRodada = (r) => guardar(simularAte(estado, plano, r));
  // Joga até o próximo jogo do clube (as datas das copas sem ele no meio são simuladas direto) e mostra ao vivo
  const jogarAoVivo = () => {
    const { estado: e, d } = jogarProximoJogo(estado, plano);
    guardar(e);
    if (d == null) { app.aviso("Seu clube não tem mais jogos nesta temporada"); return; }
    const x = datasDe(e)[d];
    setAoVivo({ c: x.c, r: x.r, d });
    window.scrollTo(0, 0);
  };
  const reSimular = () => { guardar(criar({ semente: undefined, mercadoSemente: null })); ir("resumo"); app.aviso("Nova temporada sorteada"); };
  const recomecar = () => { refazer(); ir("resumo"); };
  const continuar = () => guardar({ ...estado, assinatura });
  const opcoes = () => app.abrirPainel("simOpcoes", { atual: estado.rodadaAtual, total, onAte: simularRodada, onProx: () => simularData(dataAt + 1), onResimular: reSimular, onRecomecar: recomecar });

  // Antes da 1ª data, se o plano mudou (contratou, vendeu, mexeu no time), a previsão é refeita na hora
  useEffect(() => {
    if (dataAt === 0 && estado.assinatura !== assinatura) refazer();
  }, [assinatura]); // eslint-disable-line
  // Previsão das copas: calculada logo depois de a tela aparecer (é a parte mais demorada)
  useEffect(() => {
    if (estado.previsaoCopas || !ids.length) return;
    const t = setTimeout(() => {
      const p = calcularPrevisaoCopas(estado, plano), copas = estado.copas;
      atualizar((e) => (e.copas === copas && !e.previsaoCopas ? { ...e, previsaoCopas: p } : e));
    }, 30);
    return () => clearTimeout(t);
  }, [estado]); // eslint-disable-line
  // Janela da IA, fase 2 (o resto do mundo): no Web Worker, logo depois de a tela abrir
  useEffect(() => {
    if (!estado.mercadoIA || estado.mercadoIA.resto) return;
    let vivo = true;
    const t = setTimeout(() => {
      const pedido = pedidoDoResto(estado, plano);
      calcularResto(pedido).then((novas) => { if (vivo) atualizar((e) => juntarResto(e, pedido.transf, novas)); });
    }, 60);
    return () => { vivo = false; clearTimeout(t); };
  }, [estado.mercadoIA]); // eslint-disable-line

  const mudou = dataAt > 0 && estado.assinatura !== assinatura;
  const pos = tabela.findIndex((l) => l.k === k) + 1;
  // Durante o jogo ao vivo, o topo não mostra a posição (ela já conta o resultado e estragaria a surpresa)
  const tits = fim ? titulosDe(estado).filter((t) => !t.extra && t.k) : [];
  const status = aoVivo !== null ? `${nomeDaData(estado, aoVivo.d)} · ao vivo`
    : dataAt === 0 ? `Antes da temporada · ${total} rodadas${ids.length ? ` e ${ids.length} ${ids.length > 1 ? "copas" : "copa"}` : ""}`
      : fim ? `Temporada encerrada · ${tits.length > 1 ? "campeões" : "campeão"}: ${tits.map((t) => nomeClube(t.k)).join(" e ") || nomeClube(tabela[0].k)}`
        : estado.rodadaAtual === 0 ? `${nomeDaData(estado, dataAt - 1)} · ${dataAt}/${nDatas}`
          : `${rotuloRodada(estado, estado.rodadaAtual - 1, total)} · ${nomeClube(k)} em ${pos}º`;
  const F = formatoDa(estado.liga);
  const indice = ABAS.findIndex(([v]) => v === vista);
  const Comps = ({ comTotal }) => (ids.length > 0 ? (
    <div className="seg sim-comps" role="group" aria-label="Competição" id="sim-comps">
      {[...(comTotal ? [["total", "Total"]] : []), ["liga", "Liga"], ...ids.map((id) => [id, copaCurta(id)])].map(([c, nome]) => (
        <button key={c} id={"sc-" + c} aria-pressed={(comp === "total" && !comTotal ? "liga" : comp) === c} onClick={() => setComp(c)}>{nome}</button>
      ))}
    </div>
  ) : null);
  const compTab = comp === "total" ? "liga" : comp;

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
              <span className="simp-titulo-l">
                <b id="sim-liga">{rotuloLiga(estado.liga)}</b>
                {F.confirmado === false && <span className="sim-selo sim-aprox" id="sim-aprox" title={F.nota || "Formato aproximado: confira as regras reais da liga."}>formato aproximado</span>}
              </span>
              <span id="sim-status">{status}</span>
            </div>
          </div>
          <div className="simp-prog" aria-hidden="true"><i style={{ width: ((aoVivo !== null ? aoVivo.d : dataAt) / nDatas) * 100 + "%" }}></i></div>
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
          <AoVivo key={aoVivo.d} estado={estado} c={aoVivo.c} r={aoVivo.r} d={aoVivo.d} plano={plano} k={k}
            onSair={(v = "resumo") => { if (v === "tabela") setComp(aoVivo.c); ir(v); }} onProxima={jogarAoVivo} />
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
            {vista === "resumo" && (dataAt === 0 ? <Antes estado={estado} k={k} refazer={refazer} app={app} />
              : fim ? <Fim estado={estado} tabela={tabela} k={k} plano={plano} />
                : <Andamento estado={estado} tabela={tabela} k={k} total={total} plano={plano} jogarAoVivo={jogarAoVivo} verJogos={() => ir("jogos")} />)}
            {vista === "tabela" && <><Comps /><Tabela key={compTab} estado={estado} k={k} comp={compTab} onClube={(x) => app.abrirPainel("simElenco", { estado, x })} /></>}
            {vista === "jogos" && <><Comps /><Jogos key={compTab} estado={estado} total={total} k={k} plano={plano} jogarAoVivo={jogarAoVivo} comp={compTab} /></>}
            {vista === "estat" && <><Comps comTotal /><Estatisticas estado={estado} k={k} plano={plano} comp={comp} /></>}
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
                <button className="btn" id="sim-fim" onClick={() => simularData(nDatas)}>Simular até o fim</button>
                <button className="btn pri" id="sim-aovivo" onClick={jogarAoVivo}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
                  {/* no celular, o texto completo ("Jogar Copa do Brasil") não cabe: o card "Próximo jogo" já diz qual é */}
                  <span className="so-largo">{rotuloProximo(estado, k)}</span><span className="so-celular">Jogar ao vivo</span>
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
export function PainelSimOpcoes({ app, atual, total, onAte, onProx, onResimular, onRecomecar }) {
  const [n, setN] = useState("");
  const alvo = Math.min(total, Math.max(atual + 1, parseInt(n, 10) || Math.min(total, atual + 5)));
  const fazer = (fn) => { app.fecharPainel(); fn(); };
  return (
    <>
      <Cabecalho titulo="Mais opções" sub={`Rodada ${atual} de ${total} da liga`} onFechar={app.fecharPainel} />
      <button className="opt" id="sim-prox" onClick={() => fazer(onProx)}>
        <span className="r"></span><span>Simular só a próxima data<small>Uma rodada da liga ou um jogo de copa, sem assistir.</small></span>
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
      <p className="note" style={{ marginTop: 10 }}>"Até a rodada" conta as rodadas da liga (os jogos de copa que vêm antes também são simulados). Recomeçar volta ao início com o mesmo sorteio. Re-simular sorteia uma temporada nova (vagas, finais pendentes simuladas, previsão e jogos).</p>
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
            {meu.titulos ? meu.titulos.map((t) => <div key={t.nome}><b className="num">{pct(t.pct)}</b><span>título {t.nome}</span></div>)
              : <div><b className="num">{pct(meu.titulo)}</b><span>chance de título</span></div>}
            {temQueda && <div><b className="num desce">{pct(meu.queda)}</b><span>risco de queda</span></div>}
            {temAcesso && <div><b className="num sobe">{pct(meu.acesso)}</b><span>chance de acesso</span></div>}
          </div>
          <p className="sim-hero-nota">Média de 300 temporadas simuladas com o seu elenco, a sua escalação e o formato da liga.</p>
        </div>
      )}

      {estado.atual && (
        <button className="card sim-atual-bt" id="sim-ver-atual" onClick={() => app.abrirPainel("simAtual", { estado })}>
          <span><b>Ver tabela atual</b><small>{rotuloAtual(estado.atual.lg)}: a tabela real de {dataBr(dataAtual())} e como ela termina na projeção</small></span>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {!!D.CL[k]?.criado && <Substituto estado={estado} k={k} refazer={refazer} />}

      <JanelaIA estado={estado} k={k} refazer={refazer} app={app} />

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

      <CopasAntes estado={estado} k={k} refazer={refazer} />

      <section className="sec" id="sim-previsao">
        <h2><span>Previsão da liga</span><span>{temQueda ? "título · queda" : temAcesso ? "título · acesso" : "título"}</span></h2>
        <div className="card">
          {ordem.map(([c, x], i) => (
            <div className={"sim-prev" + (c === k ? " meu" : "")} key={c}>
              <span className="sim-n">{i + 1}</span>
              <Escudo k={c} z={22} />
              <span className="sim-nome">{nomeClube(c)}</span>
              <span className="sim-prev-barra" title={`posição média ${dec(x.pos)}º`}><i style={{ width: Math.max(2, x.titulo) + "%" }}></i></span>
              <span className="num sim-prev-n"><span>{x.titulos ? x.titulos.map((t) => pct(t.pct)).join(" · ") : pct(x.titulo)}</span>
                {temQueda && <span className={x.queda >= 50 ? "desce" : "mute"}>{pct(x.queda)}</span>}{temAcesso && <span className={x.acesso >= 50 ? "sobe" : "mute"}>{pct(x.acesso)}</span>}</span>
            </div>
          ))}
        </div>
        <p className="note sim-leg">Ordem pela posição média. A barra é a chance de título.</p>
      </section>
    </>
  );
}

// Janela da IA (Resumo antes da temporada): o interruptor, as 5 maiores contratações e "Ver todas" (lista completa com
// filtro por liga; os clubes da sua liga ficam destacados)
const POR_PAGINA_JANELA = 50;
function JanelaIA({ estado, k, refazer, app }) {
  const m = estado.mercadoIA;
  const lista = useMemo(() => listaTransferencias(m), [m]);
  const rivais = useMemo(() => new Set(estado.composicao.clubes), [estado.composicao]);
  const [todas, setTodas] = useState(false);
  const [liga, setLiga] = useState("");
  const [n, setN] = useState(POR_PAGINA_JANELA);
  // Liga do clube na temporada simulada: a sua liga para os clubes dela; quem sai dela (cai ou sobe) vai para a liga nova
  const saem = useMemo(() => Object.fromEntries((estado.composicao.saem || []).map((s) => [s.k, s.para])), [estado.composicao]);
  const ligaDe = (x) => (rivais.has(x) ? estado.liga : x in saem ? saem[x] : D.CL[x]?.lg);
  const ligas = useMemo(() => [...new Set(lista.flatMap((t) => [ligaDe(t.de), ligaDe(t.para)]))].filter((lg) => D.LG[lg])
    .sort((a, b) => (a === estado.liga ? -1 : b === estado.liga ? 1 : D.LG[a].n.localeCompare(D.LG[b].n))), [lista]); // eslint-disable-line
  const filtrada = liga ? lista.filter((t) => ligaDe(t.de) === liga || ligaDe(t.para) === liga) : lista;
  const ligar = () => refazer({ mercadoAtivo: !m });
  const refazerJanela = () => { refazer({ mercadoSemente: novaSemente() }); app.aviso("Janela da IA sorteada de novo"); };
  return (
    <section className="sec" id="sim-janela">
      <h2><span>Janela da IA</span><span>{m ? `${lista.length} contratações${m.resto ? "" : " · calculando o resto do mundo…"}` : "desligada"}</span></h2>
      <div className="card sim-janela">
        <button className="sim-int" id="janela-ativa" role="switch" aria-checked={!!m} onClick={ligar}>
          <span className="sim-int-txt"><b>Clubes da IA contratam</b>
            <small>{m ? "Antes da 1ª rodada, cada clube faz de 0 a 4 contratações. A previsão e os jogos já usam os elencos novos." : "Desligado: os outros clubes jogam com o elenco de hoje."}</small></span>
          <span className="sim-int-bola" aria-hidden="true"><i></i></span>
        </button>
        {m && (
          <>
            <div className="sim-janela-top" id="janela-top">
              {lista.length ? lista.slice(0, 5).map((t) => <LinhaJanela key={t.id} t={t} k={k} rivais={rivais} />)
                : <div className="empty" style={{ padding: 16 }}>Nenhuma contratação.</div>}
            </div>
            <div className="sim-janela-bts">
              <button className="btn" id="janela-todas" aria-expanded={todas} onClick={() => setTodas(!todas)}>{todas ? "Mostrar menos" : `Ver todas (${lista.length})`}</button>
              <button className="btn" id="janela-refazer" onClick={refazerJanela}>Refazer janela</button>
            </div>
          </>
        )}
      </div>
      {m && todas && (
        <div className="sim-janela-todas" id="janela-lista">
          <select id="janela-liga" aria-label="Liga" value={liga} onChange={(e) => { setLiga(e.target.value); setN(POR_PAGINA_JANELA); }}>
            <option value="">Todas as ligas ({lista.length})</option>
            {ligas.map((lg) => <option key={lg} value={lg}>{D.LG[lg].n}{lg === estado.liga ? " (sua liga)" : ""}</option>)}
          </select>
          <div className="card">
            {filtrada.length ? filtrada.slice(0, n).map((t) => <LinhaJanela key={t.id} t={t} k={k} rivais={rivais} />)
              : <div className="empty" style={{ padding: 16 }}>Nenhuma contratação nesta liga.</div>}
          </div>
          {filtrada.length > n && <button className="btn sim-janela-mais" id="janela-mais" onClick={() => setN(n + POR_PAGINA_JANELA)}>Ver mais ({filtrada.length - n})</button>}
          <p className="note sim-leg">Destacados: clubes da sua liga. Preço = valor de mercado. Toque num clube na Tabela para ver o elenco dele, com o selo "Novo" em quem chegou.</p>
        </div>
      )}
    </section>
  );
}

function LinhaJanela({ t, k, rivais }) {
  const destaque = rivais.has(t.de) || rivais.has(t.para);
  return (
    <div className={"sim-janela-linha" + (destaque ? " sim-janela-rival" : "") + (t.de === k || t.para === k ? " meu" : "")}>
      <Avatar p={t.p} z={36} />
      <span className="sim-janela-jog">
        <b className="sim-nome">{short(t.p.n)}</b>
        <span className="sim-janela-rota">
          <Escudo k={t.de} z={16} /><span className="sim-nome">{nomeClube(t.de)}</span>
          <span className="sim-janela-seta" aria-hidden="true">→</span>
          <Escudo k={t.para} z={16} /><span className="sim-nome">{nomeClube(t.para)}</span>
        </span>
      </span>
      <span className="sim-janela-valor"><b className="num">{dinheiro(t.valor)}</b><span className="sim-janela-sub"><Pos pos={t.p.pos} /><Ovr p={t.p} /></span></span>
    </div>
  );
}

// Elenco de um clube na temporada simulada (tocar no clube na Tabela): titulares, banco e o resto, com o selo "Novo"
// em quem chegou na janela da IA e a lista de quem saiu
export function PainelElencoSim({ app, estado, x }) {
  const plano = app.plano, m = estado.mercadoIA;
  const time = useMemo(() => timeNaTemporada(estado, plano, x), [estado, plano, x]);
  const novos = chegaram(x, m), saiu = [...(difsDoMercado(m)[x]?.s || [])].map((id) => D.BYID[id]).filter(Boolean);
  const fora = x === plano.club ? new Set() : idsDoPlano(plano);
  const todos = x === plano.club ? elencoAtual(plano).filter(Boolean) : elencoDepois(x, m).filter((p) => !fora.has(p.id));
  const usados = new Set([...time.onze.map((s) => s.p?.id), ...time.banco.map((p) => p.id)]);
  const resto = todos.filter((p) => !usados.has(p.id)).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
  const Linha = ({ p, vaga }) => (
    <div className="sim-elenco-linha">
      <Avatar p={p} z={30} />
      <span className="sim-nome sim-elenco-nome">{short(p.n)}</span>
      {novos.has(p.id) && <span className="sim-selo sim-novo" title={`Chegou do ${nomeClube(p.club)} na janela da IA`}>Novo</span>}
      {vaga && rotuloVaga(vaga) !== p.pos && <span className="mute sim-elenco-vaga" title="Vaga no time">{rotuloVaga(vaga)}</span>}
      <Pos pos={p.pos} /><Ovr p={p} />
    </div>
  );
  return (
    <>
      <Cabecalho titulo={nomeClube(x)} sub={`${time.form} · força ${dec(time.forca)} · ${todos.length} jogadores${novos.size ? ` · ${novos.size} ${novos.size > 1 ? "chegaram" : "chegou"}` : ""}`} onFechar={app.fecharPainel} />
      <div className="sim-elenco" id="sim-elenco">
        <span className="sim-rot">Titulares</span>
        {time.onze.map((s, i) => (s.p ? <Linha key={i} p={s.p} vaga={s.vaga} /> : <div className="sim-elenco-linha mute" key={i}>{rotuloVaga(s.vaga)} vazia</div>))}
        <span className="sim-rot">Banco</span>
        {time.banco.map((p) => <Linha key={p.id} p={p} />)}
        {resto.length > 0 && <><span className="sim-rot">Fora dos relacionados</span>{resto.map((p) => <Linha key={p.id} p={p} />)}</>}
        {saiu.length > 0 && <p className="note sim-elenco-saiu">Saíram na janela: {saiu.map((p) => `${short(p.n)} (${nomeClube(m.transf.find((t) => t[0] === p.id)?.[1])})`).join(", ")}</p>}
      </div>
    </>
  );
}
// Participantes de cada copa, separados por onde entram
function gruposDeParticipantes(id, p) {
  if (id === "LIB") return [["Fase de grupos", p.grupos], ["Pré-Libertadores", p.pre]];
  if (id === "SUD") return [["Fase de grupos", p.direto], ["Primeira fase", p.primeira]];
  if (id === "UCL") return [["Fase de liga", p.diretos], ["Qualificação", [...p.qualCamp, ...p.qualLiga]]];
  if (id === "UEL") return [["Fase de liga", p.fixos], ["+ 7 eliminados da qualificação da Champions", []]];
  if (id === "UECL") return [["Fase de liga", p.fixos]];
  if (id === "CDB") return [["5ª fase (Série A)", p.a], ["Fases 1 a 4 (Séries B e C)", p.baixo]];
  return [["Participantes", p.todos || []]];
}

// Copas da temporada (antes de começar): situação do clube, chance de título, classificados e as finais de 2026 em aberto
function CopasAntes({ estado, k, refazer }) {
  const ids = copasDe(estado);
  if (!ids.length) return null;
  const finais = finaisPendentes().filter((f) => estado.finais?.[f.id]);
  const escolher = (id, x) => refazer({ escolhasFinais: { ...(estado.escolhasFinais || {}), [id]: x } });
  const simular = (id) => { const e = { ...(estado.escolhasFinais || {}) }; delete e[id]; refazer({ escolhasFinais: e }); };
  return (
    <>
      <section className="sec" id="sim-copas">
        <h2><span>Copas</span><span>chance de título</span></h2>
        <div className="sim-copas-lista">
          {ids.map((id) => {
            const c = estado.copas[id], como = comoEntra(id, c.part, k), chance = estado.previsaoCopas?.[id]?.[k], def = defCopa(id);
            return (
              <details className="card sim-copa" key={id} id={"copa-" + id}>
                <summary>
                  <span className="sim-copa-nome"><b>{nomeCopa(id)}</b><span className={como ? "sobe" : "mute"}>{como ? `Classificado · ${como}` : "Não se classificou"}</span></span>
                  <span className="sim-copa-chance num">{!como ? "—" : estado.previsaoCopas ? pct(chance || 0) : "…"}</span>
                </summary>
                <div className="sim-copa-detalhe">
                  <p className="note">{participantesDe(id, c.part).length} clubes do site{def.confirmado === false ? " · formato aproximado" : ""}{def.nota ? " · " + def.nota : ""}</p>
                  {gruposDeParticipantes(id, c.part).map(([titulo, lista]) => (
                    <div key={titulo} className="sim-copa-bloco">
                      <span className="sim-rot">{titulo}{lista.length ? ` · ${lista.length}` : ""}</span>
                      <div className="sim-faixa-clubes">
                        {lista.map((x) => (
                          <span key={x} className={"sim-faixa-clube" + (x === k ? " meu" : "")}>
                            <Escudo k={x} z={18} /><span className="sim-nome">{nomeClube(x)}</span>
                            <span className={"sim-selo " + (c.part.selo?.[x] === "real" ? "sim-selo-conf" : c.part.selo?.[x] === "escolhido" ? "sim-selo-escolhido" : "sim-selo-proj")}>{c.part.selo?.[x] || "projeção"}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <p className="note sim-leg">Classificados pela tabela real de hoje e pela projeção do fim da temporada atual ("real" = vaga já garantida). Chance de título: média de 300 simulações{estado.previsaoCopas ? "" : " (calculando…)"}.</p>
      </section>

      {finais.length > 0 && (
        <section className="sec" id="sim-finais">
          <h2><span>Finais de 2026 em aberto</span><span>valem vagas na Libertadores</span></h2>
          {finais.map((f) => {
            const r = estado.finais[f.id], [a, b] = f.jogo;
            return (
              <div className="card sim-pend" key={f.id} id={"final-" + f.id}>
                <div className="sim-pend-cab"><b>{f.nome}</b><small>{dataBr(f.data)} · {f.local}{f.nota ? " · " + f.nota : ""}</small></div>
                <div className="seg" role="group" aria-label="Como resolver">
                  <button aria-pressed={r.modo === "simular"} onClick={() => r.modo !== "simular" && simular(f.id)}>Simular</button>
                  <button aria-pressed={r.modo === "escolher"} onClick={() => r.modo !== "escolher" && escolher(f.id, r.vence)}>Escolher campeão</button>
                </div>
                {r.modo === "simular" ? (
                  <p className="sim-final-res"><Escudo k={a} z={20} /> {nomeClube(a)} <b className="num">{r.placar[0]} × {r.placar[1]}</b> {nomeClube(b)} <Escudo k={b} z={20} />{r.pen ? " (pênaltis)" : ""} → <b>{nomeClube(r.vence)}</b></p>
                ) : (
                  <div className="sim-duelo">
                    {[a, b].map((x) => <button key={x} className="sim-op" aria-pressed={r.vence === x} onClick={() => escolher(f.id, x)}><Escudo k={x} z={20} /><span>{nomeClube(x)}</span></button>)}
                  </div>
                )}
                <p className="note sim-conta">{f.efeito}</p>
              </div>
            );
          })}
        </section>
      )}
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
function Andamento({ estado, tabela, k, plano, jogarAoVivo, verJogos }) {
  const i = tabela.findIndex((l) => l.k === k), l = tabela[i];
  // Próximo jogo (liga ou copa): pode ainda não ter confronto definido (mata-mata que depende da fase anterior)
  const px = proximoJogo(estado, k);
  const prox = px?.jogo, nomeProx = px ? nomeDaData(estado, px.d) : "";
  const prev = estado.previsao[k];
  // Último jogo do seu clube (em qualquer competição)
  let ultimo = null;
  const datas = datasDe(estado);
  for (let d = (estado.dataAtual || 0) - 1; d >= 0 && !ultimo; d--) { const x = datas[d], j = resultadosDe(estado, x.c)[x.r]?.find((y) => y[0] === k || y[1] === k); if (j) ultimo = { d, j }; }
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
            <span className="sim-rot">Próximo jogo · {nomeProx}</span>
            <div className="sim-confronto"><span><Escudo k={prox[0]} z={30} /><b className="sim-nome">{nomeClube(prox[0])}</b></span><i>×</i><span><Escudo k={prox[1]} z={30} /><b className="sim-nome">{nomeClube(prox[1])}</b></span></div>
            <button className="btn pri" onClick={jogarAoVivo}>Assistir ao vivo</button>
          </div>
        ) : <div className="card sim-prox"><span className="sim-rot">{nomeProx || "Próximo jogo"}</span><p className="mute" style={{ margin: 0 }}>{px ? "O confronto sai quando a fase anterior acabar." : "Seu clube não tem mais jogos nesta temporada."}</p></div>}
        {ultimo && (
          <button className="card sim-prox sim-ultimo" onClick={verJogos}>
            <span className="sim-rot">Último jogo · {nomeDaData(estado, ultimo.d)}</span>
            <div className="sim-confronto"><span><Escudo k={ultimo.j[0]} z={30} /><b className="sim-nome">{nomeClube(ultimo.j[0])}</b></span><i className="num">{ultimo.j[2]} × {ultimo.j[3]}</i><span><Escudo k={ultimo.j[1]} z={30} /><b className="sim-nome">{nomeClube(ultimo.j[1])}</b></span></div>
            <span className="mute sim-autores">{ultimo.j[4].filter((e) => (e[1] === 0 ? ultimo.j[0] : ultimo.j[1]) === k).map((e) => nomeJog(plano, e[2])).join(", ") || "sem gols do seu clube"}</span>
          </button>
        )}
      </div>

      <CopasDoClube estado={estado} k={k} />

      <section className="sec">
        <h2><span>Classificação</span><span>pontos</span></h2>
        <TabelaCurta tabela={tabela} k={k} zonas={zonasDaLiga(estado.liga, tabela.length)} />
      </section>
    </div>
  );
}

// Situação do clube em cada copa ("Na disputa: Oitavas", "Eliminado: Quartas (para o X)", "Campeão"...) e quem ganhou cada uma
function CopasDoClube({ estado, k, fimDaTemporada = false }) {
  const ids = copasDe(estado);
  if (!ids.length) return null;
  return (
    <section className="sec" id="sim-copas-clube">
      <h2><span>{fimDaTemporada ? "Copas" : "Nas copas"}</span><span>{nomeClube(k)}</span></h2>
      <div className="card">
        {ids.map((id) => {
          const c = estado.copas[id], camp = campanhaCopa(id, c, esqCopa(estado, id), k), campeao = campeaoDe(estado, id);
          return (
            <div className={"sim-copa-linha" + (camp.titulo ? " meu" : "")} key={id}>
              <span className="sim-copa-nome"><b>{nomeCopa(id)}</b>
                <span className={camp.titulo ? "sobe" : camp.fora ? "mute" : ""}>{camp.titulo ? "🏆 " : ""}{camp.txt}{camp.adv ? ` · ${nomeClube(camp.adv)}` : ""}</span></span>
              {campeao && <span className="sim-copa-campeao" title={"Campeão: " + nomeClube(campeao)}><Escudo k={campeao} z={22} /><span className="sim-nome">{nomeClube(campeao)}</span></span>}
            </div>
          );
        })}
      </div>
    </section>
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
  // Títulos pela regra do formato (pontos, playoffs, final, dois campeões); extras = Apertura/Clausura da Argentina
  const tits = titulosDe(estado);
  const principais = tits.filter((t) => !t.extra && t.k), extras = tits.filter((t) => t.extra && t.k);
  const campeao = tabela.find((l) => l.k === principais[0]?.k) || tabela[0];
  const meusTitulos = [...tits.filter((t) => t.k === k), ...copasDe(estado).filter((id) => campeaoDe(estado, id) === k).map((id) => ({ nome: nomeCopa(id) }))];
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
        <small>{principais.length > 1 ? `${principais[0].nome} · ${rotuloLiga(estado.liga)}` : `Campeão da ${rotuloLiga(estado.liga)}`}</small>
        <b>{nomeClube(campeao.k)}</b>
        <span className="num">{campeao.pts} pontos · {campeao.v} vitórias · saldo {sinal(campeao.gp - campeao.gc)}</span>
        {(principais.length > 1 || extras.length > 0) && (
          <span className="sim-outros-titulos" id="sim-titulos">
            {[...principais.slice(1), ...extras].map((t) => <span key={t.nome}><Escudo k={t.k} z={18} />{t.nome}: <b>{nomeClube(t.k)}</b></span>)}
          </span>
        )}
      </div>
      {meusTitulos.length > 0 && <p className="sim-aviso sim-meu-titulo" id="sim-meu-titulo">🏆 {nomeClube(k)} campeão: {meusTitulos.map((t) => t.nome).join(", ")}!</p>}

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

      <CopasDoClube estado={estado} k={k} fimDaTemporada />

      <section className="sec" id="sim-selecao">
        <h2><span>Seleção da temporada</span><span>4-3-3 · melhores notas{copasDe(estado).length ? " · todas as competições" : ""}</span></h2>
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
// Seletor de fase (Fase de pontos | Split | Playoffs, ou Apertura | Clausura | Anual...) e, em cada fase,
// as tabelas (com as faixas onde valem) e o chaveamento dos mata-matas.
function Tabela({ estado, k, comp = "liga", onClube }) {
  // Liga: as fases do formato. Copa: grupos ou fase de liga e os chaveamentos (pré, mata-mata...).
  const vistas = useMemo(() => (comp === "liga" ? vistasTabela(estado) : vistasCopa(comp, estado.copas[comp], esqCopa(estado, comp))), [estado, comp]);
  const [id, setId] = useState(() => {
    if (comp === "liga") return vistaAtual(estado, vistas);
    // copa: a fase em andamento (a da próxima rodada da copa), ou a última
    const c = estado.copas[comp], E = esqCopa(estado, comp), r = Math.min(c.resultados.length, E.total - 1);
    const e = E.etapas.find((x) => x.inicio <= r && r < x.inicio + x.rodadas);
    return vistas.find((v) => v.nome === e?.bloco)?.id || vistas[0]?.id;
  });
  const v = vistas.find((x) => x.id === id) || vistas[0];
  const legenda = [];
  v.blocos.forEach((b) => (b.zonas || []).forEach((z) => { if (z && !legenda.some((x) => x.nome === z.nome)) legenda.push(z); }));
  return (
    <div id="sim-tabelas">
      {vistas.length > 1 && (
        <div className="seg sim-fases" role="group" aria-label="Fase" id="sim-fases">
          {vistas.map((x) => <button key={x.id} id={"sf-" + x.id} aria-pressed={x.id === v.id} onClick={() => setId(x.id)}>{x.nome}</button>)}
        </div>
      )}
      {v.blocos.map((b, i) => (
        b.tipo === "tabela" ? <TabelaBloco key={i} b={b} k={k} primeira={i === 0} onClube={onClube} />
          : b.tipo === "chave" ? <Chave key={i} b={b} k={k} />
            : <div className="card" key={i}><div className="empty" style={{ padding: 16 }}>{b.texto}</div></div>
      ))}
      {legenda.length > 0 && <div className="sim-legenda" id="sim-legenda">{legenda.map((z) => <span key={z.nome}><i style={{ background: z.cor }}></i>{z.nome}</span>)}</div>}
    </div>
  );
}

// Tocar no clube abre o elenco dele na temporada (com o selo "Novo" em quem chegou na janela da IA)
function TabelaBloco({ b, k, primeira, onClube }) {
  return (
    <section className="sec sim-bloco">
      {b.titulo && <h2><span>{b.titulo}</span><span>{b.linhas.length} clubes</span></h2>}
      <div className="card sim-tab-wrap">
        <table className="sim-tabela" id={primeira ? "sim-tabela" : undefined}>
          <thead><tr><th>#</th><th className="cl">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th className="ult">Últimos 5</th></tr></thead>
          <tbody>
            {b.linhas.map((l, i) => (
              <tr key={l.k} className={l.k === k ? "meu" : ""}>
                <td className="zp" style={{ "--z": b.zonas?.[i]?.cor || "transparent" }} title={b.zonas?.[i]?.nome}>{(b.inicio || 0) + i + 1}</td>
                <td className="cl">{onClube
                  ? <button className="sim-tab-clube" onClick={() => onClube(l.k)} title="Ver elenco"><Escudo k={l.k} z={20} /><span className="sim-nome">{nomeClube(l.k)}</span></button>
                  : <span><Escudo k={l.k} z={20} /><span className="sim-nome">{nomeClube(l.k)}</span></span>}</td>
                <td><b>{l.pts}</b></td><td>{l.j}</td><td>{l.v}</td><td>{l.e}</td><td>{l.d}</td><td>{sinal(l.gp - l.gc)}</td>
                <td className="ult"><Ultimos l={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Chaveamento: uma coluna por fase; cada confronto com o placar de cada jogo, o agregado e quem passou
function Chave({ b, k }) {
  const Time = ({ x, gols, vence, pen }) => (
    <div className={"sim-conf-time" + (vence ? " sim-conf-vence" : "") + (x === k ? " meu" : "")}>
      {x ? <Escudo k={x} z={20} /> : <span className="sim-conf-vazio"></span>}
      <span className="sim-nome">{x ? nomeClube(x) : "a definir"}</span>
      {gols != null && <b className="num">{gols}{pen ? <small> (pên.)</small> : null}</b>}
    </div>
  );
  return (
    <section className="sec sim-bloco">
      <h2><span>{b.titulo}</span><span>chaveamento</span></h2>
      <div className="sim-chave">
        {b.fases.map((f, i) => (
          <div className="sim-chave-col" key={i}>
            <span className="sim-rot">{f.nome}{f.idaVolta ? " · ida e volta" : ""}</span>
            {!f.definida && <div className="card sim-conf sim-conf-aguarde">Sai da fase anterior</div>}
            {f.confrontos.map((c, j) => (
              <div className="card sim-conf" key={j}>
                <Time x={c.a} gols={c.jogados ? c.ga : null} vence={c.vence === c.a} pen={c.penaltis && c.vence === c.a} />
                <Time x={c.b} gols={c.jogados ? c.gb : null} vence={c.vence === c.b} pen={c.penaltis && c.vence === c.b} />
                {c.jogos.length > 1 && <span className="sim-conf-jogos num">{c.jogos.map(([casa, x, y]) => `${casa === c.a ? x + "×" + y : y + "×" + x}`).join(" · ")}</span>}
              </div>
            ))}
            {f.passam.length > 0 && (
              <div className="sim-conf-passam">Direto: {f.passam.map((x) => <span key={x} className={x === k ? "meu" : ""}><Escudo k={x} z={16} />{nomeClube(x)}</span>)}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Jogos (rodada a rodada) ----------
function Jogos({ estado, total: totalLiga, k, plano, jogarAoVivo, comp = "liga" }) {
  const liga = comp === "liga";
  const total = liga ? totalLiga : esqCopa(estado, comp).total;
  const feitas = liga ? estado.rodadaAtual : estado.copas[comp].resultados.length;
  const [r, setR] = useState(() => Math.max(0, Math.min(total - 1, feitas - (liga ? 1 : feitas < total ? 0 : 1))));
  const [aberto, setAberto] = useState(null);
  const jogada = r < feitas;
  const fixos = jogada ? resultadosDe(estado, comp)[r] : liga ? jogosDaRodada(estado, r) : jogosDaRodadaCopa(estado, comp, r);
  const jogos = fixos ? (jogada ? fixos : fixos.map(([c, f]) => [c, f, null, null, []])) : null;
  const ordenados = jogos ? [...jogos].sort((a, b) => (b[0] === k || b[1] === k) - (a[0] === k || a[1] === k)) : [];
  const mudar = (n) => { setR(n); setAberto(null); };
  const nome = liga ? nomeDaRodada(estado, r) : nomeDaRodadaCopa(estado, comp, r);
  return (
    <div id="sim-rodadas">
      <div className="sim-nav">
        <button className="btn" id="rod-ant" aria-label="Rodada anterior" disabled={r === 0} onClick={() => mudar(r - 1)}>‹</button>
        <div><b id="rod-n">{/^Rodada \d+$/.test(nome) ? `${nome} de ${total}` : nome}</b><span className="mute">{jogada ? "encerrada" : r === feitas ? "próxima" : "a jogar"}{/^Rodada \d+$/.test(nome) ? "" : ` · ${r + 1}/${total}`}</span></div>
        <button className="btn" id="rod-prox" aria-label="Próxima rodada" disabled={r >= total - 1} onClick={() => mudar(r + 1)}>›</button>
      </div>
      {liga && r === estado.rodadaAtual && jogos && <button className="btn pri sim-jogar-rodada" onClick={jogarAoVivo}>Jogar o próximo jogo ao vivo</button>}
      {!jogos && <div className="card"><div className="empty" style={{ padding: 16 }}>Os confrontos desta rodada saem quando a fase anterior acabar.</div></div>}
      {jogos && !ordenados.some((j) => j[0] === k || j[1] === k) && <p className="note">Seu clube não joga nesta rodada.</p>}
      {jogos && jogos.length > 0 && (
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
      )}
    </div>
  );
}

// ---------- Painel "Ver tabela atual" ----------
// A tabela real de hoje (temporada-atual.json) e como ela termina na projeção (a mesma usada nas vagas de acesso/rebaixamento)
const rotuloAtual = (lg) => atualDa(lg)?.rotulo || D.LG[lg]?.n || lg;
export function PainelTabelaAtual({ app, estado }) {
  const A = estado.atual, real = atualDa(A.lg)?.tabela || [];
  const k = app.plano?.club;
  return (
    <>
      <Cabecalho titulo={rotuloAtual(A.lg)} sub={`Tabela real de ${dataBr(dataAtual())} e a projeção do fim`} onFechar={app.fecharPainel} />
      <div className="sim-atual" id="sim-atual">
        <div>
          <span className="sim-rot">Hoje ({dataBr(dataAtual())})</span>
          <div className="card">
            {real.filter((r) => D.CL[r.k]).map((r, i) => (
              <div className={"sim-linha" + (r.k === k ? " meu" : "")} key={r.k}>
                <span className="sim-n">{i + 1}</span><Escudo k={r.k} z={20} /><span className="sim-nome">{nomeClube(r.k)}</span>
                <span className="num mute">{r.j}j</span><b className="num">{r.pts}</b>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="sim-rot">Projeção do fim <span className="sim-selo sim-selo-proj">projeção</span></span>
          <div className="card">
            {A.linhas.map(([x, pts, j], i) => {
              const antes = real.findIndex((r) => r.k === x) + 1, mov = antes - (i + 1);
              return (
                <div className={"sim-linha" + (x === k ? " meu" : "")} key={x}>
                  <span className="sim-n">{i + 1}</span><Escudo k={x} z={20} /><span className="sim-nome">{nomeClube(x)}</span>
                  <span className={"num sim-mov-pos " + (mov > 0 ? "sobe" : mov < 0 ? "desce" : "mute")}>{mov > 0 ? "▲" + mov : mov < 0 ? "▼" + -mov : "="}</span>
                  <span className="num mute">{j}j</span><b className="num">{pts}</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="note" style={{ marginTop: 10 }}>A projeção joga só os jogos que faltam, com os elencos de hoje, e é ela que decide quem sobe e quem cai na composição da próxima temporada. ▲▼ = posições ganhas ou perdidas até o fim.</p>
    </>
  );
}

// ---------- Estatísticas ----------
// comp = "total" (todas as competições), "liga" ou o id de uma copa
function Estatisticas({ estado, k, plano, comp = "total" }) {
  const [parte, setParte] = useState("art");
  const linhas = useMemo(() => linhasEstatisticas(estado, plano, comp), [estado, plano, comp]);
  if (!estado.dataAtual) return <div className="card"><div className="empty">Simule pelo menos uma rodada para ver as estatísticas.</div></div>;
  if (!linhas.length) return <div className="card"><div className="empty">Ainda não houve jogos nesta competição.</div></div>;
  const min = minimoJogos(estado, comp);
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
// c = competição ("liga" ou o id da copa), r = rodada dela, d = data no calendário integrado
function AoVivo({ estado, c = "liga", r, d, plano, k, onSair, onProxima }) {
  const jogos = resultadosDe(estado, c)[r] || [];
  const i = jogos.findIndex((j) => j[0] === k || j[1] === k);
  const meu = i >= 0 ? jogos[i] : null;
  const lances = useMemo(() => (i >= 0 ? narracao(estado, plano, r, i, c) : []), [r, c]); // eslint-disable-line
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
  const ultimaRodada = !proximoJogo(estado, k); // o clube não tem mais jogos na temporada

  return (
    <div id="sim-ao-vivo">
      <div className="av-placar" style={meu ? { "--ca": D.CL[meu[0]]?.c || "#444", "--cb": D.CL[meu[1]]?.c || "#444" } : undefined}>
        <span className="av-rot">{c === "liga" ? `${nomeDaRodada(estado, r)} · ${rotuloLiga(estado.liga)}` : nomeDaData(estado, d)}</span>
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
              {!ultimaRodada ? <button className="btn pri" id="av-proxima" onClick={onProxima}>{rotuloProximo(estado, k)}</button>
                : <button className="btn pri" id="av-fim" onClick={() => onSair("resumo")}>Ver o fim da temporada</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
