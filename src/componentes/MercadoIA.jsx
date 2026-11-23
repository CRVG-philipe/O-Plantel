// Aba "Mercado" do simulador: a janela de transferências dos clubes da IA (lógica em src/logica/simulacao/mercadoIA.js).
//   Interruptores   "Clubes da IA contratam", "Receber propostas", "Janela do meio" e "Evolução dos jogadores"
//                   (só antes da 1ª data; depois, "Recomeçar" no "⋯" volta ao início)
//   Propostas       até 3 propostas pelos jogadores do seu plano: Aceitar (vira uma venda no plano), Recusar ou
//                   Contraproposta (+20%; a IA aceita metade das vezes)
//   Transferências  lista com filtro por tipo, liga e clube; os rivais (clubes da sua liga) ficam destacados
//   Por clube       quem chegou e quem saiu de cada clube, e quanto ele gastou
import { useMemo, useState } from "react";
import { D } from "../logica/dados.js";
import { dinheiro } from "../logica/dinheiro.js";
import { short } from "../logica/formato.js";
import { novaSemente, rngDe } from "../logica/simulacao/aleatorio.js";
import { difsDoMercado, listaTransferencias } from "../logica/simulacao/mercadoIA.js";
import { nomeClube } from "../logica/simulacao/temporada.js";
import { Escudo } from "./Imagens.jsx";
import { Avatar, Ovr, Pos } from "./Jogador.jsx";

const INTERRUPTORES = [
  ["ativo", "Clubes da IA contratam", "Antes da temporada, os outros clubes renovam contratos, contratam e dispensam. Desligado, eles jogam com o elenco de hoje."],
  ["propostas", "Receber propostas", "Clubes da IA podem fazer até 3 propostas pelos seus jogadores. Você decide."],
  ["meio", "Janela do meio", "Mais uma janela de compras, que vale a partir da metade da temporada."],
  ["evolucao", "Evolução dos jogadores", "Jovens sobem até 3 de overall, veteranos caem. Só dentro do simulador."],
];
// Categorias da lista: compra; livre (assinou sem custo); saída (aposentadoria, dispensa ou contrato acabou sem clube novo)
const categoria = (t) => (t.tipo === "c" ? "compras" : t.tipo === "r" ? "ren" : t.tipo === "l" && t.para ? "livres" : "saidas");
const CATEGORIAS = [["compras", "Compras"], ["livres", "Livres"], ["saidas", "Saídas"], ["ren", "Renovações"]];
function rotuloTipo(t) {
  if (t.tipo === "c") return "compra";
  if (t.tipo === "r") return "renovação";
  if (t.tipo === "a") return "aposentadoria";
  if (t.tipo === "d") return "dispensa";
  return t.para ? "livre" : "sem clube";
}
const POR_PAGINA = 60;

