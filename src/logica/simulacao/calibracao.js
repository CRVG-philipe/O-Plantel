// Calibração do motor de placar: simula muitas temporadas de uma liga (pontos corridos, turno e returno) com os elencos
// atuais e mede as metas pedidas em 23/11/2026. Usado pelo teste (testes/simulacao.test.js) e pela página escondida
// "?debug-motor" (componentes/DebugMotor.jsx).
import { D } from "../dados.js";
import { mulberry32 } from "./aleatorio.js";
import { gerarCalendario } from "./calendario.js";
import { escalarClube } from "./escalar.js";
import { sortearPlacar } from "./motor.js";

// Metas (em % quando "pct"): min/max = faixa aceita
export const METAS = [
  { id: "gols", nome: "Média de gols por jogo", min: 2.3, max: 2.6 },
  { id: "casa", nome: "Mandante vence", min: 44, max: 50, pct: true },
  { id: "empate", nome: "Empate", min: 24, max: 29, pct: true },
  { id: "fora", nome: "Visitante vence", min: 24, max: 30, pct: true },
  { id: "dif4", nome: "Jogos com diferença de 4+ gols", max: 3, pct: true },
  { id: "cinco", nome: "Time marcando 5+ gols (por time em cada jogo)", max: 1.5, pct: true },
  { id: "cincoJogo", nome: "Jogos com algum time marcando 5+ (só informativo)", pct: true },
  { id: "campeao", nome: "Pontos do campeão (média)", min: 72, max: 82 },
  { id: "ultimo", nome: "Pontos do último (média)", min: 28, max: 38 },
  { id: "diferenca", nome: "Diferença 1º − último (média)", min: 38, max: 52 },
  { id: "zebra", nome: "Mais fraco vence o mais forte", min: 12, pct: true },
];
export const passou = (m, v) => (m.min == null || v >= m.min) && (m.max == null || v <= m.max);

export function medirMotor({ lg = "BRA", temporadas = 1000, semente = 2027 } = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const clubes = D.CLUBS.filter((c) => c.lg === lg).map((c) => c.k);
  const F = Object.fromEntries(clubes.map((k) => [k, escalarClube(k, lg).forca]));
  const fraco = clubes.reduce((a, b) => (F[b] < F[a] ? b : a)), forte = clubes.reduce((a, b) => (F[b] > F[a] ? b : a));
  const cal = gerarCalendario(clubes), rng = mulberry32(semente), n = clubes.length;
  const idx = Object.fromEntries(clubes.map((k, i) => [k, i]));
  let jogos = 0, gols = 0, casa = 0, empate = 0, fora = 0, dif4 = 0, cinco = 0, cincoJogo = 0, campeao = 0, ultimo = 0, duelos = 0, zebras = 0;
  const pts = new Int32Array(n);
  for (let s = 0; s < temporadas; s++) {
    pts.fill(0);
    for (const rodada of cal)
      for (const [c, f] of rodada) {
        const [a, b] = sortearPlacar(rng, F[c], F[f]);
        jogos++; gols += a + b;
        if (a > b) { casa++; pts[idx[c]] += 3; } else if (a < b) { fora++; pts[idx[f]] += 3; } else { empate++; pts[idx[c]]++; pts[idx[f]]++; }
        if (Math.abs(a - b) >= 4) dif4++;
        if (a >= 5) cinco++;
        if (b >= 5) cinco++;
        if (a >= 5 || b >= 5) cincoJogo++;
        if ((c === fraco && f === forte) || (c === forte && f === fraco)) {
          duelos++;
          if ((c === fraco && a > b) || (f === fraco && b > a)) zebras++;
        }
      }
    let mx = -1, mn = Infinity;
    for (let i = 0; i < n; i++) { if (pts[i] > mx) mx = pts[i]; if (pts[i] < mn) mn = pts[i]; }
    campeao += mx; ultimo += mn;
  }
  const pct = (x, t) => (100 * x) / t;
  const valores = {
    gols: gols / jogos, casa: pct(casa, jogos), empate: pct(empate, jogos), fora: pct(fora, jogos), dif4: pct(dif4, jogos), cinco: pct(cinco, 2 * jogos), cincoJogo: pct(cincoJogo, jogos),
    campeao: campeao / temporadas, ultimo: ultimo / temporadas, diferenca: (campeao - ultimo) / temporadas, zebra: pct(zebras, duelos),
  };
  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return { lg, temporadas, jogos, valores, fraco: [fraco, F[fraco]], forte: [forte, F[forte]], ms };
}
