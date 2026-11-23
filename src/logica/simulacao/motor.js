// Motor de jogo do simulador: força do time, placar (Poisson), autores dos gols e assistências, e a nota de cada jogador.
//
// Um "time" aqui é { k, onze: [{ vaga, p }], banco: [p, ...], forca }: o onze na ordem das vagas da formação
// (p = null numa vaga vazia) e o banco em ordem de preferência (no máximo 7 entram na conta da força).
import { SETOR } from "../constantes.js";
import { nivel } from "../compatibilidade.js";
import { poisson, sortearIndice } from "./aleatorio.js";

// ---------- Força ----------
export const PESO_SETOR = { gol: 1.0, def: 1.0, mei: 1.05, ata: 1.1 };
export const PENALIDADE = { ideal: 0, boa: -2, improvisado: -6 }; // no overall de quem joga fora da posição
export const OVR_SEM = 60;        // jogador sem overall (criado pelo usuário)
export const OVR_VAGA_VAZIA = 40; // ninguém na vaga (elenco curto demais)
export const OVR_BANCO_VAZIO = 45; // vaga de banco que falta para chegar a 7 reservas
export const ovrDe = (p) => (p && p.ovr != null ? p.ovr : OVR_SEM);

// Força = média ponderada do overall dos 11 (pelo setor da vaga, já com a penalidade de quem está fora da posição)
//         + 0,1 × (média dos 7 melhores reservas − média dos titulares).
export function calcularForca(onze, banco) {
  let soma = 0, pesos = 0, somaTit = 0;
  for (const { vaga, p } of onze) {
    const w = PESO_SETOR[SETOR[vaga]] ?? 1;
    const o = p ? ovrDe(p) + PENALIDADE[nivel(vaga, p.pos)] : OVR_VAGA_VAZIA;
    soma += w * o;
    pesos += w;
    somaTit += p ? ovrDe(p) : OVR_VAGA_VAZIA;
  }
  if (!onze.length) return OVR_VAGA_VAZIA;
  const reservas = banco.map(ovrDe).sort((a, b) => b - a).slice(0, 7);
  while (reservas.length < 7) reservas.push(OVR_BANCO_VAZIO);
  const mediaBanco = reservas.reduce((s, o) => s + o, 0) / 7;
  return soma / pesos + 0.1 * (mediaBanco - somaTit / onze.length);
}

// ---------- Placar ----------
// λ = média de gols esperada. Mandante: 1,35 × e^(0,075 × diferença + CASA); visitante: 1,15 × e^(0,075 × diferença + FORA).
// O pedido original era CASA = +0,12 e FORA = −0,04; a calibração (testes/simulacao.test.js, Brasileirão, Premier League
// e Série B simulados 200 vezes) deu ~47% de vitórias do mandante com esses números. Com +0,07 e −0,02, fica em ~45%
// e a média de gols em ~2,7 por jogo.
// Campo neutro (final de playoff): 1,29 × e^(0,075 × diferença) para os dois (a média de mandante e visitante).
export const CASA = 0.07, FORA = -0.02;
const limitar = (l) => Math.min(4.5, Math.max(0.15, l));
export function lambdas(Fc, Ff, neutro = false) {
  if (neutro) return [limitar(1.29 * Math.exp(0.075 * (Fc - Ff))), limitar(1.29 * Math.exp(0.075 * (Ff - Fc)))];
  return [limitar(1.35 * Math.exp(0.075 * (Fc - Ff) + CASA)), limitar(1.15 * Math.exp(0.075 * (Ff - Fc) + FORA))];
}
export function sortearPlacar(rng, Fc, Ff, neutro = false) {
  const [a, b] = lambdas(Fc, Ff, neutro);
  return [poisson(rng, a), poisson(rng, b)];
}

// ---------- Gols, assistências e notas ----------
export const PESO_GOL = { CA: 5, SA: 4, PE: 3.5, PD: 3.5, MEI: 3, ME: 2.5, MD: 2.5, MC: 1.5, VOL: 1, LE: 0.8, LD: 0.8, ZAG: 0.6, GOL: 0 };
export const PESO_ASSIST = { MEI: 4, PE: 3.5, PD: 3.5, ME: 3, MD: 3, SA: 3, MC: 2.5, LE: 2, LD: 2, CA: 2, VOL: 1.2, ZAG: 0.5, GOL: 0.1 };
const golsPorJogo = (p) => (p.st && p.st[0] > 0 ? p.st[1] / p.st[0] : 0);

