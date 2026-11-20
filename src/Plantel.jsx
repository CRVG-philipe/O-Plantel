// O app depois que os dados carregaram: guarda o estado e as ações, e escolhe o que mostrar.
import { useEffect, useMemo, useRef, useState } from "react";
import { D } from "./logica/dados.js";
import { FILTROS_PADRAO, PAISES } from "./logica/constantes.js";
import { lum } from "./logica/formato.js";
import { lerPlanos, salvarPlanos } from "./logica/armazenamento.js";
import { jogador, novoPlano } from "./logica/elenco.js";
import { escalarSozinho, completarTime } from "./logica/escalacao.js";
import { usarMoeda } from "./logica/dinheiro.js";
import { buscarCotacao, lerCotacaoSalva, lerMoeda, salvarMoeda } from "./logica/cotacao.js";
import { salvarTema, temaAtual } from "./logica/tema.js";
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
import PainelExcluirPlano from "./componentes/paineis/PainelExcluirPlano.jsx";

const ABAS = { elenco: Elenco, mercado: Mercado, time: Time, resumo: Resumo };
const PAINEIS = { jogador: PainelJogador, compra: PainelCompra, filtros: PainelFiltros, criar: PainelCriar, clube: PainelClube, orcamento: PainelOrcamento, posicao: PainelPosicao, excluirPlano: PainelExcluirPlano };

// Clubes de uma liga em ordem alfabética
const clubesDa = (lg) => D.CLUBS.filter((c) => c.lg === lg).sort((a, b) => a.n.localeCompare(b.n));
// Posição do país (na lista PAISES) de uma liga
const paisDa = (lg) => Math.max(0, PAISES.findIndex((p) => p.ligas.includes(lg)));

// Pinta o destaque do site com a cor do clube (ou a 2ª cor, se a 1ª for clara demais)
function aplicarCor(k) {
  const r = document.documentElement.style;
  if (!k) { ["--ac", "--acInk", "--club", "--clubInk"].forEach((v) => r.removeProperty(v)); return; }
  const c = D.CL[k];
  // --club = cor do clube como vem nos dados (campo c), usada no brilho do topo, no risco das abas etc.
  r.setProperty("--club", c.c);
  r.setProperty("--clubInk", lum(c.c) > 0.6 ? "#151619" : "#fff");
  // Versão para o tema escuro: a cor precisa aparecer sobre fundo quase preto
  const escuro = [c.c, c.c2].find((x) => x && lum(x) >= 0.25) || "#ececee";
  r.setProperty("--clubEscuro", escuro);
  r.setProperty("--clubEscuroInk", lum(escuro) > 0.6 ? "#151619" : "#fff");
  const a = lum(c.c) > 0.8 ? (lum(c.c2) > 0.8 ? "#222428" : c.c2) : c.c;
  r.setProperty("--ac", a);
  r.setProperty("--acInk", lum(a) > 0.6 ? "#151619" : "#fff");
}

