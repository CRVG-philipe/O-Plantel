// Times criados do zero ("Criar time do zero").
//
// Cada time fica guardado em "plantel:times" (armazenamento.js) como { n, sigla, c, c2, modelo, lg, caixa }, com a chave
// começando por "U". Ao abrir o site, registrarTimes() coloca cada um em D.CL como se fosse um clube de verdade, sem
// jogadores (p: []), sem técnico e sem empréstimos. Assim as abas Elenco, Mercado, Time e Resumo, a regra de
// estrangeiros, a recomendação e o nível de preço (média da liga) funcionam sem mudar nada.
// Eles NÃO entram em D.CLUBS: não aparecem na escolha de clube, nos filtros do Mercado nem na Lista de jogadores.
import { D } from "./dados.js";
import { norm } from "./formato.js";

// 8 cores prontas (o formulário também tem o seletor livre)
export const CORES_PRONTAS = ["#c8102e", "#0b3d91", "#0b6b3a", "#151619", "#ffffff", "#f2c500", "#6a1b9a", "#e86a10"];
// Modelos de escudo (desenhados em SVG por EscudoCriado, em Imagens.jsx)
export const MODELOS = [["classico", "Clássico"], ["faixa", "Faixa"], ["redondo", "Redondo"]];

export const ehTimeCriado = (k) => typeof k === "string" && k[0] === "U" && !!D.CL[k]?.criado;
export const novaChaveDeTime = () => "U" + Date.now();

// Coloca (ou atualiza) os times criados em D.CL e tira de lá os que foram excluídos
export function registrarTimes(times) {
  for (const k of Object.keys(D.CL)) if (D.CL[k].criado && !times[k]) delete D.CL[k];
  for (const [k, t] of Object.entries(times)) {
    if (!t || !D.LG[t.lg]) continue; // liga que não existe mais: fica de fora
    D.CL[k] = { k, lg: t.lg, n: t.n, coach: "", c: t.c, c2: t.c2, hd: 0, p: [], nn: norm(t.n), criado: true, sigla: t.sigla, modelo: t.modelo };
  }
}

// Sigla de 3 letras a partir do nome: iniciais das palavras importantes, completadas com as letras da última
// ("Real Madrid" → "RMA", "Flamengo" → "FLA", "Clube de Regatas Brasil" → "CRB")
const PEQUENAS = new Set(["de", "da", "do", "das", "dos", "e", "the", "of", "y", "del", "la", "el", "le"]);
export function sugerirSigla(nome) {
  const palavras = norm(nome || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(" ").filter((w) => w && !PEQUENAS.has(w.toLowerCase()));
  if (!palavras.length) return "";
  let s = palavras.slice(0, 3).map((w) => w[0]).join("");
  const ultima = palavras[Math.min(2, palavras.length - 1)];
  for (let i = 1; s.length < 3 && i < ultima.length; i++) s += ultima[i];
  return s.slice(0, 3);
}

// Caixa sugerido: média do valor dos elencos da liga (em € mi, arredondado)
export function caixaSugerido(lg) {
  const clubes = D.CLUBS.filter((c) => c.lg === lg);
  if (!clubes.length) return 20;
  const total = D.ALL.reduce((s, p) => s + (p.lg === lg ? p.v || 0 : 0), 0);
  const media = total / clubes.length;
  return media >= 10 ? Math.round(media) : Math.round(media * 10) / 10;
}
