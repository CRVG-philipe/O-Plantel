// O app depois que os dados carregaram: guarda o estado e as ações, e escolhe o que mostrar.
import { useEffect, useMemo, useRef, useState } from "react";
import { D } from "./logica/dados.js";
import { FILTROS_PADRAO, PAISES } from "./logica/constantes.js";
import { lum } from "./logica/formato.js";
import { lerCriterioEscalar, lerFiltroCaixa, lerPlanos, lerTimes, salvarCriterioEscalar, salvarFiltroCaixa, salvarPlanos, salvarTimes } from "./logica/armazenamento.js";
import { ehTimeCriado, novaChaveDeTime, registrarTimes } from "./logica/times.js";
import { lerFiltrosDaUrl, urlDosFiltros, urlTemLista } from "./logica/lista.js";
import { ehEmprestadoFora, jogador, novoPlano } from "./logica/elenco.js";
import { idParaAbrir, nomeDoPlano, novoIdDePlano, planosDoClube } from "./logica/planos.js";
import { escalarSozinho, completarTime } from "./logica/escalacao.js";
import { usarMoeda } from "./logica/dinheiro.js";
import { buscarCotacao, lerCotacaoSalva, lerMoeda, salvarMoeda } from "./logica/cotacao.js";
import { salvarTema, temaAtual } from "./logica/tema.js";
import Topo from "./componentes/Topo.jsx";
import EscolhaClube from "./componentes/EscolhaClube.jsx";
import ListaJogadores from "./componentes/ListaJogadores.jsx";
import Elenco from "./componentes/Elenco.jsx";
import Mercado from "./componentes/Mercado.jsx";
import Time from "./componentes/Time.jsx";
import Resumo from "./componentes/Resumo.jsx";
import Simulador, { PainelElencoSim, PainelSimOpcoes, PainelTabelaAtual } from "./componentes/Simulador.jsx";
import Painel, { Congelado } from "./componentes/Painel.jsx";
import Rodape from "./componentes/Rodape.jsx";
import PainelJogador from "./componentes/paineis/PainelJogador.jsx";
import PainelCompra from "./componentes/paineis/PainelCompra.jsx";
import PainelFiltros from "./componentes/paineis/PainelFiltros.jsx";
import PainelCriar from "./componentes/paineis/PainelCriar.jsx";
import PainelClube from "./componentes/paineis/PainelClube.jsx";
import PainelOrcamento from "./componentes/paineis/PainelOrcamento.jsx";
import PainelPosicao, { PainelReserva } from "./componentes/paineis/PainelPosicao.jsx";
import PainelExcluirPlano from "./componentes/paineis/PainelExcluirPlano.jsx";
import PainelEmprestado from "./componentes/paineis/PainelEmprestado.jsx";
import PainelTime, { PainelExcluirTime } from "./componentes/paineis/PainelTime.jsx";
import { PainelFicha, PainelFiltrosLista } from "./componentes/paineis/PainelLista.jsx";