export default function Plantel() {
  // ---------- estado ----------
  const [db, setDb] = useState(lerPlanos);       // tudo que está salvo no navegador
  const [aberto, setAberto] = useState(null);    // clube do plano aberto (null = tela de escolha)
  const [aba, setAba] = useState("elenco");
  // Tela antes do plano: "inicio", "pais", "divisao" ou "clube". O site sempre abre no início.
  // País, liga e clube começam no último clube aberto (para quem volta a ele).
  const ultimo = db.last && D.CL[db.last] ? D.CL[db.last] : null;
  const [tela, setTela] = useState("inicio");
  const [pais, setPais] = useState(() => (ultimo ? paisDa(ultimo.lg) : 0));
  const [liga, setLiga] = useState(() => (ultimo ? ultimo.lg : "BRA"));
  const [indice, setIndice] = useState(() => (ultimo ? Math.max(0, clubesDa(ultimo.lg).findIndex((c) => c.k === ultimo.k)) : 0));
  // mercado
  const [busca, setBusca] = useState("");
  const [chip, setChip] = useState(0);
  const [limite, setLimite] = useState(40);
  const [filtros, setFiltros] = useState(FILTROS_PADRAO);
  // painel e aviso (toast)
  const [painel, setPainel] = useState({ tipo: null, args: {}, chave: 0, aberto: false });
  const [aviso, setAviso] = useState({ texto: "", on: false });
  const timerAviso = useRef();
  // moeda escolhida e cotação do euro (a salva, ou a de reserva, até a busca do dia chegar)
  const [moeda, setMoeda] = useState(lerMoeda);
  const [cotacao, setCotacao] = useState(lerCotacaoSalva);
  usarMoeda(moeda, cotacao); // vale para todos os valores desenhados nesta tela

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

  // Sai do plano e volta para a tela inicial (país, liga e clube ficam no clube que estava aberto)
  function trocarClube() {
    fecharPainel();
    const k = aberto;
    setAberto(null);
    setTela("inicio");
    setPais(paisDa(D.CL[k].lg));
    setLiga(D.CL[k].lg);
    setIndice(Math.max(0, clubesDa(D.CL[k].lg).findIndex((c) => c.k === k)));
    window.scrollTo(0, 0);
  }

  // Exclui um plano salvo (só é chamado depois da confirmação no PainelExcluirPlano)
  function excluirPlano(k) {
    const plans = { ...db.plans };
    delete plans[k];
    const novo = { ...db, plans };
    if (novo.last === k) delete novo.last; // não aponta mais para um plano que não existe
    setDb(novo);
    salvarPlanos(novo);
    fecharPainel();
    mostrarAviso("Plano do " + D.CL[k].n + " excluído");
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
  const passo = (d) => setIndice((i) => (i + d + clubes.length) % clubes.length);
  const planejarClube = () => { setTela("pais"); window.scrollTo(0, 0); };

  // Escolhe a liga e vai para a etapa do clube (se trocou de liga, começa no 1º clube)
  function escolherDivisao(lg) {
    if (lg !== liga) { setLiga(lg); setIndice(0); }
    setTela("clube");
  }
  // Tocar num país: vai para a divisão, ou direto para o clube se o país só tem uma liga
  function escolherPais(i) {
    setPais(i);
    if (PAISES[i].ligas.length > 1) setTela("divisao");
    else escolherDivisao(PAISES[i].ligas[0]);
  }
  // "Voltar": sempre para a tela anterior que de fato existiu (pula a divisão se não houve)
  function voltar() {
    if (tela === "clube") setTela(PAISES[pais].ligas.length > 1 ? "divisao" : "pais");
    else if (tela === "divisao") setTela("pais");
    else if (tela === "pais") setTela("inicio");
  }

  function trocarMoeda(m) { setMoeda(m); salvarMoeda(m); }

  // Tema claro/escuro: começa no salvo (ou no do sistema); o botão alterna e guarda a escolha
  const [tema, setTema] = useState(temaAtual);
  function alternarTema() {
    const novo = tema === "dark" ? "light" : "dark";
    setTema(novo);
    salvarTema(novo);
  }

  // ---------- efeitos ----------
  // Ao abrir o site: busca a cotação do dia (se falhar, segue com a salva ou a de reserva)
  useEffect(() => {
    buscarCotacao().then(setCotacao).catch((e) => console.warn("Cotação indisponível:", e.message));
  }, []);

  // Cor de destaque: do clube aberto ou do clube mostrado no carrossel
  const clubeDaCor = aberto || clubes[indice]?.k;
  useEffect(() => { aplicarCor(clubeDaCor); }, [clubeDaCor]);

  // Teclado: Esc fecha o painel; na etapa do clube, as setas trocam de clube
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") fecharPainel();
      if (aberto || painel.aberto || tela !== "clube") return;
      if (e.key === "ArrowRight") passo(1);
      if (e.key === "ArrowLeft") passo(-1);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  });

  // ---------- tela ----------
  // "app" é o pacote de dados e ações que cada componente recebe
  const app = {
    db, plano, aba, tela, pais, liga, indice, clubes, busca, chip, limite, filtros, moeda, cotacao,
    setIndice, setBusca, setChip, setLimite, setFiltros, trocarMoeda, tema, alternarTema,
    abrirClube, trocarClube, reiniciarClube, excluirPlano, abrirJogador, abrirPainel, fecharPainel,
    mudar, irPara, passo, planejarClube, escolherPais, escolherDivisao, voltar, aviso: mostrarAviso,
  };
  const Aba = ABAS[aba];
  const ConteudoPainel = PAINEIS[painel.tipo];

  return (
    <>
      {plano ? (
        <>
          <Topo app={app} />
          <main className="col"><Aba app={app} /></main>
          <Rodape cotacao={cotacao} />
        </>
      ) : (
        <EscolhaClube app={app} /> /* tela cheia, com topo e rodapé próprios */
      )}
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
