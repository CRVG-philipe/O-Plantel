// Peças visuais de jogador usadas nas abas (Mercado, Elenco, Time, Resumo) e nos painéis:
// avatar com anel na cor do setor, mini escudo, bandeira, selo da posição, selo da nota e mini estatísticas.
import { D } from "../logica/dados.js";
import { corDoSetor } from "../logica/constantes.js";
import { dec } from "../logica/formato.js";
import { codigoDoPais } from "../logica/nacionalidades.js";
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

// Bandeira da nacionalidade (imagem: emoji de bandeira não aparece no Windows)
export function Bandeira({ nat }) {
  const c = codigoDoPais(nat);
  if (!c) return null;
  return <img className="fl" src={`img/flags/paises/${c}.svg`} alt={nat} title={nat} loading="lazy" decoding="async" width="16" height="12" />;
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