export default function MercadoIA({ estado, k, plano, app, refazer, atualizar, aberto }) {
  const m = estado.mercadoIA, op = estado.mercadoOpcoes || {};
  const rivais = useMemo(() => new Set(estado.composicao.clubes), [estado.composicao]);
  const todas = useMemo(() => listaTransferencias(m), [m]);
  const [cat, setCat] = useState("compras");
  const [liga, setLiga] = useState("_rivais");
  const [clube, setClube] = useState("");
  const [n, setN] = useState(POR_PAGINA);

  const ligaDe = (x) => (rivais.has(x) ? estado.liga : D.CL[x]?.lg);
  const naLiga = (t) => liga === "" || [t.de, t.para].some((x) => x && (liga === "_rivais" ? rivais.has(x) : ligaDe(x) === liga));
  const doClube = (t) => !clube || t.de === clube || t.para === clube;
  const lista = todas.filter((t) => categoria(t) === cat && naLiga(t) && doClube(t));
  const ligas = useMemo(() => [...new Set(todas.flatMap((t) => [t.de, t.para]).filter((x) => x && D.CL[x]).map(ligaDe))].filter(Boolean)
    .sort((a, b) => D.LG[a].n.localeCompare(D.LG[b].n)), [todas]); // eslint-disable-line
  const clubesDaLista = useMemo(() => [...new Set(todas.filter(naLiga).flatMap((t) => [t.de, t.para]).filter((x) => x && D.CL[x] && x !== k))]
    .sort((a, b) => nomeClube(a).localeCompare(nomeClube(b))), [todas, liga]); // eslint-disable-line
  const contar = (c) => todas.filter((t) => categoria(t) === c && naLiga(t) && doClube(t)).length;

  const mudarOpcao = (chave) => refazer({ mercadoOpcoes: { ...op, [chave]: !op[chave] } });
  const refazerMercado = () => { refazer({ mercadoSemente: novaSemente() }); app.aviso("Mercado sorteado de novo"); };

  // Resumo da janela
  const compras = todas.filter((t) => t.tipo === "c" && !t.meio);
  const gasto = compras.reduce((s, t) => s + t.valor, 0);

  return (
    <>
      <section className="sec" id="sim-mercado">
        <h2><span>Mercado da IA</span><span>{m ? `${compras.length} compras · ${dinheiro(gasto)}` : "desligado"}</span></h2>
        <div className="card sim-ints">
          {INTERRUPTORES.map(([chave, nome, txt]) => {
            const desl = !aberto || (chave !== "ativo" && !op.ativo);
            return (
              <button key={chave} className="sim-int" id={"mi-" + chave} role="switch" aria-checked={!!op[chave]} disabled={desl} onClick={() => mudarOpcao(chave)}>
                <span className="sim-int-txt"><b>{nome}</b><small>{txt}</small></span>
                <span className="sim-int-bola" aria-hidden="true"><i></i></span>
              </button>
            );
          })}
          {aberto && op.ativo && (
            <div className="sim-mi-refazer">
              <button className="btn" id="mi-refazer" onClick={refazerMercado}>Refazer mercado</button>
              <span className="note">Sorteia outra janela (a temporada continua a mesma).</span>
            </div>
          )}
          {!aberto && <p className="note sim-mi-nota">A temporada já começou: para mudar o mercado, use "Recomeçar" no "⋯".</p>}
        </div>
      </section>

      {m && op.propostas && <Propostas estado={estado} plano={plano} app={app} atualizar={atualizar} aberto={aberto} />}

      {m && (
        <>
          <section className="sec" id="sim-transf">
            <h2><span>Transferências</span><span>{lista.length}</span></h2>
            <div className="sim-mi-filtros">
              <div className="seg sim-mi-cats" role="group" aria-label="Tipo">
                {CATEGORIAS.map(([c, nome]) => (
                  <button key={c} id={"mic-" + c} aria-pressed={cat === c} onClick={() => { setCat(c); setN(POR_PAGINA); }}>{nome} <span className="num">{contar(c)}</span></button>
                ))}
              </div>
              <div className="sim-mi-sels">
                <select id="mi-liga" aria-label="Liga" value={liga} onChange={(e) => { setLiga(e.target.value); setClube(""); setN(POR_PAGINA); }}>
                  <option value="_rivais">Rivais ({D.LG[estado.liga].n})</option>
                  <option value="">Todas as ligas</option>
                  {ligas.map((lg) => <option key={lg} value={lg}>{D.LG[lg].n}</option>)}
                </select>
                <select id="mi-clube" aria-label="Clube" value={clube} onChange={(e) => { setClube(e.target.value); setN(POR_PAGINA); }}>
                  <option value="">Todos os clubes</option>
                  {clubesDaLista.map((x) => <option key={x} value={x}>{nomeClube(x)}</option>)}
                </select>
              </div>
            </div>

            {clube && <PorClube estado={estado} x={clube} />}

            <div className="card sim-mi-lista" id="mi-lista">
              {lista.length ? lista.slice(0, n).map((t, i) => <Linha key={t.id + "|" + i} t={t} k={k} rivais={rivais} />)
                : <div className="empty" style={{ padding: 16 }}>Nenhuma transferência com esses filtros.</div>}
            </div>
            {lista.length > n && <button className="btn sim-mi-mais" id="mi-mais" onClick={() => setN(n + POR_PAGINA)}>Ver mais ({lista.length - n})</button>}
            <p className="note sim-leg">Destacados: clubes da sua liga. Preço = valor de mercado × 1,1 a 1,5. Só os clubes que jogam esta temporada (a sua liga e as copas) vão às compras; os outros só vendem.</p>
          </section>

          {!clube && liga === "_rivais" && <Rivais estado={estado} k={k} onClube={setClube} />}
        </>
      )}
    </>
  );
}

