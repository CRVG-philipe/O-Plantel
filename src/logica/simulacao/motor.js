// Motor de jogo do simulador: força do time, placar (Poisson), autores dos gols e assistências, e a nota de cada jogador.
//
// Um "time" aqui é { k, onze: [{ vaga, p }], banco: [p, ...], forca }: o onze na ordem das vagas da formação
// (p = null numa vaga vazia) e o banco em ordem de preferência (no máximo 7 entram na conta da força).
import { SETOR } from "../constantes.js";
import { nivel } from "../compatibilidade.js";
import { normal, poisson, sortearIndice } from "./aleatorio.js";

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

// ---------- Placar (versão 2, 23/11/2026: menos goleadas e tabela mais realista) ----------
// 1. Forma do dia: cada time ganha um ruído N(0; RUIDO) na força, sorteado com a semente do jogo.
// 2. Diferença comprimida: d = F_casa − F_fora (com a forma do dia) e d′ = ESCALA × tanh(d / ESCALA)
//    (com 7, 15 pontos de diferença valem ~6,8; 8 pontos valem ~5,7).
// 3. λ (gols esperados no jogo): mandante BASE_CASA × e^(K × d′); visitante BASE_FORA × e^(−K × d′); campo neutro
//    BASE_NEUTRO para os dois. Entre 0,15 e TETO (3,2).
// 4. Poisson bivariado: os gols de cada time = parte própria (λ − COMUM) + uma parte comum (COMUM) que vale para os
//    dois, o que deixa os placares mais "parecidos" (mais empates realistas, menos placares abertos).
// 5. Jogo em 6 blocos de 15 minutos (cada um com 1/6 dos λ). Controle de jogo: quando um time abre 3 gols de vantagem,
//    o λ dele cai CONTROLE[0] (45%) e o do adversário sobe CONTROLE[1] (10%) no resto da partida.
// Calibração: testes/simulacao.test.js e a página escondida ?debug-motor (calibracao.js), 1.000 Brasileirões.
// Calibrado em 23/11/2026 (1.000 Brasileirões, 3 sementes): o pedido era K ~0,045, mas com a compressão e a forma do
// dia o campeão ficava com ~71 pontos (meta 72–82); K = 0,063 põe o campeão em ~72,5, o último em ~28,8 e o resto no meio
// das faixas (gols 2,5; mandante 46%; empate 27%; 4+ de diferença 2,7%; mais fraco vence o mais forte 16–17%).
export const MOTOR = { RUIDO: 1.5, ESCALA: 7, K: 0.063, BASE_CASA: 1.41, BASE_FORA: 1.02, BASE_NEUTRO: 1.215, COMUM: 0.1, TETO: 3.2, PISO: 0.15, CONTROLE: [0.55, 1.1] };
const BLOCOS = 6;
const limitar = (l) => Math.min(MOTOR.TETO, Math.max(MOTOR.PISO, l));
export const comprimir = (d) => MOTOR.ESCALA * Math.tanh(d / MOTOR.ESCALA);
// λ sem a forma do dia (Fc e Ff já podem vir com ela)
export function lambdas(Fc, Ff, neutro = false) {
  const d = comprimir(Fc - Ff), K = MOTOR.K;
  if (neutro) return [limitar(MOTOR.BASE_NEUTRO * Math.exp(K * d)), limitar(MOTOR.BASE_NEUTRO * Math.exp(-K * d))];
  return [limitar(MOTOR.BASE_CASA * Math.exp(K * d)), limitar(MOTOR.BASE_FORA * Math.exp(-K * d))];
}
// O jogo em blocos de 15 minutos. comMinutos = true também sorteia o minuto de cada gol: { gc, gf, gols: [[minuto, lado]] }
export function jogarBlocos(rng, Fc, Ff, neutro = false, comMinutos = false) {
  const fc = Fc + MOTOR.RUIDO * normal(rng), ff = Ff + MOTOR.RUIDO * normal(rng);
  const [lc, lf] = lambdas(fc, ff, neutro);
  const comum = Math.min(MOTOR.COMUM, lc - 0.05, lf - 0.05);
  let pc = lc - comum, pf = lf - comum, gc = 0, gf = 0, freio = 0;
  const gols = comMinutos ? [] : null;
  for (let b = 0; b < BLOCOS; b++) {
    // Controle de jogo: quem abre 3 gols tira o pé (uma vez só, no resto da partida)
    if (!freio && Math.abs(gc - gf) >= 3) {
      freio = gc > gf ? 1 : 2;
      if (freio === 1) { pc *= MOTOR.CONTROLE[0]; pf *= MOTOR.CONTROLE[1]; } else { pf *= MOTOR.CONTROLE[0]; pc *= MOTOR.CONTROLE[1]; }
    }
    const x = poisson(rng, pc / BLOCOS), y = poisson(rng, pf / BLOCOS), z = comum > 0 ? poisson(rng, comum / BLOCOS) : 0;
    if (comMinutos) {
      const min = () => b * 15 + 1 + Math.floor(rng() * 15);
      for (let i = 0; i < x + z; i++) gols.push([min(), 0]);
      for (let i = 0; i < y + z; i++) gols.push([min(), 1]);
    }
    gc += x + z; gf += y + z;
  }
  if (comMinutos) gols.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { gc, gf, gols };
}
export function sortearPlacar(rng, Fc, Ff, neutro = false) {
  const { gc, gf } = jogarBlocos(rng, Fc, Ff, neutro);
  return [gc, gf];
}

