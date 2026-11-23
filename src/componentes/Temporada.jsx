// Aba Temporada: simulador da próxima temporada da liga (versão 1: só a liga, sem copas, lesões ou suspensões;
// os outros clubes não contratam). Lógica em src/logica/simulacao/; o estado fica em "plantel:sim".
//   Visão geral  antes da temporada (composição, pendências, previsão), durante (sua campanha) ou o fim (campeão, faixas, seleção)
//   Tabela       classificação ao vivo, com as faixas coloridas e os últimos 5 resultados
//   Rodadas      todos os placares de cada rodada; o seu jogo em destaque, com gols e assistências
//   Estatísticas artilharia, assistências, melhores notas e os números do seu clube
import { useEffect, useMemo, useState } from "react";
import { D } from "../logica/dados.js";
import { rotuloVaga } from "../logica/compatibilidade.js";
import { corDoSetor } from "../logica/constantes.js";
import { short } from "../logica/formato.js";
import { Escudo, LogoLiga } from "./Imagens.jsx";
import { Pos } from "./Jogador.jsx";
import { idPar, opcoesDaPendencia, pares, rotuloLiga, temporadaAtual, vagasDaPendencia, zonasDaLiga } from "../logica/simulacao/composicao.js";
import { escalarClube } from "../logica/simulacao/escalar.js";
import {
  assinaturaDoPlano, calendarioDe, criarEstado, jogadorSim, lerSim, linhasEstatisticas, minimoJogos, nomeClube, salvarSim,
  selecaoDaTemporada, simularAte, tabelaAtual,
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

export default function Temporada({ app }) {
  const { plano } = app;
  const k = plano.club;
  const assinatura = assinaturaDoPlano(plano);
  const [estado, setEstado] = useState(() => carregar(plano));
  const [vista, setVista] = useState(() => (estado.rodadaAtual > 0 ? "tabela" : "geral"));
  const cal = useMemo(() => calendarioDe(estado), [estado.semente, estado.composicao]); // eslint-disable-line
  const total = cal.length;
  const tabela = useMemo(() => tabelaAtual(estado), [estado]);
  const fim = estado.rodadaAtual >= total;

  const guardar = (e) => { salvarSim(k, e); setEstado(e); };
  // Refaz a temporada antes de começar (mesma semente: as pendências e a previsão só mudam pelo que foi mexido)
  const refazer = (mudar = {}) => guardar(criarEstado(plano, { semente: estado.semente, escolhas: estado.escolhas, substitui: estado.substitui, ...mudar }));
  const simular = (ate) => guardar(simularAte(estado, plano, ate));
  const reSimular = () => { guardar(criarEstado(plano, { escolhas: estado.escolhas, substitui: estado.substitui })); setVista("geral"); app.aviso("Nova semente: temporada reiniciada"); };
  const reiniciar = () => { refazer(); setVista("geral"); };
  const continuar = () => guardar({ ...estado, assinatura });

  // Antes da 1ª rodada, se o plano mudou (contratou, vendeu, mexeu no time), a previsão é refeita na hora
  useEffect(() => {
    if (estado.rodadaAtual === 0 && estado.assinatura !== assinatura) refazer();
  }, [assinatura]); // eslint-disable-line

  const mudou = estado.rodadaAtual > 0 && estado.assinatura !== assinatura;
  const pos = tabela.findIndex((l) => l.k === k) + 1;
  const status = estado.rodadaAtual === 0 ? `Antes da temporada · ${total} rodadas`
    : fim ? `Temporada encerrada · campeão: ${nomeClube(tabela[0].k)}`
      : `Rodada ${estado.rodadaAtual} de ${total} · ${nomeClube(k)} em ${pos}º`;
  const VISTAS = [["geral", estado.rodadaAtual === 0 ? "Antes da temporada" : fim ? "Fim da temporada" : "Visão geral"], ["tabela", "Tabela"], ["rodadas", "Rodadas"], ["estat", "Estatísticas"]];

  return (
    <section className="panel on" id="p-temporada">
      <div className="card sim-cab">
        <LogoLiga k={estado.liga} z={44} />
        <div className="sim-cab-txt">
          <b id="sim-liga">{rotuloLiga(estado.liga)}</b>
          <span id="sim-status">{status}</span>
        </div>
      </div>

      {estado.avisos?.map((t) => <p className="sim-aviso" key={t}>{t}</p>)}
      {mudou && (
        <div className="sim-aviso sim-mudou" id="sim-mudou" role="alert">
          <span>Seu elenco mudou — reiniciar a temporada?</span>
          <span className="sim-mudou-bts">
            <button className="btn pri" id="sim-reiniciar" onClick={reiniciar}>Reiniciar</button>
            <button className="btn" id="sim-continuar" onClick={continuar}>Continuar assim</button>
          </span>
        </div>
      )}

      {!fim ? <Controles estado={estado} total={total} simular={simular} reSimular={reSimular} />
        : <div className="sim-ctrl"><button className="btn pri" id="sim-de-novo" onClick={reSimular}>Simular de novo</button><button className="btn" onClick={() => setVista("tabela")}>Ver tabela</button></div>}

      <div className="chips sim-vistas" role="group" aria-label="Partes da temporada">
        {VISTAS.map(([v, nome]) => <button key={v} id={"sv-" + v} aria-pressed={vista === v} onClick={() => setVista(v)}>{nome}</button>)}
      </div>

      {vista === "geral" && (estado.rodadaAtual === 0 ? <Antes estado={estado} k={k} refazer={refazer} app={app} />
        : fim ? <Fim estado={estado} tabela={tabela} k={k} plano={plano} /> : <Andamento estado={estado} tabela={tabela} k={k} cal={cal} />)}
      {vista === "tabela" && <Tabela estado={estado} tabela={tabela} k={k} />}
      {vista === "rodadas" && <Rodadas estado={estado} cal={cal} k={k} plano={plano} />}
      {vista === "estat" && <Estatisticas estado={estado} k={k} plano={plano} />}
    </section>
  );
}

// ---------- Botões de simular ----------
function Controles({ estado, total, simular, reSimular }) {
  const [ate, setAte] = useState("");
  const alvo = Math.min(total, Math.max(estado.rodadaAtual + 1, parseInt(ate, 10) || 0));
  return (
    <div className="sim-ctrls">
      <div className="sim-ctrl">
        <button className="btn pri" id="sim-prox" onClick={() => simular(estado.rodadaAtual + 1)}>Simular próxima rodada</button>
        <button className="btn" id="sim-fim" onClick={() => simular(total)}>Simular até o fim</button>
      </div>
      <div className="sim-ate">
        <label htmlFor="sim-ate-n">Simular até a rodada</label>
        <input id="sim-ate-n" className="num" type="number" inputMode="numeric" min={estado.rodadaAtual + 1} max={total} placeholder={String(Math.min(total, estado.rodadaAtual + 5))}
          value={ate} onChange={(e) => setAte(e.target.value)} />
        <button className="btn" id="sim-ate" onClick={() => { simular(ate ? alvo : Math.min(total, estado.rodadaAtual + 5)); setAte(""); }}>Simular</button>
        <button className="btn sim-resim" id="sim-resimular" onClick={reSimular} title="Troca a semente do sorteio e começa de novo">Re-simular</button>
      </div>
    </div>
  );
}

// Selo de como o clube mudou de liga
function SeloMov({ x }) {
  if (x.confirmado) return <span className="sim-selo ok">confirmado</span>;
  if (x.projecao) return <span className="sim-selo proj">projeção</span>;
  if (x.escolhido) return <span className="sim-selo esc">escolhido</span>;
  return <span className="sim-selo">simulado</span>;
}
const textoMov = (x, entra) => {
  if (!x.para) return "deixa o site";
  if (entra) return (x.tipo === "acesso" ? "subiu da " : "caiu da ") + D.LG[x.de].n;
  return (x.tipo === "acesso" ? "sobe para a " : "cai para a ") + D.LG[x.para].n;
};

// ---------- Antes da temporada ----------
function Antes({ estado, k, refazer, app }) {
  const { composicao: comp, previsao, liga } = estado;
  const meu = previsao[k];
  const temQueda = Object.values(previsao).some((x) => x.queda > 0), temAcesso = Object.values(previsao).some((x) => x.acesso > 0);
  const ordem = Object.entries(previsao).sort((a, b) => a[1].pos - b[1].pos);
  const criado = !!D.CL[k]?.criado;
  // Pendências: Simular (padrão) ou Escolher
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

  return (
    <>
      {meu && (
        <p className="sim-destaque" id="sim-prev-meu">
          <Escudo k={k} z={28} />
          <span><b>{nomeClube(k)}</b> · previsão: <b>{Math.round(meu.pos)}º</b>; chance de título {pct(meu.titulo)}
            {temQueda && <>; risco de queda {pct(meu.queda)}</>}{temAcesso && <>; chance de acesso {pct(meu.acesso)}</>}</span>
        </p>
      )}

      {criado && <Substituto estado={estado} k={k} refazer={refazer} />}

      <div className="sec" id="sim-composicao">
        <h2><span>Composição da {rotuloLiga(liga)}</span><span>{comp.clubes.length} clubes</span></h2>
        <div className="card">
          {[...comp.entram.map((x) => [x, true]), ...comp.saem.map((x) => [x, false])].map(([x, entra]) => (
            <div className="kv sim-comp" key={(entra ? "e" : "s") + x.k}>
              <Escudo k={x.k} z={26} />
              <span className="sim-comp-txt">
                <b className="sim-nome">{nomeClube(x.k)}</b>
                <span className="sim-mov"><span className={x.tipo === "acesso" ? "sobe" : "desce"}>{textoMov(x, entra)}</span><SeloMov x={x} /></span>
              </span>
            </div>
          ))}
          {comp.substituido && (
            <div className="kv sim-comp">
              <Escudo k={k} z={26} />
              <span className="sim-comp-txt"><b className="sim-nome">{nomeClube(k)}</b><span className="sim-mov">entra no lugar do {nomeClube(comp.substituido)}</span></span>
            </div>
          )}
          {!comp.entram.length && !comp.saem.length && !comp.substituido && <div className="empty" style={{ padding: 16 }}>Mesmos clubes da temporada atual.</div>}
        </div>
      </div>

      {Object.keys(estado.pendenciasResolvidas).length > 0 && (
        <div className="sec" id="sim-pendencias">
          <h2><span>Vagas em aberto</span><span>resolvidas uma vez por simulação</span></h2>
          {Object.entries(estado.pendenciasResolvidas).map(([id, r]) => {
            const par = pares().find((p) => idPar(p) === id);
            return par && <Pendencia key={id} par={par} r={r} esc={estado.escolhas[id]} onModo={(m) => mudarModo(par, r, m)} onMarcar={(x) => marcar(par, x)} />;
          })}
        </div>
      )}

      <div className="sec" id="sim-previsao">
        <h2><span>Previsão</span><span>média de 300 simulações</span></h2>
        <div className="card">
          {ordem.map(([c, x], i) => (
            <div className={"kv sim-prev" + (c === k ? " meu" : "")} key={c}>
              <span className="kv-nome"><span className="sim-n">{i + 1}</span><Escudo k={c} z={22} /><span className="sim-nome">{nomeClube(c)}</span></span>
              <span className="num sim-prev-n"><span title="posição média">{dec(x.pos)}º</span><span title="chance de título">{pct(x.titulo)}</span>
                {temQueda && <span className="desce" title="risco de queda">{pct(x.queda)}</span>}{temAcesso && <span className="sobe" title="chance de acesso">{pct(x.acesso)}</span>}</span>
            </div>
          ))}
        </div>
        <p className="note sim-leg">Posição média · chance de título{temQueda ? " · risco de queda" : ""}{temAcesso ? " · chance de acesso" : ""}. Força = média de overall dos 11 (com o banco).</p>
      </div>
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
    <label className="field" id="sim-subst">Seu time entra no lugar de
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
        {par.modo === "projecao" && <span className="sim-selo proj">projeção</span>}
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
              {duelo.map((x) => (
                <button key={x} className="sim-op" aria-pressed={sel.includes(x)} onClick={() => onMarcar(x)}><Escudo k={x} z={20} /><span>{nomeClube(x)}</span></button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="sim-opcoes">
          {opcoes.map((x) => (
            <button key={x} className="sim-op" aria-pressed={sel.includes(x)} onClick={() => onMarcar(x)}><Escudo k={x} z={20} /><span>{nomeClube(x)}</span></button>
          ))}
        </div>
      )}
      {r.modo === "escolher" && (
        <p className="note sim-conta">{par.pendentes?.playoffs ? "Marque o vencedor de cada confronto" : `Marque ${vagas}`}: {Math.min(sel.length, vagas)}/{vagas}
          {r.incompleto && <> · o que falta vem da simulação ({r.movem.filter((x) => !sel.includes(x)).map(nomeClube).join(", ")})</>}</p>
      )}
    </div>
  );
}

// ---------- Durante a temporada ----------
function Andamento({ estado, tabela, k, cal }) {
  const i = tabela.findIndex((l) => l.k === k), l = tabela[i];
  const prox = cal[estado.rodadaAtual]?.find(([c, f]) => c === k || f === k);
  const prev = estado.previsao[k];
  return (
    <div className="sec" id="sim-andamento">
      <div className="card sim-meu">
        <div className="sim-meu-pos"><b className="num">{i + 1}º</b><span>lugar</span></div>
        <div className="sim-meu-txt">
          <b>{nomeClube(k)}</b>
          <span className="num">{l.pts} pontos · {l.v}V {l.e}E {l.d}D · saldo {sinal(l.gp - l.gc)}</span>
          <span className="sim-ult">{l.ultimos.slice(-5).map((r, j) => <i key={j} className={"r-" + r}>{r}</i>)}</span>
          {prev && <span className="mute">Previsão antes da temporada: {Math.round(prev.pos)}º</span>}
        </div>
      </div>
      {prox && (
        <p className="sim-prox-jogo" id="sim-prox-jogo">Próximo jogo (rodada {estado.rodadaAtual + 1}): <b>{nomeClube(prox[0])} × {nomeClube(prox[1])}</b>{prox[0] === k ? " · em casa" : " · fora"}</p>
      )}
      {!prox && <p className="sim-prox-jogo">Seu clube folga na rodada {estado.rodadaAtual + 1}.</p>}
      <TabelaCurta tabela={tabela} k={k} zonas={zonasDaLiga(estado.liga, tabela.length)} />
    </div>
  );
}

// Os 5 primeiros e a vizinhança do seu clube
function TabelaCurta({ tabela, k, zonas }) {
  const i = tabela.findIndex((l) => l.k === k);
  const mostra = new Set([0, 1, 2, 3, 4, i - 1, i, i + 1].filter((x) => x >= 0 && x < tabela.length));
  return (
    <div className="card">
      {[...mostra].sort((a, b) => a - b).map((j, n, arr) => (
        <div className={"kv sim-linha" + (tabela[j].k === k ? " meu" : "") + (n > 0 && j - arr[n - 1] > 1 ? " sim-salto" : "")} key={tabela[j].k}>
          <span className="kv-nome"><span className="sim-n" style={{ "--z": zonas[j]?.cor || "transparent" }}>{j + 1}</span><Escudo k={tabela[j].k} z={22} /><span className="sim-nome">{nomeClube(tabela[j].k)}</span></span>
          <span className="num"><b>{tabela[j].pts}</b> <span className="mute">pts</span></span>
        </div>
      ))}
    </div>
  );
}

// ---------- Fim da temporada ----------
function Fim({ estado, tabela, k, plano }) {
  const zonas = zonasDaLiga(estado.liga, tabela.length);
  const campeao = tabela[0];
  // Faixas na ordem da tabela: { nome, cor, clubes }
  const faixas = [];
  zonas.forEach((z, i) => {
    if (!z) return;
    let f = faixas.find((x) => x.nome === z.nome);
    if (!f) faixas.push((f = { ...z, clubes: [] }));
    f.clubes.push({ k: tabela[i].k, pos: i + 1 });
  });
  const selecao = selecaoDaTemporada(estado, plano);
  const i = tabela.findIndex((l) => l.k === k), prev = estado.previsao[k];
  return (
    <div id="sim-fim-temporada">
      <div className="card sim-campeao" id="sim-campeao">
        <Escudo k={campeao.k} z={56} />
        <div><small>Campeão da {rotuloLiga(estado.liga)}</small><b>{nomeClube(campeao.k)}</b><span className="num">{campeao.pts} pontos · {campeao.v} vitórias</span></div>
      </div>

      {prev && (
        <div className="sec" id="sim-prev-res">
          <h2><span>Previsão × resultado</span><span>{nomeClube(k)}</span></h2>
          <div className="card">
            <div className="kv"><span>Previsão (média de 300 simulações)</span><span className="num">{dec(prev.pos)}º</span></div>
            <div className="kv tot"><span>Resultado</span><span className="num">{i + 1}º · {tabela[i].pts} pontos</span></div>
            <div className="kv"><span>{i + 1 < Math.round(prev.pos) ? "Acima do esperado" : i + 1 > Math.round(prev.pos) ? "Abaixo do esperado" : "Dentro do esperado"}</span>
              <span className={"num " + (i + 1 < Math.round(prev.pos) ? "sobe" : i + 1 > Math.round(prev.pos) ? "desce" : "mute")}>{sinal(Math.round(prev.pos) - (i + 1))} posições</span></div>
          </div>
        </div>
      )}

      {faixas.map((f) => (
        <div className="sec sim-faixa" key={f.nome}>
          <h2><span><i className="ponto" style={{ background: f.cor }}></i>{f.nome}</span><span>{f.clubes.length}</span></h2>
          <div className="card">
            {f.clubes.map((c) => (
              <div className={"kv" + (c.k === k ? " meu" : "")} key={c.k}>
                <span className="kv-nome"><span className="sim-n">{c.pos}</span><Escudo k={c.k} z={22} /><span className="sim-nome">{nomeClube(c.k)}</span></span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="sec" id="sim-selecao">
        <h2><span>Seleção da temporada (4-3-3)</span><span>melhores notas</span></h2>
        <div className="card">
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
      </div>
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
                <td className="ult"><span className="sim-ult">{l.ultimos.slice(-5).map((r, j) => <i key={j} className={"r-" + r}>{r}</i>)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legenda.length > 0 && (
        <div className="sim-legenda" id="sim-legenda">{legenda.map((z) => <span key={z.nome}><i style={{ background: z.cor }}></i>{z.nome}</span>)}</div>
      )}
    </>
  );
}

// ---------- Rodadas ----------
function Rodadas({ estado, cal, k, plano }) {
  const [r, setR] = useState(() => Math.max(0, Math.min(cal.length - 1, estado.rodadaAtual - 1)));
  const jogada = r < estado.rodadaAtual;
  const jogos = jogada ? estado.resultados[r] : cal[r].map(([c, f]) => [c, f, null, null, []]);
  const meu = jogos.find((j) => j[0] === k || j[1] === k);
  const outros = jogos.filter((j) => j !== meu);
  return (
    <div id="sim-rodadas">
      <div className="sim-nav">
        <button className="btn" id="rod-ant" aria-label="Rodada anterior" disabled={r === 0} onClick={() => setR(r - 1)}>‹</button>
        <b id="rod-n">Rodada {r + 1} de {cal.length}</b>
        <button className="btn" id="rod-prox" aria-label="Próxima rodada" disabled={r >= cal.length - 1} onClick={() => setR(r + 1)}>›</button>
      </div>
      {!jogada && <p className="note" style={{ textAlign: "center" }}>Rodada ainda não jogada.</p>}
      {meu ? <JogoMeu jogo={meu} plano={plano} /> : <p className="note">Seu clube folga nesta rodada.</p>}
      <div className="card">
        {outros.map(([c, f, gc, gf]) => (
          <div className="sim-jogo" key={c + f}>
            <span className="c"><span className="sim-nome">{nomeClube(c)}</span><Escudo k={c} z={20} /></span>
            <b className="num">{gc ?? ""} × {gf ?? ""}</b>
            <span className="f"><Escudo k={f} z={20} /><span className="sim-nome">{nomeClube(f)}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JogoMeu({ jogo, plano }) {
  const [c, f, gc, gf, eventos] = jogo;
  const lado = (l) => eventos.filter((e) => e[1] === l);
  const Evento = ({ e }) => <li><span className="num mute">{e[0]}'</span> {nomeJog(plano, e[2])}{e[3] ? <span className="mute"> (assist. {nomeJog(plano, e[3])})</span> : null}</li>;
  return (
    <div className="card sim-jogo-meu" id="sim-jogo-meu">
      <div className="sim-placar">
        <span className="c"><Escudo k={c} z={36} /><span className="sim-nome">{nomeClube(c)}</span></span>
        <b className="num">{gc ?? ""} × {gf ?? ""}</b>
        <span className="f"><Escudo k={f} z={36} /><span className="sim-nome">{nomeClube(f)}</span></span>
      </div>
      {eventos.length > 0 && (
        <div className="sim-gols">
          <ul>{lado(0).map((e, i) => <Evento key={i} e={e} />)}</ul>
          <ul>{lado(1).map((e, i) => <Evento key={i} e={e} />)}</ul>
        </div>
      )}
    </div>
  );
}

// ---------- Estatísticas ----------
function Estatisticas({ estado, k, plano }) {
  const linhas = useMemo(() => linhasEstatisticas(estado, plano), [estado, plano]);
  if (!estado.rodadaAtual) return <div className="card"><div className="empty">Simule pelo menos uma rodada para ver as estatísticas.</div></div>;
  const min = minimoJogos(estado);
  const art = linhas.filter((x) => x.g > 0).sort((a, b) => b.g - a.g || a.j - b.j).slice(0, 10);
  const ass = linhas.filter((x) => x.a > 0).sort((a, b) => b.a - a.a || a.j - b.j).slice(0, 10);
  const notas = linhas.filter((x) => x.j >= min).sort((a, b) => b.nota - a.nota).slice(0, 10);
  const meus = linhas.filter((x) => x.k === k).sort((a, b) => b.j - a.j || b.nota - a.nota);
  const Lista = ({ id, titulo, lista, valor, extra }) => (
    <div className="sec" id={id}>
      <h2><span>{titulo}</span>{extra && <span>{extra}</span>}</h2>
      <div className="card">
        {lista.length ? lista.map((x, i) => (
          <div className={"kv" + (x.k === k ? " meu" : "")} key={x.id}>
            <span className="kv-nome"><span className="sim-n">{i + 1}</span><Escudo k={x.k} z={20} /><Pos pos={x.p.pos} /><span className="sim-nome">{x.p.n}</span></span>
            <b className="num">{valor(x)}</b>
          </div>
        )) : <div className="empty" style={{ padding: 16 }}>Ninguém ainda.</div>}
      </div>
    </div>
  );
  return (
    <>
      <Lista id="sim-artilharia" titulo="Artilharia" lista={art} valor={(x) => x.g} />
      <Lista id="sim-assist" titulo="Assistências" lista={ass} valor={(x) => x.a} />
      <Lista id="sim-notas" titulo="Melhores notas" extra={`mínimo de ${min} ${min > 1 ? "jogos" : "jogo"}`} lista={notas} valor={(x) => dec(x.nota, 2)} />
      <div className="sec" id="sim-meu-clube">
        <h2><span>{nomeClube(k)}</span><span>J · G · A · nota</span></h2>
        <div className="card">
          {meus.map((x) => (
            <div className="kv" key={x.id}>
              <span className="kv-nome"><Pos pos={x.p.pos} /><span className="sim-nome">{x.p.n}</span></span>
              <span className="num sim-st"><span>{x.j}</span><span>{x.g}</span><span>{x.a}</span><b>{dec(x.nota, 2)}</b></span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
