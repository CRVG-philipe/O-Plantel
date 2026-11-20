// O app depois que os dados carregaram: guarda o estado e as ações, e escolhe o que mostrar.
import { useEffect, useMemo, useRef, useState } from "react";
import { D } from "./logica/dados.js";
import { FILTROS_PADRAO } from "./logica/constantes.js";
import { lum } from "./logica/formato.js";
import { lerPlanos, salvarPlanos } from "./logica/armazenamento.js";
import { jogador, novoPlano } from "./logica/elenco.js";
import { escalarSozinho, completarTime } from "./logica/escalacao.js";
import Topo from "./componentes/Topo.jsx";
import EscolhaClube from "./componentes/EscolhaClube.jsx";
import Elenco from "./componentes/Elenco.jsx";
import Mercado from "./componentes/Mercado.jsx";
import Time from "./componentes/Time.jsx";
import Resumo from "./componentes/Resumo.jsx";
import Painel, { Congelado } from "./componentes/Painel.jsx";
import Rodape from "./componentes/Rodape.jsx";
import PainelJogador from "./componentes/paineis/PainelJogador.jsx";
import PainelCompra from "./componentes/paineis/PainelCompra.jsx";
import PainelFiltros from "./componentes/paineis/PainelFiltros.jsx";
import PainelCriar from "./componentes/paineis/PainelCriar.jsx";
import PainelClube from "./componentes/paineis/PainelClube.jsx";
import PainelOrcamento from "./componentes/paineis/PainelOrcamento.jsx";
import PainelPosicao from "./componentes/paineis/PainelPosicao.jsx";

const ABAS = { elenco: Elenco, mercado: Mercado, time: Time, resumo: Resumo };
const PAINEIS = { jogador: PainelJogador, compra: PainelCompra, filtros: PainelFiltros, criar: PainelCriar, clube: PainelClube, orcamento: PainelOrcamento, posicao: PainelPosicao };

// Clubes de uma liga em ordem alfabética
const clubesDa = (lg) => D.CLUBS.filter((c) => c.lg === lg).sort((a, b) => a.n.localeCompare(b.n));

// Pinta o destaque do site com a cor do clube (ou a 2ª cor, se a 1ª for clara demais)
function aplicarCor(k) {
  const r = document.documentElement.style;
  if (!k) { r.removeProperty("--ac"); r.removeProperty("--acInk"); return; }
  const c = D.CL[k];
  const a = lum(c.c) > 0.8 ? (lum(c.c2) > 0.8 ? "#222428" : c.c2) : c.c;
  r.setProperty("--ac", a);
  r.setProperty("--acInk", lum(a) > 0.6 ? "#151619" : "#fff");
}