// ---------- Gols, cartões, substituições e notas ----------
export const PESO_GOL = { CA: 5, SA: 4, PE: 3.5, PD: 3.5, MEI: 3, ME: 2.5, MD: 2.5, MC: 1.5, VOL: 1, LE: 0.8, LD: 0.8, ZAG: 0.6, GOL: 0 };
export const PESO_ASSIST = { MEI: 4, PE: 3.5, PD: 3.5, ME: 3, MD: 3, SA: 3, MC: 2.5, LE: 2, LD: 2, CA: 2, VOL: 1.2, ZAG: 0.5, GOL: 0.1 };
// Chance relativa de levar cartão amarelo, por posição
export const PESO_CARTAO = { VOL: 1.6, ZAG: 1.4, LD: 1.2, LE: 1.2, MC: 1.1, MD: 0.9, ME: 0.9, MEI: 0.8, PE: 0.8, PD: 0.8, SA: 0.8, CA: 0.9, GOL: 0.3 };
export const AMARELOS_POR_TIME = 1.9; // média de amarelos por time no jogo (Poisson)
export const MAX_TROCAS = 5;
const OFENSIVO = { gol: 0, def: 1, mei: 2, ata: 3 };
const golsPorJogo = (p) => (p.st && p.st[0] > 0 ? p.st[1] / p.st[0] : 0);
const emCampo = (x, m) => x.entra < m && m <= x.sai;
// Quem entra pode ocupar a vaga de quem sai? Só "ideal" ou "boa" (nunca improvisado)
export const podeEntrar = (vaga, pos) => { const n = nivel(vaga, pos); return n === "ideal" || n === "boa"; };

// Nota do jogo (6,0 a 9,5): 6,6 + vitória +0,3 / derrota −0,3 + 0,8 por gol + 0,5 por assistência
// + 0,4 para goleiro e defensor sem sofrer gol − 0,2 por amarelo + a forma do jogador no dia (até ±0,3).
function nota(x, saldo, sofridos) {
  let n = 6.6 + (saldo > 0 ? 0.3 : saldo < 0 ? -0.3 : 0) + 0.8 * x.g + 0.5 * x.a - 0.2 * x.am + x.forma;
  const setor = SETOR[x.p.pos];
  if ((setor === "gol" || setor === "def") && sofridos === 0) n += 0.4;
  return Math.round(Math.min(9.5, Math.max(6, n)) * 10) / 10;
}
// Nota parcial (para decidir quem sai): a mesma conta com o placar do momento
const notaParcial = (x, saldo) => 6.6 + (saldo > 0 ? 0.3 : saldo < 0 ? -0.3 : 0) + 0.8 * x.g + 0.5 * x.a - 0.2 * x.am + x.forma;

