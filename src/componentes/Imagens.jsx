// Foto do jogador e escudo do clube.
// Foto: imagem em alta resolução (campo "hd") quando existe; senão, o sprite antigo;
// e, para jogadores criados pelo usuário, as iniciais do nome.
import { D } from "../logica/dados.js";
import { iniciais } from "../logica/formato.js";

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

// Escudo em alta resolução (public/img/teams/<id>.webp, fundo transparente).
// Sem clube ou sem arquivo de escudo: mostra um "+" no lugar.
export function Escudo({ k, z = 32 }) {
  const c = D.CL[k];
  if (!c || !c.hd) return <span className="face ini" style={{ width: z, height: z }}>+</span>;
  return <img className="crest" src={`img/teams/${c.hd}.webp`} alt={c.n} loading="lazy" decoding="async" width={z} height={z} style={{ width: z, height: z }} />;
}