function Linha({ t, k, rivais }) {
  const destaque = [t.de, t.para].some((x) => x && rivais.has(x)), meu = t.de === k || t.para === k;
  const valor = t.tipo === "c" || (t.tipo === "l" && t.valor > 0) ? dinheiro(t.valor) : "";
  return (
    <div className={"sim-mi-linha" + (destaque ? " sim-mi-rival" : "") + (meu ? " meu" : "")}>
      <Avatar p={t.p} z={36} />
      <span className="sim-mi-jog">
        <b className="sim-nome">{short(t.p.n)}</b>
        <span className="sim-mi-sub"><Pos pos={t.p.pos} /><Ovr p={t.p} /><span className="mute">{t.p.a} anos</span></span>
      </span>
      <span className="sim-mi-rota">
        {t.de && D.CL[t.de] ? <Escudo k={t.de} z={20} /> : <span className="sim-mi-sem">livre</span>}
        {t.tipo !== "r" && (
          <>
            <span className="sim-mi-seta" aria-hidden="true">→</span>
            {t.para && D.CL[t.para] ? <Escudo k={t.para} z={20} /> : <span className="sim-mi-sem">{t.tipo === "a" ? "fim" : "sem clube"}</span>}
          </>
        )}
      </span>
      <span className="sim-mi-valor">
        {valor && <b className="num">{valor}</b>}
        <small>{rotuloTipo(t)}{t.meio ? " · meio" : ""}</small>
      </span>
    </div>
  );
}

// Chegadas e saídas de um clube (pré-temporada e, se houver, janela do meio)
function PorClube({ estado, x }) {
  const m = estado.mercadoIA, dif = difsDoMercado(m, m.meio ? "meio" : "inicio")[x], g = m.gastos[x];
  const nomes = (ids) => [...(ids || [])].map((id) => D.BYID[id]).filter(Boolean).sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
  const Lista = ({ ps }) => (ps.length ? ps.map((p) => (
    <div className="sim-mi-mini" key={p.id}><Avatar p={p} z={26} /><span className="sim-nome">{short(p.n)}</span><Pos pos={p.pos} /><Ovr p={p} /></div>
  )) : <p className="note">Ninguém.</p>);
  return (
    <div className="sim-mi-clube" id="mi-por-clube">
      <div className="sim-mi-clube-cab">
        <Escudo k={x} z={30} /><b>{nomeClube(x)}</b>
        {g && <span className="note">gastou {dinheiro(g[1])} de {dinheiro(g[0])}{g[2] ? ` · vendeu ${dinheiro(g[2])}` : ""}</span>}
      </div>
      <div className="sim-mov-grade">
        <div className="card"><div className="sim-mov-tit">Chegaram <span>{dif?.e.size || 0}</span></div><Lista ps={nomes(dif?.e)} /></div>
        <div className="card"><div className="sim-mov-tit">Saíram <span>{dif?.s.size || 0}</span></div><Lista ps={nomes(dif?.s)} /></div>
      </div>
    </div>
  );
}