// Paradas para substituição de um time (minutos), decididas com o placar já sorteado (gols = [[minuto, lado]]):
// até 3 paradas + intervalo; a 1ª entre 55' e 65', as outras entre 65' e 85'. Time perdendo troca mais cedo
// (no intervalo mais vezes e a 1ª parada entre 55' e 60').
function paradasDo(rng, lado, gols) {
  const saldoEm = (m) => gols.reduce((s, [min, l]) => (min < m ? s + (l === lado ? 1 : -1) : s), 0);
  const paradas = [];
  if (rng() < (saldoEm(46) < 0 ? 0.6 : 0.15)) paradas.push(46);
  const p1 = saldoEm(55) < 0 ? 55 + Math.floor(rng() * 6) : 58 + Math.floor(rng() * 8);
  paradas.push(p1);
  const p2 = Math.max(p1 + 3, 66 + Math.floor(rng() * 10));
  paradas.push(p2);
  if (rng() < 0.75) paradas.push(Math.min(85, Math.max(p2 + 3, 76 + Math.floor(rng() * 10))));
  return paradas;
}

// Jogo completo. Devolve { gc, gf, eventos: [[minuto, lado (0 casa, 1 fora), id do autor, id da assistência]],
// jogadores: [[id, lado, gols, assistências, nota]], subs: [[minuto, lado, id de quem sai, id de quem entra]],
// cartoes: [[minuto, lado, id]] }.
// O placar e os minutos dos gols vêm do jogo em blocos (jogarBlocos); o resto é decidido em ordem de minuto: cada gol
// é de alguém em campo, cada cartão também, e as trocas olham o placar, os cartões e as notas daquele momento.
// Substituições: quem entra ocupa a vaga de quem sai e precisa ser "ideal" ou "boa" nela (sem reserva assim, não troca);
// no seu clube, primeiro os reservas escolhidos para a vaga na aba Time (time.reservas[i]), na ordem. Quem sai: quem tem
// amarelo, depois a menor nota parcial, depois o mais velho (cansaço); nunca o goleiro. Perdendo: entra o mais ofensivo
// compatível; ganhando por 2+: o mais defensivo compatível; senão, o de maior overall (ideal antes de boa).
export function jogarPartida(rng, casa, fora, neutro = false) {
  const { gc, gf, gols } = jogarBlocos(rng, casa.forca, fora.forca, neutro, true);
  const lados = [casa, fora].map((time) => ({
    time,
    campo: time.onze.map(({ vaga, p }, i) => (p ? { p, vaga, i, entra: 0, sai: 90, g: 0, a: 0, am: 0, forma: (rng() - 0.5) * 0.6 } : null)).filter(Boolean),
    banco: time.banco.slice(0, 7),
    trocas: 0,
  }));
  // Linha do tempo: gols, cartões e paradas, em ordem de minuto (no mesmo minuto: parada, depois gol, depois cartão)
  const linha = gols.map(([m, lado]) => ({ m, o: 1, tipo: "gol", lado }));
  lados.forEach((L, lado) => {
    const n = poisson(rng, AMARELOS_POR_TIME);
    for (let c = 0; c < n; c++) linha.push({ m: 1 + Math.floor(rng() * 90), o: 2, tipo: "cartao", lado });
    paradasDo(rng, lado, gols).forEach((m, j) => linha.push({ m, o: 0, tipo: "parada", lado, j }));
  });
  linha.sort((a, b) => a.m - b.m || a.o - b.o || a.lado - b.lado);

  const eventos = [], subs = [], cartoes = [];
  const placar = [0, 0];
  for (const ev of linha) {
    const L = lados[ev.lado], campo = L.campo.filter((x) => emCampo(x, ev.m));
    if (ev.tipo === "gol") {
      const i = sortearIndice(rng, campo.map((x) => (PESO_GOL[x.p.pos] ?? 1) * (1 + golsPorJogo(x.p)) * (ovrDe(x.p) / 75) ** 2));
      const autor = i >= 0 ? campo[i] : null;
      let assist = null;
      if (autor && rng() < 0.75) {
        const outros = campo.filter((x) => x !== autor);
        const j = sortearIndice(rng, outros.map((x) => PESO_ASSIST[x.p.pos] ?? 1));
        if (j >= 0) assist = outros[j];
      }
      if (autor) autor.g++;
      if (assist) assist.a++;
      placar[ev.lado]++;
      eventos.push([ev.m, ev.lado, autor ? autor.p.id : null, assist ? assist.p.id : null]);
    } else if (ev.tipo === "cartao") {
      const cands = campo.filter((x) => x.am === 0); // segundo amarelo (expulsão) fica fora desta versão
      const i = sortearIndice(rng, cands.map((x) => PESO_CARTAO[x.p.pos] ?? 1));
      if (i < 0) continue;
      cands[i].am = 1;
      cartoes.push([ev.m, ev.lado, cands[i].p.id]);
    } else {
      // Parada: 1 ou 2 trocas (até 5 no jogo)
      if (L.trocas >= MAX_TROCAS) continue;
      const restantes = MAX_TROCAS - L.trocas, paradasRestantes = linha.filter((x) => x.tipo === "parada" && x.lado === ev.lado && x.m > ev.m).length;
      const quer = Math.min(restantes, paradasRestantes === 0 ? restantes : rng() < 0.5 ? 2 : 1, 3);
      const saldo = placar[ev.lado] - placar[1 - ev.lado];
      for (let t = 0; t < quer; t++) {
        const feita = trocar(rng, L, ev.m, saldo, ev.lado, subs);
        if (!feita) break;
      }
    }
  }

  // Notas de quem jogou
  const jogadores = [];
  lados.forEach((L, lado) => {
    const saldo = lado === 0 ? gc - gf : gf - gc, sofridos = lado === 0 ? gf : gc;
    for (const x of L.campo) jogadores.push([x.p.id, lado, x.g, x.a, nota(x, saldo, sofridos)]);
  });
  subs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { gc, gf, eventos, jogadores, subs, cartoes };
}