export default function Plantel() {
  // ---------- estado ----------
  const [db, setDb] = useState(lerPlanos);       // tudo que está salvo no navegador
  const [aberto, setAberto] = useState(null);    // clube do plano aberto (null = tela de escolha)
  const [aba, setAba] = useState("elenco");
  // tela de escolha: começa na liga/clube do último plano aberto
  const [liga, setLiga] = useState(() => (db.last && D.CL[db.last] ? D.CL[db.last].lg : "BRA"));
  const [indice, setIndice] = useState(() => (db.last && D.CL[db.last] ? Math.max(0, clubesDa(D.CL[db.last].lg).findIndex((c) => c.k === db.last)) : 0));
  // mercado
  const [busca, setBusca] = useState("");
  const [chip, setChip] = useState(0);
  const [limite, setLimite] = useState(40);
  const [filtros, setFiltros] = useState(FILTROS_PADRAO);
  // painel e aviso (toast)
  const [painel, setPainel] = useState({ tipo: null, args: {}, chave: 0, aberto: false });
  const [aviso, setAviso] = useState({ texto: "", on: false });
  const timerAviso = useRef();

  const clubes = useMemo(() => clubesDa(liga), [liga]);
  const plano = aberto ? db.plans[aberto] : null;

  // ---------- ações ----------
  // Grava um plano (no estado e no navegador) e marca como o último aberto
  function gravar(p) {
    const novo = { ...db, plans: { ...db.plans, [p.club]: p }, last: p.club };
    setDb(novo);
    salvarPlanos(novo);
  }

  // Muda o plano aberto: trabalha numa cópia, completa o time se alguém saiu e grava
  function mudar(fn) {
    const p = structuredClone(plano);
    fn(p);
    completarTime(p);
    gravar(p);
  }

  const abrirPainel = (tipo, args = {}) => setPainel((x) => ({ tipo, args, chave: x.chave + 1, aberto: true }));
  const fecharPainel = () => setPainel((x) => ({ ...x, aberto: false }));

  function mostrarAviso(texto) {
    setAviso({ texto, on: true });
    clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso((a) => ({ ...a, on: false })), 1800);
  }

  function abrirClube(k) {
    const p = db.plans[k] ? structuredClone(db.plans[k]) : novoPlano(k);
    p.custom = p.custom || [];
    if (!Object.keys(p.xi).length) escalarSozinho(p);
    completarTime(p);
    gravar(p);
    setAberto(k);
    setAba("elenco");
    window.scrollTo(0, 0);
    if (p.budget === null) abrirPainel("orcamento", { primeiro: true });
  }

  // Volta para a tela de escolha, no clube que estava aberto
  function trocarClube() {
    fecharPainel();
    const k = aberto;
    setAberto(null);
    setLiga(D.CL[k].lg);
    setIndice(Math.max(0, clubesDa(D.CL[k].lg).findIndex((c) => c.k === k)));
    window.scrollTo(0, 0);
  }

  function reiniciarClube() {
    const p = novoPlano(aberto);
    escalarSozinho(p);
    gravar(p);
    setAba("elenco");
    mostrarAviso("Progresso do " + D.CL[aberto].n + " reiniciado");
    abrirPainel("orcamento", { primeiro: true });
  }

  // Jogador do próprio elenco abre "vender/emprestar"; de fora (ou contratado) abre "contratar"
  function abrirJogador(id) {
    abrirPainel(jogador(plano, id).club !== plano.club ? "compra" : "jogador", { id });
  }

  const irPara = (a) => { setAba(a); window.scrollTo(0, 0); };
  const escolherLiga = (lg) => { setLiga(lg); setIndice(0); };
  const passo = (d) => setIndice((i) => (i + d + clubes.length) % clubes.length);

  // ---------- efeitos ----------
  // Ao abrir o site: se havia um plano no último clube, abre direto nele
  useEffect(() => {
    if (db.last && D.CL[db.last] && db.plans[db.last]) abrirClube(db.last);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cor de destaque: do clube aberto ou do clube mostrado no carrossel
  const clubeDaCor = aberto || clubes[indice]?.k;
  useEffect(() => { aplicarCor(clubeDaCor); }, [clubeDaCor]);

  // Teclado: Esc fecha o painel; setas trocam de clube na tela de escolha
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") fecharPainel();
      if (aberto || painel.aberto) return;
      if (e.key === "ArrowRight") passo(1);
      if (e.key === "ArrowLeft") passo(-1);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  });

  // ---------- tela ----------
  // "app" é o pacote de dados e ações que cada componente recebe
  const app = {
    db, plano, aba, liga, indice, clubes, busca, chip, limite, filtros,
    setIndice, setBusca, setChip, setLimite, setFiltros,
    abrirClube, trocarClube, reiniciarClube, abrirJogador, abrirPainel, fecharPainel,
    mudar, irPara, escolherLiga, passo, aviso: mostrarAviso,
  };
  const Aba = ABAS[aba];
  const ConteudoPainel = PAINEIS[painel.tipo];

  return (
    <>
      <Topo app={app} />
      <main className="col">
        {plano ? <Aba app={app} /> : <EscolhaClube app={app} />}
      </main>
      <Rodape />
      <Painel aberto={painel.aberto} onFechar={fecharPainel}>
        {ConteudoPainel && (
          <Congelado key={painel.chave} vivo={painel.aberto}>
            <ConteudoPainel app={app} {...painel.args} />
          </Congelado>
        )}
      </Painel>
      <div className={"toast" + (aviso.on ? " on" : "")} id="toast">{aviso.texto}</div>
    </>
  );
}
