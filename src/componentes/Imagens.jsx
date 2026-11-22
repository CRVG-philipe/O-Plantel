// Foto do jogador e escudo do clube.
// Foto: imagem em alta resolução (campo "hd") quando existe; senão, o sprite antigo;
// e, para jogadores criados pelo usuário, as iniciais do nome.
import { useId } from "react";
import { D } from "../logica/dados.js";
import { iniciais, lum } from "../logica/formato.js";

// Escudo de time criado do zero, em SVG: a sigla sobre as duas cores, em 3 modelos
//   classico  escudo na cor principal com borda na 2ª cor
//   faixa     escudo na cor principal com uma faixa larga na 2ª cor, onde fica a sigla
//   redondo   círculo na cor principal com anel na 2ª cor
const ESCUDO = "M8 6 H92 V58 C92 88 70 104 50 114 C30 104 8 88 8 58 Z";
const tinta = (cor) => (lum(cor || "#000") > 0.6 ? "#151619" : "#fff");
export function EscudoCriado({ sigla = "", c = "#0b3d91", c2 = "#ffffff", modelo = "classico", z = 32, nome, decorativo = false }) {
  const id = useId().replace(/:/g, "");
  const texto = (cor, y = 70) => (
    <text x="50" y={y} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize={sigla.length > 2 ? 27 : 32}
      letterSpacing="1" fill={tinta(cor)}>{sigla}</text>
  );
  return (
    <svg className="crest crest-criado" viewBox="0 0 100 120" width={z} height={z} style={{ width: z, height: z }} {...(decorativo ? { "aria-hidden": true } : { role: "img", "aria-label": nome ? "Escudo do " + nome : "Escudo" })}>
      {modelo === "redondo" ? (
        <>
          <circle cx="50" cy="60" r="46" fill={c2} />
          <circle cx="50" cy="60" r="37" fill={c} />
          {texto(c, 70)}
        </>
      ) : modelo === "faixa" ? (
        <>
          <clipPath id={"cl" + id}><path d={ESCUDO} /></clipPath>
          <g clipPath={`url(#cl${id})`}>
            <rect width="100" height="120" fill={c} />
            <rect x="0" y="44" width="100" height="36" fill={c2} />
          </g>
          <path d={ESCUDO} fill="none" stroke={c2} strokeWidth="4" />
          {texto(c2, 71)}
        </>
      ) : (
        <>
          <path d={ESCUDO} fill={c} stroke={c2} strokeWidth="7" strokeLinejoin="round" />
          {texto(c, 68)}
        </>
      )}
    </svg>
  );
}

export function Foto({ p, z = 40 }) {
  if (p.hd) {
    return <img className="face" src={`img/players/${p.hd}.webp`} alt="" loading="lazy" decoding="async" width={z} height={z} style={{ width: z, height: z }} />;
  }
  if (p.sp != null && p.sp >= 0) {
    // Sprite: uma imagem grande com 32 fotos por linha; mostramos só o "quadradinho" do jogador
    const C = 32, c = p.sp % C, r = Math.floor(p.sp / C);
    return <span className="face" style={{ width: z, height: z, backgroundImage: `url(img/p_${p.lg}.webp)`, backgroundSize: `${C * z}px auto`, backgroundPosition: `-${c * z}px -${r * z}px` }} />;
  }
  return <span className="face ini" style={{ width: z, height: z, fontSize: Math.round(z * 0.36) }}>{iniciais(p.n)}</span>;
}

// Logo da liga (public/img/leagues/<k>.webp), num círculo branco como os escudos:
// várias logos são escuras (Premier League, Ligue 1, Eredivisie...) e sumiriam no fundo colorido.
export function LogoLiga({ k, z = 48 }) {
  return (
    <span className="logo-liga" style={{ width: z, height: z }}>
      <img src={`img/leagues/${k}.webp`} alt="" loading="lazy" decoding="async" width={Math.round(z * 0.66)} height={Math.round(z * 0.66)} />
    </span>
  );
}

// Escudo em alta resolução (public/img/teams/<id>.webp, fundo transparente).
// Time criado do zero: escudo desenhado (EscudoCriado). Sem clube ou sem arquivo de escudo: mostra um "+" no lugar.
export function Escudo({ k, z = 32 }) {
  const c = D.CL[k];
  if (c?.criado) return <EscudoCriado sigla={c.sigla} c={c.c} c2={c.c2} modelo={c.modelo} z={z} nome={c.n} />;
  if (!c || !c.hd) return <span className="face ini" style={{ width: z, height: z }}>+</span>;
  return <img className="crest" src={`img/teams/${c.hd}.webp`} alt={c.n} loading="lazy" decoding="async" width={z} height={z} style={{ width: z, height: z }} />;
}
