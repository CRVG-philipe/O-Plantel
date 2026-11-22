// Peças visuais de jogador usadas nas abas (Mercado, Elenco, Time, Resumo) e nos painéis:
// avatar com anel na cor do setor, mini escudo, bandeira, selo da posição, selo da nota e mini estatísticas.
import { D } from "../logica/dados.js";
import { corDoSetor } from "../logica/constantes.js";
import { dec } from "../logica/formato.js";
import { codigoDoPais, nacionalidades } from "../logica/nacionalidades.js";
import { valorJogador } from "../logica/dinheiro.js";
import { Foto, Escudo } from "./Imagens.jsx";

// Foto com anel na cor do setor; "clube" mostra o mini escudo no canto (para quem é de outro clube)
export function Avatar({ p, z = 42, clube }) {
  return (
    <span className="av" style={{ "--pc": corDoSetor(p.pos) }}>
      <Foto p={p} z={z} />
      {clube && D.CL[clube] && <span className="mc"><Escudo k={clube} z={14} /></span>}
    </span>
  );
}

// Bandeira da nacionalidade (imagem: emoji de bandeira não aparece no Windows).
// Dupla nacionalidade ("Bolívia/Argentina"): a bandeira do primeiro país; o nome completo aparece ao passar o mouse.
export function Bandeira({ nat }) {
  const c = codigoDoPais(nat);
  if (!c) return null;
  const nome = nacionalidades(nat).join(" / ");
  return <img className="fl" src={`img/flags/paises/${c}.svg`} alt={nome} title={nome} loading="lazy" decoding="async" width="16" height="12" />;
}

// Valor de mercado do jogador: o real, ou o estimado com "~" e o aviso "valor estimado" ao passar o mouse
export function Valor({ p }) {
  if (!p.vEst) return valorJogador(p.v);
  return <span className="estimado" title="valor estimado">{valorJogador(p.v, true)}</span>;
}

// Selo de compatibilidade com a vaga: ideal (verde), boa (amarelo), improvisado (vermelho, com aviso)
export const SeloNivel = ({ nivel }) => (
  <span className={"nivel " + nivel} title={nivel === "improvisado" ? "Jogador improvisado nesta vaga" : undefined}>{nivel === "improvisado" ? "⚠ improvisado" : nivel}</span>
);

// Faixa de cor do overall (vale também para as barras de atributos):
// 85+ dourado, 78–84 verde, 70–77 azul, 60–69 cinza, abaixo de 60 bronze
export const classeOvr = (o) => (o >= 85 ? "o85" : o >= 78 ? "o78" : o >= 70 ? "o70" : o >= 60 ? "o60" : "o45");

// Selo quadradinho do overall, ao lado da foto.
// Sem overall (jogador criado ou fora da base): selo vazio "–", para a lista continuar alinhada.
export function Ovr({ p, grande = false }) {
  const g = grande ? " grande" : "";
  if (p.ovr == null) return <span className={"ovr sem" + g} title="Overall indisponível">–</span>;
  return <span className={`ovr ${classeOvr(p.ovr)}${g}`} title="Overall">{p.ovr}</span>;
}

// Selo da posição na cor do setor ("GOL", "ZAG"...)
export const Pos = ({ pos }) => <span className="pos" style={{ "--pc": corDoSetor(pos) }}>{pos}</span>;

// Selo da nota média, colorido como no Sofascore: ≥8 azul, ≥7 verde, ≥6 amarelo, <6 laranja
export const classeNota = (n) => (n >= 8 ? "n8" : n >= 7 ? "n7" : n >= 6 ? "n6" : "n5");
export function Nota({ st, className = "" }) {
  if (!st || !st[0] || !st[3]) return null;
  return <span className={`nota ${classeNota(st[3])} ${className}`} title="Nota média (Sofascore)">{dec(st[3])}</span>;
}

// Jogos, gols e assistências como números destacados (ou o aviso de que não há estatísticas).
// Quem não entrou em campo ([0,0,0,0]) aparece com "0 jogos" e sem nota (o selo Nota some sozinho).
export function MiniStats({ p, comNota = false }) {
  const s = p.st;
  if (!s) return <div className="sub st">Estatísticas indisponíveis</div>;
  return (
    <div className="sub st ministats">
      <span><b>{s[0]}</b>jogos</span><span><b>{s[1]}</b>gols</span><span><b>{s[2]}</b>assist.</span>
      {comNota && <Nota st={s} className="so-celular" />}
    </div>
  );
}
