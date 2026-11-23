// Lance a lance de um jogo JÁ simulado (23/11/2026). Gols, minutos, substituições e cartões vêm do motor (salvos no
// resultado); o resto é preenchido em volta, coerente com a força dos times, com uma semente própria ("lances"):
// o mesmo jogo tem sempre a mesma narração, e nada disso muda o resultado.
//   Lances: finalização para fora, defesa do goleiro, bola na trave, escanteio, falta perigosa e impedimento
//           (8 a 14 por jogo), mais os cartões amarelos, as substituições, o intervalo e o fim de jogo.
//   Gols: o tipo (cabeça, chute de fora da área, pênalti, contra-ataque, rebote, finalização na área, chute cruzado)
//         depende da posição do autor; pênalti só em gol sem assistência.
//   Acréscimos: 1 a 4 minutos no 1º tempo e 2 a 6 no 2º (alguns lances caem neles).
//   Estatísticas: posse, finalizações, no alvo, escanteios, faltas e cartões, contadas a partir dos lances.
import { D } from "../dados.js";
import { short } from "../formato.js";
import { poisson, sortearIndice } from "./aleatorio.js";
import { PESO_ASSIST, PESO_CARTAO, PESO_GOL, comprimir } from "./motor.js";

// Frases ({a} = jogador, {g} = goleiro adversário, {t} = time, {e}/{s} = quem entra/sai). Pelo menos 6 por tipo.
export const FRASES = {
  fora: [
    "{a} arrisca de longe e a bola passa à direita do gol.",
    "{a} finaliza de primeira, mas manda por cima do travessão.",
    "{a} bate cruzado e a bola sai rente à trave.",
    "{a} tenta a colocada e erra o alvo por pouco.",
    "{a} pega mal na bola e a finalização vai para fora.",
    "{a} cabeceia sozinho, mas a bola sai por cima.",
    "{a} recebe na entrada da área e chuta para fora.",
  ],
  defesa: [
    "{a} bate colocado e {g} espalma para escanteio.",
    "{a} chuta forte e {g} segura firme.",
    "Defesaça! {g} voa para tirar a finalização de {a}.",
    "{a} cabeceia no canto e {g} faz grande defesa.",
    "{a} sai cara a cara, mas {g} fecha o ângulo e defende.",
    "{a} arrisca de fora e {g} encaixa sem dar rebote.",
    "{g} sai bem do gol e abafa a finalização de {a}.",
  ],
  trave: [
    "Na trave! {a} acerta o poste e a bola volta para o campo.",
    "{a} carimba o travessão! Quase o gol.",
    "Uh! {a} bate colocado e a bola explode na trave.",
    "{a} cabeceia, a bola bate no pé da trave e sai.",
    "Que chance! {a} chuta e a bola raspa o travessão.",
    "{a} finaliza rasteiro e a trave salva o goleiro.",
  ],
  escanteio: [
    "Escanteio para o {t}. {a} vai para a cobrança e a zaga afasta.",
    "{a} cobra escanteio fechado e o goleiro sai do gol para socar.",
    "Escanteio curto do {t}; {a} cruza e a defesa corta.",
    "{a} levanta na área no escanteio, mas ninguém alcança.",
    "Pressão do {t}: mais um escanteio, cobrado por {a}.",
    "{a} cobra o escanteio na primeira trave e a defesa tira.",
  ],
  falta: [
    "Falta perigosa na entrada da área. {a} cobra e a barreira desvia.",
    "{a} cobra falta por cima da barreira, rente ao travessão.",
    "Falta para o {t} perto da área; {a} rola e o chute é bloqueado.",
    "{a} bate a falta com efeito e {g} afasta de soco.",
    "Falta frontal! {a} chuta forte, mas a bola para na barreira.",
    "{a} cobra falta lateral na área e a zaga tira de cabeça.",
  ],
  impedimento: [
    "{a} recebe em posição irregular: impedimento.",
    "Bandeira levantada! {a} estava impedido.",
    "{a} chega a empurrar para o gol, mas o lance é anulado por impedimento.",
    "Lançamento para {a}, mas o assistente marca impedimento.",
    "{a} sai em velocidade, porém estava adiantado. Impedimento.",
    "Linha de impedimento bem feita: {a} fica em posição irregular.",
  ],
  cartao: [
    "Cartão amarelo para {a} por falta dura.",
    "{a} para o contra-ataque com falta e leva amarelo.",
    "{a} reclama demais e recebe o cartão amarelo.",
    "Amarelo para {a}, que chegou atrasado na dividida.",
    "{a} puxa a camisa do adversário: cartão amarelo.",
    "O árbitro mostra o amarelo para {a} por retardar o jogo.",
  ],
  sub: [
    "Substituição no {t}: entra {e}, sai {s}.",
    "{t} mexe: {s} deixa o campo para a entrada de {e}.",
    "Troca no {t}. {e} no lugar de {s}.",
    "Sai {s}, entra {e}. Mudança no {t}.",
    "{e} vai para o jogo no lugar de {s}.",
    "O técnico do {t} chama {e}; {s} é substituído.",
  ],
  intervalo: [
    "Fim do primeiro tempo.",
    "O árbitro apita o fim da primeira etapa.",
    "Intervalo! Os times vão para o vestiário.",
    "Termina o primeiro tempo.",
    "Fim da primeira etapa. Hora do intervalo.",
    "Apita o árbitro: intervalo.",
  ],
  fim: [
    "Fim de jogo!",
    "O árbitro encerra a partida!",
    "Acabou! Apito final.",
    "Termina o jogo!",
    "Fim de papo! O árbitro apita o fim.",
    "Apito final do árbitro!",
  ],
  // Disputa por pênaltis
  penGol: [
    "{a} bate no canto e converte.",
    "{a} desloca {g} e marca.",
    "{a} cobra forte, no alto: gol.",
    "{a} bate com categoria, rasteiro, e converte.",
    "{a} espera o goleiro e toca no outro canto.",
    "{a} enche o pé e a bola estufa a rede.",
  ],
  penPerde: [
    "{g} defende a cobrança de {a}!",
    "{a} bate para fora!",
    "{a} acerta a trave!",
    "{a} isola a cobrança por cima do gol!",
    "{g} adivinha o canto e pega a cobrança de {a}!",
    "{a} bate fraco e {g} segura!",
  ],
  // Gols
  cabeca: [
    "Escanteio na área e {a} sobe mais alto para cabecear no canto!",
    "{a} testa firme após o escanteio e manda para a rede!",
    "{a} aparece na primeira trave e desvia de cabeça!",
    "Bola levantada na área e {a} cabeceia para baixo, sem chance para {g}!",
    "{a} ganha da zaga pelo alto e marca de cabeça!",
    "Cruzamento na medida e {a}, de cabeça, estufa a rede!",
  ],
  foraArea: [
    "{a} arrisca de fora da área e acerta o ângulo!",
    "Que golaço! {a} solta a bomba de longe e {g} só olha!",
    "{a} bate colocado da entrada da área, no cantinho!",
    "{a} domina, ajeita e chuta de fora: a bola morre no fundo da rede!",
    "Chute de longe de {a}, a bola quica e engana {g}!",
    "{a} acerta um chute de fora da área no canto, indefensável!",
  ],
  penalti: [
    "Pênalti! {a} bate no canto e converte.",
    "{a} cobra o pênalti com categoria, deslocando {g}.",
    "{a} cobra forte, no alto, e não dá chance a {g}.",
    "Pênalti marcado: {a} bate rasteiro e marca.",
    "{a} espera o goleiro cair e toca no outro canto.",
    "{a} vai para a cobrança do pênalti e manda a bola no ângulo.",
  ],
  contra: [
    "Contra-ataque rápido! {a} dispara e finaliza na saída de {g}!",
    "{a} puxa o contra-ataque em velocidade e bate para marcar!",
    "Roubada no meio e {a} sai em velocidade para tocar na saída do goleiro!",
    "Contragolpe fatal: {a} recebe livre e não perdoa!",
    "{a} arranca pela ponta no contra-ataque e chuta no canto!",
    "Saída rápida, {a} corre sozinho e finaliza com tranquilidade!",
  ],
  rebote: [
    "{g} rebate e {a} aproveita o rebote para marcar!",
    "Bate-rebate na área e {a} empurra para a rede!",
    "{a} chega primeiro na sobra e manda para o gol!",
    "O chute explode na trave, {a} pega o rebote e marca!",
    "{g} espalma no meio da área e {a} não perdoa!",
    "Confusão na pequena área e {a} completa para o gol!",
  ],
  area: [
    "{a} recebe na área, gira e finaliza no canto!",
    "{a} domina na marca do pênalti e bate firme para marcar!",
    "{a} se antecipa à zaga e toca na saída de {g}!",
    "Tabela na área e {a} finaliza de primeira!",
    "{a} recebe cruzamento rasteiro e só empurra para a rede!",
    "{a} ganha na corrida, entra na área e bate firme!",
  ],
  cruzado: [
    "{a} corta para dentro e bate cruzado, no canto oposto!",
    "{a} invade a área pela ponta e chuta cruzado para marcar!",
    "{a} limpa o marcador e finaliza cruzado, sem chance para {g}!",
    "Jogada individual de {a}, que bate cruzado e faz o gol!",
    "{a} recebe aberto, avança e chuta cruzado na saída de {g}!",
    "{a} puxa para o pé bom e acerta um chute cruzado no canto!",
  ],
};
export const TIPOS_GOL = { cabeca: "de cabeça", foraArea: "de fora da área", penalti: "de pênalti", contra: "no contra-ataque", rebote: "no rebote", area: "dentro da área", cruzado: "chute cruzado" };
// Tipo do gol pela posição do autor: [tipo, peso]
const GOL_POR_POS = {
  ZAG: [["cabeca", 0.65], ["rebote", 0.25], ["foraArea", 0.1]],
  LD: [["cabeca", 0.3], ["foraArea", 0.4], ["rebote", 0.3]], LE: [["cabeca", 0.3], ["foraArea", 0.4], ["rebote", 0.3]],
  VOL: [["cabeca", 0.3], ["foraArea", 0.45], ["rebote", 0.25]],
  MC: [["foraArea", 0.45], ["area", 0.25], ["contra", 0.15], ["rebote", 0.15]], MEI: [["foraArea", 0.45], ["area", 0.25], ["contra", 0.15], ["rebote", 0.15]],
  PE: [["contra", 0.35], ["cruzado", 0.4], ["rebote", 0.15], ["foraArea", 0.1]], PD: [["contra", 0.35], ["cruzado", 0.4], ["rebote", 0.15], ["foraArea", 0.1]],
  ME: [["contra", 0.35], ["cruzado", 0.4], ["rebote", 0.15], ["foraArea", 0.1]], MD: [["contra", 0.35], ["cruzado", 0.4], ["rebote", 0.15], ["foraArea", 0.1]],
  CA: [["area", 0.55], ["cabeca", 0.25], ["rebote", 0.15], ["contra", 0.05]], SA: [["area", 0.5], ["cabeca", 0.15], ["rebote", 0.15], ["contra", 0.2]],
};
const LANCES = [["chance", 0.5], ["escanteio", 0.2], ["falta", 0.15], ["impedimento", 0.15]];
const CHANCES = [["fora", 0.45], ["defesa", 0.35], ["trave", 0.2]];
const sortear = (rng, lista) => lista[sortearIndice(rng, lista.map((x) => x[1]))][0];
const frase = (rng, tipo, v) => FRASES[tipo][Math.floor(rng() * FRASES[tipo].length)].replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
// Ordem dos lances no mesmo instante
const ORDEM = { marco: 0, chance: 1, escanteio: 1, falta: 1, impedimento: 1, cartao: 2, sub: 3, gol: 4 };