// Quem joga: os titulares e 3 reservas sorteados (entre os 7 primeiros do banco), cada um no lugar de um
// titular de linha sorteado. Cada um tem o intervalo [entra, sai] em minutos. subs = [[minuto, id de quem sai, id de quem entra]].
function participantes(rng, time) {
  const lista = time.onze.filter((x) => x.p).map(({ p }) => ({ p, entra: 0, sai: 90 }));
  const banco = time.banco.slice(0, 7);
  const n = Math.min(3, banco.length), subs = [];
  const usados = new Set();
  for (let s = 0; s < n; s++) {
    const linha = lista.filter((x) => x.sai === 90 && x.entra === 0 && x.p.pos !== "GOL");
    if (!linha.length) break;
    let j;
    do { j = Math.floor(rng() * banco.length); } while (usados.has(j));
    usados.add(j);
    const sai = linha[Math.floor(rng() * linha.length)];
    const minuto = 55 + Math.floor(rng() * 31); // entre 55' e 85'
    sai.sai = minuto;
    lista.push({ p: banco[j], entra: minuto, sai: 90 });
    subs.push([minuto, sai.p.id, banco[j].id]);
  }
  return { lista, subs };
}
const tempo = (x) => (x.sai - x.entra) / 90;
const emCampo = (x, m) => x.entra < m && m <= x.sai;

// Um gol: sorteia o autor (posição × (1 + gols/jogo da temporada atual) × (overall/75)² × tempo em campo),
// o minuto (dentro do tempo dele em campo) e, em 75% dos gols, quem deu a assistência (entre os outros em campo).
function sortearGol(rng, ps) {
  const i = sortearIndice(rng, ps.map((x) => (PESO_GOL[x.p.pos] ?? 1) * (1 + golsPorJogo(x.p)) * (ovrDe(x.p) / 75) ** 2 * tempo(x)));
  if (i < 0) return { autor: null, assist: null, minuto: 1 + Math.floor(rng() * 90) };
  const a = ps[i];
  const minuto = a.entra + 1 + Math.floor(rng() * (a.sai - a.entra));
  let assist = null;
  if (rng() < 0.75) {
    const outros = ps.filter((x) => x !== a && emCampo(x, minuto));
    const j = sortearIndice(rng, outros.map((x) => PESO_ASSIST[x.p.pos] ?? 1));
    if (j >= 0) assist = outros[j].p;
  }
  return { autor: a.p, assist, minuto };
}

// Nota do jogo (6,0 a 9,5): 6,6 + vitória +0,3 / derrota −0,3 + 0,8 por gol + 0,5 por assistência
// + 0,4 para goleiro e defensor sem sofrer gol + um ruído pequeno (até ±0,3).
function nota(rng, x, saldo, sofridos, gols, assists) {
  let n = 6.6 + (saldo > 0 ? 0.3 : saldo < 0 ? -0.3 : 0) + 0.8 * gols + 0.5 * assists;
  const setor = SETOR[x.p.pos];
  if ((setor === "gol" || setor === "def") && sofridos === 0) n += 0.4;
  n += (rng() - 0.5) * 0.6;
  return Math.round(Math.min(9.5, Math.max(6, n)) * 10) / 10;
}

// Jogo completo. Devolve { gc, gf, eventos: [[minuto, lado (0 casa, 1 fora), id do autor, id da assistência]],
// jogadores: [[id, lado, gols, assistências, nota]], subs: [[minuto, lado, id de quem sai, id de quem entra]] }.
export function jogarPartida(rng, casa, fora, neutro = false) {
  const [gc, gf] = sortearPlacar(rng, casa.forca, fora.forca, neutro);
  const pa = participantes(rng, casa), pb = participantes(rng, fora);
  const ps = [pa.lista, pb.lista];
  const subs = [...pa.subs.map((s) => [s[0], 0, s[1], s[2]]), ...pb.subs.map((s) => [s[0], 1, s[1], s[2]])].sort((a, b) => a[0] - b[0]);
  const eventos = [];
  const conta = new Map(); // id → [gols, assistências]
  const marca = (p, i) => { if (!p) return; const c = conta.get(p.id) || [0, 0]; c[i]++; conta.set(p.id, c); };
  [gc, gf].forEach((n, lado) => {
    for (let g = 0; g < n; g++) {
      const { autor, assist, minuto } = sortearGol(rng, ps[lado]);
      marca(autor, 0);
      marca(assist, 1);
      eventos.push([minuto, lado, autor ? autor.id : null, assist ? assist.id : null]);
    }
  });
  eventos.sort((a, b) => a[0] - b[0]);
  const jogadores = [];
  ps.forEach((lista, lado) => {
    const saldo = lado === 0 ? gc - gf : gf - gc, sofridos = lado === 0 ? gf : gc;
    for (const x of lista) {
      const [g, a] = conta.get(x.p.id) || [0, 0];
      jogadores.push([x.p.id, lado, g, a, nota(rng, x, saldo, sofridos, g, a)]);
    }
  });
  return { gc, gf, eventos, jogadores, subs };
}