// Uma troca do time L no minuto m (saldo = gols do time − gols do adversário naquele momento). Devolve true se trocou.
function trocar(rng, L, m, saldo, lado, subs) {
  const usados = new Set(L.campo.map((x) => x.p.id));
  const livres = L.banco.filter((p) => !usados.has(p.id));
  if (!livres.length) return false;
  // Quem sai: titulares de linha ainda em campo (quem entrou não sai), por amarelo, nota parcial e idade
  const saem = L.campo.filter((x) => x.entra === 0 && x.sai === 90 && x.p.pos !== "GOL")
    .sort((a, b) => b.am - a.am || notaParcial(a, saldo) - notaParcial(b, saldo) || (b.p.a || 0) - (a.p.a || 0));
  for (const x of saem) {
    const ok = livres.filter((p) => podeEntrar(x.vaga, p.pos));
    if (!ok.length) continue;
    const escolhidos = (L.time.reservas?.[x.i] || []).map((id) => ok.find((p) => p.id === id)).filter(Boolean);
    const ordem = (p) => (nivel(x.vaga, p.pos) === "ideal" ? 0 : 1);
    const of = (p) => OFENSIVO[SETOR[p.pos]] ?? 2;
    const resto = ok.filter((p) => !escolhidos.includes(p)).sort((a, b) =>
      saldo < 0 ? of(b) - of(a) || ovrDe(b) - ovrDe(a)
        : saldo >= 2 ? of(a) - of(b) || ovrDe(b) - ovrDe(a)
          : ordem(a) - ordem(b) || ovrDe(b) - ovrDe(a));
    const entra = [...escolhidos, ...resto][0];
    x.sai = m;
    L.campo.push({ p: entra, vaga: x.vaga, i: x.i, entra: m, sai: 90, g: 0, a: 0, am: 0, forma: (rng() - 0.5) * 0.6 });
    L.trocas++;
    subs.push([m, lado, x.p.id, entra.id]);
    return true;
  }
  return false;
}