// jogo = [casa, fora, gc, gf, eventos, subs?, cartoes?]; times = [time casa, time fora] (onze/banco/forca, como no motor);
// jogador(id) = o jogador (D.BYID ou jogador criado); nomeTime(k). Devolve { lances, acrescimos: [1º, 2º], base }.
// Cada lance: { min, acr (minutos de acréscimo, 0 no tempo normal), t (instante para ordenar), tipo, lado, txt, ... }.
export function narrarJogo(rng, jogo, times, jogador, nomeTime) {
  const [c, f, gc, gf, eventos, subs = [], cartoesSalvos] = jogo;
  const nomeP = (id) => { const p = id && jogador(id); return p ? short(p.n) : "—"; };
  const acrescimos = [1 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 5)];
  const instante = (min, acr = 0) => min + acr / 10;
  // Quem está em campo em cada minuto (titulares e quem entrou)
  const emCampo = (lado, min) => {
    const s = subs.filter((x) => x[1] === lado && x[0] < min);
    const saiu = new Set(s.map((x) => x[2]));
    return [...times[lado].onze.map((x) => x.p).filter((p) => p && !saiu.has(p.id)), ...s.map((x) => jogador(x[3]))].filter(Boolean);
  };
  const goleiro = (lado, min) => emCampo(lado, min).find((p) => p.pos === "GOL");
  const nomeGoleiro = (lado, min) => { const g = goleiro(lado, min); return g ? short(g.n) : "o goleiro"; };
  const linha = (lado, min) => emCampo(lado, min).filter((p) => p.pos !== "GOL");
  const quem = (lado, min, pesos) => { const ps = linha(lado, min); const i = sortearIndice(rng, ps.map((p) => pesos[p.pos] ?? 1)); return i >= 0 ? ps[i] : null; };
  const lances = [];

  // Gols (do motor)
  for (const [min, lado, autor, assist] of eventos) {
    const p = autor && jogador(autor);
    let tipo = sortear(rng, GOL_POR_POS[p?.pos] || [["rebote", 1]]);
    if (!assist && rng() < 0.35) tipo = "penalti";
    const txt = frase(rng, tipo, { a: nomeP(autor), g: nomeGoleiro(1 - lado, min) });
    lances.push({ min, acr: 0, tipo: "gol", lado, autor, assist: tipo === "penalti" ? null : assist, golTipo: tipo, txt, esc: /escanteio/i.test(txt) });
  }
  // Substituições (do motor)
  for (const [min, lado, sai, entra] of subs) lances.push({ min, acr: 0, tipo: "sub", lado, sai, entra, txt: frase(rng, "sub", { t: nomeTime(lado ? f : c), e: nomeP(entra), s: nomeP(sai) }) });
  // Cartões (do motor; saves antigos não têm: são sorteados aqui, entre quem estava em campo)
  const cartoes = cartoesSalvos || [0, 1].flatMap((lado) => Array.from({ length: poisson(rng, 1.9) }, () => {
    const min = 1 + Math.floor(rng() * 90), p = quem(lado, min, PESO_CARTAO);
    return p ? [min, lado, p.id] : null;
  }).filter(Boolean));
  for (const [min, lado, id] of cartoes) lances.push({ min, acr: 0, tipo: "cartao", lado, autor: id, txt: frase(rng, "cartao", { a: nomeP(id) }) });

  // Lances que não viraram gol: 8 a 14, divididos pela força (o mais forte ataca mais; o mandante um pouco mais)
  const d = comprimir((times[0].forca || 70) - (times[1].forca || 70));
  const parteCasa = Math.min(0.75, Math.max(0.25, 0.53 + 0.04 * d));
  const n = 8 + Math.floor(rng() * 7);
  for (let k = 0; k < n; k++) {
    const lado = rng() < parteCasa ? 0 : 1;
    let min = 1 + Math.floor(rng() * 90), acr = 0;
    if (rng() < 0.08) { const tempo2 = rng() < 0.6; min = tempo2 ? 90 : 45; acr = 1 + Math.floor(rng() * acrescimos[tempo2 ? 1 : 0]); }
    const tipo = sortear(rng, LANCES);
    const g = nomeGoleiro(1 - lado, min), t = nomeTime(lado ? f : c);
    if (tipo === "chance") {
      const p = quem(lado, min, PESO_GOL), como = sortear(rng, CHANCES);
      if (!p) continue;
      const txt = frase(rng, como, { a: short(p.n), g });
      lances.push({ min, acr, tipo, como, lado, autor: p.id, txt, esc: /escanteio/i.test(txt) });
    } else {
      const p = quem(lado, min, tipo === "impedimento" ? PESO_GOL : PESO_ASSIST);
      if (!p) continue;
      lances.push({ min, acr, tipo, lado, autor: p.id, txt: frase(rng, tipo, { a: short(p.n), g, t }) });
    }
  }
  // Marcos: começo, intervalo (depois dos acréscimos do 1º tempo) e fim (depois dos do 2º)
  lances.push({ min: 0, acr: 0, tipo: "marco", marco: "inicio", txt: "Começa o jogo!" });
  lances.push({ min: 45, acr: acrescimos[0] + 0.5, tipo: "marco", marco: "intervalo", txt: frase(rng, "intervalo", {}) });
  lances.push({ min: 90, acr: acrescimos[1] + 0.5, tipo: "marco", marco: "fim", txt: `${frase(rng, "fim", {})} ${nomeTime(c)} ${gc} × ${gf} ${nomeTime(f)}.` });
  lances.forEach((x, i) => { x.t = instante(x.min, x.acr); x.n = i; });
  lances.sort((a, b) => a.t - b.t || (ORDEM[a.tipo] ?? 1) - (ORDEM[b.tipo] ?? 1) || a.n - b.n);

  // Base das estatísticas: posse (pela força, com o mando) e as faltas "comuns" que não viram lance
  const posseCasa = Math.round(Math.min(68, Math.max(32, 50 + 1.8 * d + 2 + (rng() - 0.5) * 6)));
  const base = { posse: [posseCasa, 100 - posseCasa], faltas: [6 + Math.floor(rng() * 7), 6 + Math.floor(rng() * 7)] };
  return { lances, acrescimos, base };
}