const ABAS = { elenco: Elenco, mercado: Mercado, time: Time, resumo: Resumo };
const PAINEIS = { jogador: PainelJogador, compra: PainelCompra, filtros: PainelFiltros, criar: PainelCriar, clube: PainelClube, orcamento: PainelOrcamento, posicao: PainelPosicao, excluirPlano: PainelExcluirPlano, emprestado: PainelEmprestado, reserva: PainelReserva,
  time: PainelTime, excluirTime: PainelExcluirTime, filtrosLista: PainelFiltrosLista, ficha: PainelFicha, simOpcoes: PainelSimOpcoes, simAtual: PainelTabelaAtual, simElenco: PainelElencoSim };

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
  // Times criados do zero ("plantel:times"): entram em D.CL antes de qualquer coisa ser desenhada
  const [times, setTimesEstado] = useState(() => { const t = lerTimes(); registrarTimes(t); return t; });
  function setTimes(t) { registrarTimes(t); salvarTimes(t); setTimesEstado(t); }
  const [db, setDb] = useState(lerPlanos);       // tudo que está salvo no navegador
  const [aberto, setAberto] = useState(null);    // id do plano aberto (null = tela de escolha); ver logica/planos.js
  const [aba, setAba] = useState("elenco");
  // Simulador da temporada: página própria por cima do plano (botão "Simular temporada" no topo)
  const [simulador, setSimulador] = useState(false);
  // Tela antes do plano: "inicio", "pais", "divisao", "clube" ou "lista" (Lista de jogadores).
  // O site sempre abre no início, a não ser que o endereço traga filtros da Lista (?liga=BRA&pos=CA).
  // País, liga e clube começam no último clube aberto (para quem volta a ele).
  const ultimo = db.last && D.CL[db.plans[db.last]?.club] ? D.CL[db.plans[db.last].club] : null;
  const [tela, setTela] = useState(() => (urlTemLista(window.location.search) ? "lista" : "inicio"));
  // Filtros da Lista de jogadores (começam pelos da URL, se houver)
  const [lista, setLista] = useState(() => lerFiltrosDaUrl(window.location.search));
  const [pais, setPais] = useState(() => (ultimo ? paisDa(ultimo.lg) : 0));
  const [liga, setLiga] = useState(() => (ultimo ? ultimo.lg : "BRA"));
  const [indice, setIndice] = useState(() => (ultimo ? Math.max(0, clubesDa(ultimo.lg).findIndex((c) => c.k === ultimo.k)) : 0));
  // mercado
  const [busca, setBusca] = useState("");
  const [chip, setChip] = useState(0);
  const [limite, setLimite] = useState(40);
  // filtros: os padrões, com "Só quem cabe no caixa" como a pessoa deixou da última vez
  const [filtros, setFiltrosEstado] = useState(() => ({ ...FILTROS_PADRAO, fit: lerFiltroCaixa() }));
  function setFiltros(f) {
    if (f.fit !== filtros.fit) salvarFiltroCaixa(f.fit);
    setFiltrosEstado(f);
  }
  // critério do "Escalar sozinho" ("v" valor de mercado ou "o" overall), guardado em "plantel:escalar"
  const [criterio, setCriterioEstado] = useState(lerCriterioEscalar);
  function setCriterio(c) {
    salvarCriterioEscalar(c);
    setCriterioEstado(c);
  }
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
  // Grava um plano (no estado e no navegador) e marca como o último aberto. id = o do plano (padrão: o aberto)
  function gravar(p, id = aberto ?? p.club) {
    const novo = { ...db, plans: { ...db.plans, [id]: p }, last: id };
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

  // Abre o clube: o plano dele que foi aberto por último (ou o 1º); sem nenhum, cria o Plano 1
  function abrirClube(k) {
    abrirPlano(idParaAbrir(db, k) || novoIdDePlano(db, k), k);
  }
  // Abre um plano pelo id (k = clube, para criar um plano novo quando o id ainda não existe)
  function abrirPlano(id, k = db.plans[id]?.club, base = db) {
    const p = base.plans[id] ? structuredClone(base.plans[id]) : novoPlano(k);
    p.custom = p.custom || [];
    if (!Object.keys(p.xi).length) escalarSozinho(p, criterio);
    completarTime(p);
    const novo = { ...base, plans: { ...base.plans, [id]: p }, last: id };
    setDb(novo);
    salvarPlanos(novo);
    setAberto(id);
    setAba("elenco");
    setSimulador(false);
    window.scrollTo(0, 0);
    if (p.budget === null) abrirPainel("orcamento", { primeiro: true });
  }

  // Plano novo de um clube (padrão: o do plano aberto): do zero (elenco original) ou cópia do plano aberto. Abre o novo.
  function novoPlanoDoClube(copiar = false, k = plano?.club) {
    const id = novoIdDePlano(db, k);
    const p = copiar ? structuredClone(plano) : novoPlano(k);
    delete p.nome; // o nome padrão vem do id ("Plano 2"); dá para renomear depois
    if (!copiar && times[k]) p.budget = times[k].caixa;
    fecharPainel();
    abrirPlano(id, k, { ...db, plans: { ...db.plans, [id]: p } });
    mostrarAviso(copiar ? `${nomeDoPlano(id, p)}: cópia do ${nomeDoPlano(aberto, plano)}` : `${nomeDoPlano(id, p)} do ${D.CL[k].n} criado`);
    setTela("inicio");
  }
  // Muda o nome de um plano (vazio = volta a "Plano N")
  function renomearPlano(id, nome) {
    const p = { ...db.plans[id], nome: nome.trim().slice(0, 40) };
    if (!p.nome) delete p.nome;
    const novo = { ...db, plans: { ...db.plans, [id]: p } };
    setDb(novo);
    salvarPlanos(novo);
  }

  // Sai do plano e volta para a tela inicial (país, liga e clube ficam no clube que estava aberto)
  function trocarClube() {
    fecharPainel();
    const k = plano.club;
    setAberto(null);
    setSimulador(false);
    setTela("inicio");
    setPais(paisDa(D.CL[k].lg));
    setLiga(D.CL[k].lg);
    setIndice(Math.max(0, clubesDa(D.CL[k].lg).findIndex((c) => c.k === k)));
    window.scrollTo(0, 0);
  }

  // Exclui um plano salvo pelo id (só é chamado depois da confirmação no PainelExcluirPlano). Se era o aberto, abre
  // outro plano do mesmo clube ou volta ao início.
  function excluirPlano(id) {
    const p = db.plans[id];
    if (!p) return;
    const plans = { ...db.plans };
    delete plans[id];
    const novo = { ...db, plans };
    if (novo.last === id) delete novo.last; // não aponta mais para um plano que não existe
    setDb(novo);
    salvarPlanos(novo);
    fecharPainel();
    const varios = planosDoClube(db, p.club).length > 1;
    mostrarAviso((varios ? nomeDoPlano(id, p) + " do " : "Plano do ") + D.CL[p.club].n + " excluído");
    if (aberto === id) {
      const outro = planosDoClube(novo, p.club)[0];
      if (outro) abrirPlano(outro[0], p.club, novo);
      else { setAberto(null); setSimulador(false); setTela("inicio"); }
    }
  }

  function reiniciarClube() {
    const k = plano.club;
    const p = novoPlano(k);
    if (plano.nome) p.nome = plano.nome;
    escalarSozinho(p, criterio);
    // Time criado: volta ao caixa inicial dele (não pergunta o orçamento de novo)
    if (times[k]) p.budget = times[k].caixa;
    gravar(p);
    setAba("elenco");
    mostrarAviso("Progresso do " + D.CL[k].n + " reiniciado");
    if (!times[k]) abrirPainel("orcamento", { primeiro: true });
  }

  // Jogador do próprio elenco abre "vender/emprestar" (ou, se veio emprestado, "manter/devolver/comprar");
  // emprestado a outro clube abre "manter/vender/trazer de volta"; de fora (ou contratado) abre "contratar"
  function abrirJogador(id) {
    if (ehEmprestadoFora(plano, id)) return abrirPainel("emprestado", { id });
    abrirPainel(jogador(plano, id).club !== plano.club ? "compra" : "jogador", { id });
  }

  // ---------- Times criados do zero ----------
  // Cria o time, o plano dele (com o caixa inicial) e já abre o plano. O elenco começa vazio.
  function criarTime(dados) {
    const k = novaChaveDeTime();
    setTimes({ ...times, [k]: dados });
    const p = { ...novoPlano(k), budget: dados.caixa };
    gravar(p, k);
    setFiltrosEstado((f) => ({ ...f, fit: true })); // monta o elenco vendo só quem cabe no caixa
    fecharPainel();
    setAberto(k);
    setAba("mercado");
    window.scrollTo(0, 0);
    mostrarAviso(dados.n + " criado. Contrate pelo Mercado.");
  }
  // Salva a edição; se o caixa inicial mudou, o orçamento do plano acompanha
  function salvarTime(k, dados) {
    const antes = times[k];
    setTimes({ ...times, [k]: dados });
    // Caixa inicial mudou: o orçamento de todos os planos do time acompanha
    if (antes && antes.caixa !== dados.caixa) {
      const plans = { ...db.plans };
      for (const [id, p] of planosDoClube(db, k)) plans[id] = { ...p, budget: dados.caixa };
      const novo = { ...db, plans };
      setDb(novo);
      salvarPlanos(novo);
    }
    fecharPainel();
    mostrarAviso(dados.n + " salvo");
  }
  // Apaga o time e o plano dele
  function excluirTime(k) {
    const n = times[k]?.n || "Time";
    const plans = { ...db.plans };
    for (const [id] of planosDoClube(db, k)) delete plans[id];
    const novoDb = { ...db, plans };
    if (novoDb.last && !plans[novoDb.last]) delete novoDb.last;
    setDb(novoDb);
    salvarPlanos(novoDb);
    const t = { ...times };
    delete t[k];
    setTimes(t);
    if (plano && plano.club === k) setAberto(null);
    fecharPainel();
    mostrarAviso(n + " excluído");
  }

  // ---------- Menu e Lista de jogadores ----------
  // Volta ao menu (tela inicial) de qualquer lugar
  function irMenu() {
    fecharPainel();
    if (aberto) { trocarClube(); return; }
    setTela("inicio");
    window.scrollTo(0, 0);
  }
  const abrirLista = () => { setTela("lista"); window.scrollTo(0, 0); };
  // "Abrir clube" na ficha da Lista: vai para a etapa do clube, já nele
  function abrirClubeNaEscolha(k) {
    fecharPainel();
    const c = D.CL[k];
    setPais(paisDa(c.lg));
    setLiga(c.lg);
    setIndice(Math.max(0, clubesDa(c.lg).findIndex((x) => x.k === k)));
    setTela("clube");
    window.scrollTo(0, 0);
  }

  const irPara = (a) => { setAba(a); window.scrollTo(0, 0); };
  const abrirSimulador = () => { fecharPainel(); setSimulador(true); window.scrollTo(0, 0); };
  const fecharSimulador = () => { fecharPainel(); setSimulador(false); window.scrollTo(0, 0); };
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

  // Cor de destaque: do clube aberto ou do clube mostrado no carrossel (na Lista de jogadores, nenhuma)
  const naLista = !aberto && tela === "lista";
  const clubeDaCor = plano?.club || (naLista ? null : clubes[indice]?.k);
  useEffect(() => { aplicarCor(clubeDaCor); }, [clubeDaCor]);

  // Endereço: na Lista de jogadores, os filtros ficam na URL; fora dela, a URL fica limpa
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const desejado = naLista ? urlDosFiltros(lista) : "";
    if (search !== desejado) window.history.replaceState(null, "", pathname + desejado + hash);
  }, [naLista, lista]);

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
    db, plano, planoId: aberto, aba, tela, pais, liga, indice, clubes, busca, chip, limite, filtros, moeda, cotacao, criterio, times, lista,
    setIndice, setBusca, setChip, setLimite, setFiltros, setCriterio, trocarMoeda, tema, alternarTema, setLista,
    criarTime, salvarTime, excluirTime, irMenu, abrirLista, abrirClubeNaEscolha, abrirSimulador, fecharSimulador,
    abrirClube, abrirPlano, novoPlanoDoClube, renomearPlano, trocarClube, reiniciarClube, excluirPlano, abrirJogador, abrirPainel, fecharPainel,
    mudar, irPara, passo, planejarClube, escolherPais, escolherDivisao, voltar, aviso: mostrarAviso,
  };
  const Aba = ABAS[aba];
  const ConteudoPainel = PAINEIS[painel.tipo];

  return (
    <>
      {plano && simulador ? (
        <Simulador app={app} /> /* página própria, com topo, rodapé e barra de ações */
      ) : plano ? (
        <>
          <Topo app={app} />
          <main className="col"><Aba app={app} /></main>
          <Rodape cotacao={cotacao} />
        </>
      ) : naLista ? (
        <>
          <Topo app={app} />
          <main className="col"><ListaJogadores app={app} /></main>
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