// Clubes da sua liga: quantos chegaram e saíram e quanto gastaram (tocar mostra o clube)
function Rivais({ estado, k, onClube }) {
  const m = estado.mercadoIA, difs = difsDoMercado(m, m.meio ? "meio" : "inicio");
  const clubes = estado.composicao.clubes.filter((x) => x !== k).sort((a, b) => (m.gastos[b]?.[1] || 0) - (m.gastos[a]?.[1] || 0));
  return (
    <section className="sec" id="sim-mi-rivais">
      <h2><span>Seus rivais</span><span>chegaram · saíram · gasto</span></h2>
      <div className="card">
        {clubes.map((x) => (
          <button className="sim-mi-rival-l" key={x} onClick={() => { onClube(x); setTimeout(() => document.querySelector("#sim-transf")?.scrollIntoView?.({ block: "start" }), 0); }}>
            <Escudo k={x} z={22} />
            <span className="sim-nome">{nomeClube(x)}</span>
            <span className="num sobe">+{difs[x]?.e.size || 0}</span>
            <span className="num desce">−{difs[x]?.s.size || 0}</span>
            <span className="num sim-mi-gasto">{dinheiro(m.gastos[x]?.[1] || 0)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Propostas recebidas pelos jogadores do seu plano
function Propostas({ estado, plano, app, atualizar, aberto }) {
  const m = estado.mercadoIA, lista = (m.propostas || []).filter((x) => D.BYID[x.id] && !(plano.st || {})[x.id]);
  const responder = (x, resposta) => atualizar((e) => ({
    ...e, respostasMercado: { ...(e.respostasMercado || {}), [x.id + "|" + x.k]: resposta },
    mercadoIA: { ...e.mercadoIA, propostas: e.mercadoIA.propostas.filter((y) => !(y.id === x.id && y.k === x.k)) },
  }));
  const vender = (x, valor) => {
    const p = D.BYID[x.id];
    app.mudar((P) => { P.st[x.id] = { s: "vende", fee: valor, para: x.k }; });
    app.aviso(`${short(p.n)} vendido ao ${nomeClube(x.k)} por ${dinheiro(valor)}`);
  };
  const contra = (x) => {
    const valor = Math.round(x.valor * 1.2 * 10) / 10, p = D.BYID[x.id];
    if (rngDe(m.semente, "contra", x.id, x.k)() < 0.5) vender(x, valor);
    else { responder(x, "contra-recusada"); app.aviso(`O ${nomeClube(x.k)} não aceitou pagar ${dinheiro(valor)} por ${short(p.n)}`); }
  };
  return (
    <section className="sec" id="sim-propostas">
      <h2><span>Propostas recebidas</span><span>{lista.length}</span></h2>
      {!lista.length ? <div className="card"><div className="empty" style={{ padding: 16 }}>Nenhuma proposta pelos seus jogadores nesta janela.</div></div>
        : lista.map((x) => {
          const p = D.BYID[x.id];
          return (
            <div className="card sim-prop" key={x.id + "|" + x.k} id={"prop-" + x.id}>
              <div className="sim-prop-cab">
                <Avatar p={p} z={40} />
                <span className="sim-mi-jog"><b>{p.n}</b><span className="sim-mi-sub"><Pos pos={p.pos} /><Ovr p={p} /><span className="mute">valor {dinheiro(p.v)}</span></span></span>
              </div>
              <p className="sim-prop-txt"><Escudo k={x.k} z={22} /> <b>{nomeClube(x.k)}</b> oferece <b className="num">{dinheiro(x.valor)}</b></p>
              {aberto ? (
                <div className="acts sim-prop-bts">
                  <button className="btn pri" id={"prop-aceitar-" + x.id} onClick={() => vender(x, x.valor)}>Aceitar</button>
                  <button className="btn" id={"prop-recusar-" + x.id} onClick={() => responder(x, "recusada")}>Recusar</button>
                  <button className="btn" id={"prop-contra-" + x.id} onClick={() => contra(x)}>Pedir {dinheiro(Math.round(x.valor * 1.2 * 10) / 10)}</button>
                </div>
              ) : <p className="note">As propostas valiam só antes da 1ª rodada.</p>}
            </div>
          );
        })}
      {aberto && lista.length > 0 && <p className="note sim-leg">Aceitar vira uma venda no seu plano (o dinheiro entra no caixa). A contraproposta pede 20% a mais: o clube aceita metade das vezes.</p>}
    </section>
  );
}