// Disputa por pênaltis para o jogo ao vivo: pen = { placar: [casa, fora], cob: [[lado, id, 1|0]] } (já do ponto de vista
// do jogo: lado 0 = mandante). Cada cobrança vira um lance { tipo: "penalti", ok, lado, t } depois do fim do tempo normal,
// mais um marco final. goleiro(lado) = nome do goleiro do lado (o que defende a cobrança do outro lado).
export function narrarPenaltis(rng, pen, jogador, nomeTime, casa, fora, goleiro) {
  const nomeP = (id) => { const p = id && jogador(id); return p ? short(p.n) : "O batedor"; };
  const parcial = [0, 0];
  const lances = pen.cob.map(([lado, id, ok], k) => {
    parcial[lado] += ok;
    const txt = frase(rng, ok ? "penGol" : "penPerde", { a: nomeP(id), g: goleiro(1 - lado) });
    return { min: 90, acr: 0, t: 91 + (k + 1) / 100, tipo: "penalti", lado, autor: id, ok: !!ok, parcial: [...parcial], txt, n: 1000 + k };
  });
  const [x, y] = pen.placar, vence = x > y ? casa : fora;
  lances.push({ min: 90, acr: 0, t: 91 + (pen.cob.length + 1) / 100, tipo: "marco", marco: "penaltis", txt: `${nomeTime(vence)} vence nos pênaltis por ${Math.max(x, y)} a ${Math.min(x, y)}!`, n: 1999 });
  return lances;
}

// Estatísticas até o instante t (inclusive), contadas a partir dos lances: { posse, final, alvo, esc, faltas, cartoes }
// (cada uma [casa, fora]). Falta perigosa a favor de um time é falta do outro; cada amarelo também é uma falta.
export function estatisticasAte(narr, t = Infinity) {
  const s = { posse: narr.base.posse, final: [0, 0], alvo: [0, 0], esc: [0, 0], faltas: [0, 0], cartoes: [0, 0] };
  const fracao = Math.min(1, Math.max(0, t / 90));
  s.faltas = narr.base.faltas.map((x) => Math.round(x * fracao));
  for (const x of narr.lances) {
    if (x.t > t || x.lado == null) continue;
    const l = x.lado;
    if (x.tipo === "gol") { s.final[l]++; s.alvo[l]++; }
    if (x.tipo === "chance") { s.final[l]++; if (x.como === "defesa") s.alvo[l]++; }
    if (x.tipo === "escanteio" || x.esc) s.esc[l]++;
    if (x.tipo === "falta") s.faltas[1 - l]++;
    if (x.tipo === "cartao") { s.cartoes[l]++; s.faltas[l]++; }
  }
  return s;
}
