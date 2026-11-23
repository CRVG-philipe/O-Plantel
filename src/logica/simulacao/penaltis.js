// Disputa por pênaltis (23/11/2026). 5 cobranças alternadas para cada lado; se empatar, cobranças alternadas (morte
// súbita) até um converter e o outro perder. Acaba antes quando um lado não consegue mais alcançar o outro.
// Quem bate primeiro é sorteado. Chance de converter = 0,76 + 0,004 × (overall do batedor − 75)
// − 0,003 × (overall do goleiro − 75), entre 0,6 e 0,9.
// Ordem dos batedores: os 10 de linha em campo, do melhor "cobrador" para o pior (overall + bônus de posição:
// CA/SA/MEI +4, PE/PD/MC +2), e o goleiro por último. Sem jogadores (previsão), cada cobrança usa a força do time.
import { mulberry32 } from "./aleatorio.js";

const BONUS = { CA: 4, SA: 4, MEI: 4, PE: 2, PD: 2, MC: 2 };
const chance = (bat, gol) => Math.min(0.9, Math.max(0.6, 0.76 + 0.004 * (bat - 75) - 0.003 * (gol - 75)));

// Lado da disputa a partir de um time do motor ({ onze, forca }) ou só da força (número)
export function ladoDosPenaltis(time) {
  if (typeof time === "number" || !time?.onze) {
    const f = typeof time === "number" ? time : time?.forca ?? 70;
    return { batedores: Array.from({ length: 11 }, () => ({ id: null, ovr: f })), goleiro: f };
  }
  const ps = time.onze.map((x) => x.p).filter(Boolean);
  const gk = ps.find((p) => p.pos === "GOL");
  const linha = ps.filter((p) => p !== gk).sort((a, b) => (b.ovr ?? 60) + (BONUS[b.pos] || 0) - ((a.ovr ?? 60) + (BONUS[a.pos] || 0)));
  const batedores = [...linha, ...(gk ? [gk] : [])].map((p) => ({ id: p.id, ovr: p.ovr ?? 60 }));
  return { batedores: batedores.length ? batedores : [{ id: null, ovr: time.forca ?? 70 }], goleiro: gk?.ovr ?? 60 };
}

// A e B = ladoDosPenaltis(...). Devolve { vence: 0 (A) | 1 (B), placar: [A, B], cob: [[lado, id do batedor, 1|0], ...] }
export function disputarPenaltis(rng, A, B) {
  const lados = [A, B], placar = [0, 0], batidas = [0, 0], cob = [];
  const primeiro = rng() < 0.5 ? 0 : 1, ordem = [primeiro, 1 - primeiro];
  const bater = (l) => {
    const L = lados[l], bat = L.batedores[batidas[l] % L.batedores.length];
    const ok = rng() < chance(bat.ovr, lados[1 - l].goleiro) ? 1 : 0;
    batidas[l]++; placar[l] += ok;
    cob.push([l, bat.id, ok]);
  };
  // Série de 5: para quando um lado não alcança mais
  const decidido = () => {
    for (const l of [0, 1]) {
      const resta = (o) => 5 - batidas[o];
      if (placar[l] > placar[1 - l] + resta(1 - l)) return true;
    }
    return false;
  };
  for (let k = 0; k < 5 && !decidido(); k++) for (const l of ordem) { if (decidido()) break; bater(l); }
  // Morte súbita
  while (placar[0] === placar[1]) { bater(ordem[0]); bater(ordem[1]); }
  return { vence: placar[0] > placar[1] ? 0 : 1, placar, cob };
}

// Compatibilidade com o desempate antigo (uma função que devolvia um número): vira uma disputa só com as forças,
// com a semente tirada desse número
export function disputaDoSorteio(numero, fa, fb) {
  return disputarPenaltis(mulberry32(Math.floor(numero * 4294967296) >>> 0), ladoDosPenaltis(fa), ladoDosPenaltis(fb));
}
