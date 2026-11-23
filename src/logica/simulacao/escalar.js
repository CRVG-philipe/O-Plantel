// Escalação dos times no simulador.
//   Seu clube: o elenco do plano (contratações, vendas, empréstimos, "trazer de volta"...) e a escalação da aba Time
//              (titulares + reservas). Vaga vazia é preenchida sozinha.
//   Outros clubes: o elenco atual do data.json, sem quem o seu plano contratou. Formação 4-3-3 (ou 4-4-2 se faltar
//              ponta), os melhores overalls por vaga (tabela de compatibilidade) e o limite de estrangeiros da liga.
import { D } from "../dados.js";
import { FORMS, ORDER } from "../constantes.js";
import { compatibilidade } from "../compatibilidade.js";
import { elencoAtual } from "../elenco.js";
import { passada, reservasDa } from "../escalacao.js";
import { ehEstrangeiro, regraDaLiga } from "../estrangeiros.js";
import { calcularForca, ovrDe } from "./motor.js";

const TAM_BANCO = 7;
const porOverall = (a, b) => ovrDe(b) - ovrDe(a) || b.v - a.v;
// Quantas posições servem bem (ideal ou boa) numa vaga: as vagas mais difíceis são preenchidas primeiro
const opcoesBoas = (vaga) => ORDER.filter((pos) => compatibilidade(vaga, pos).ordem <= 2).length;
// Passada em que o jogador entra na vaga: 0 a 3 como no "Escalar sozinho"; 4 = fora da tabela (último recurso)
const passadaSim = (vaga, pos) => Math.min(4, passada(vaga, pos));

// Preenche as vagas vazias de "onze" (lista de { vaga, p }) com os melhores de "sq" que ainda não foram usados.
// limiteEst = máximo de estrangeiros em campo (Infinity = sem limite).
function preencher(onze, sq, usados, lg, limiteEst = Infinity) {
  let nEst = onze.filter((x) => x.p && ehEstrangeiro(x.p, lg)).length;
  const ord = onze.map((x, i) => i).sort((a, b) => opcoesBoas(onze[a].vaga) - opcoesBoas(onze[b].vaga));
  for (let ordem = 0; ordem <= 4; ordem++)
    for (const i of ord) {
      if (onze[i].p) continue;
      const c = sq.filter((p) => !usados.has(p.id) && passadaSim(onze[i].vaga, p.pos) === ordem && (nEst < limiteEst || !ehEstrangeiro(p, lg))).sort(porOverall)[0];
      if (!c) continue;
      onze[i] = { vaga: onze[i].vaga, p: c };
      usados.add(c.id);
      if (ehEstrangeiro(c, lg)) nEst++;
    }
}

// Troca dois titulares de vaga quando os dois ficam mais perto da posição de origem (ninguém entra nem sai)
function arrumar(onze) {
  const ord = (i, p) => compatibilidade(onze[i].vaga, p.pos).ordem;
  for (let mudou = true, voltas = 0; mudou && voltas < 20; voltas++) {
    mudou = false;
    for (let i = 0; i < onze.length; i++)
      for (let j = i + 1; j < onze.length; j++) {
        const a = onze[i].p, b = onze[j].p;
        if (a && b && ord(i, b) + ord(j, a) < ord(i, a) + ord(j, b)) { onze[i] = { ...onze[i], p: b }; onze[j] = { ...onze[j], p: a }; mudou = true; }
      }
  }
}

// Banco: os melhores que sobraram (até 7), respeitando o limite de estrangeiros relacionados
function montarBanco(sq, usados, lg, sobraEst) {
  const banco = [];
  let est = 0;
  for (const p of sq.filter((x) => !usados.has(x.id)).sort(porOverall)) {
    if (banco.length >= TAM_BANCO) break;
    if (ehEstrangeiro(p, lg)) { if (est >= sobraEst) continue; est++; }
    banco.push(p);
  }
  return banco;
}

// Jogadores de cada clube (índice montado uma vez; refeito se D.ALL mudar, como nos testes que recarregam os dados)
let indice = { de: null, mapa: new Map() };
export function jogadoresDo(k) {
  if (indice.de !== D.ALL) {
    const mapa = new Map();
    for (const p of D.ALL) { if (!mapa.has(p.club)) mapa.set(p.club, []); mapa.get(p.club).push(p); }
    indice = { de: D.ALL, mapa };
  }
  return indice.mapa.get(k) || [];
}

// Força rápida (para potes e completar vagas): média dos 11 maiores overalls do elenco atual (em cache; o cache é
// refeito junto com o índice de jogadores, quando os dados são recarregados)
let cacheRapida = { de: null, mapa: new Map() };
export function forcaRapida(k) {
  if (cacheRapida.de !== D.ALL) cacheRapida = { de: D.ALL, mapa: new Map() };
  let f = cacheRapida.mapa.get(k);
  if (f === undefined) {
    const o = jogadoresDo(k).map((p) => ovrDe(p)).sort((a, b) => b - a).slice(0, 11);
    f = o.length ? o.reduce((s, x) => s + x, 0) / o.length : 50;
    cacheRapida.mapa.set(k, f);
  }
  return f;
}

// Time de um clube que não é o seu. "fora" = ids que não podem jogar por ele (contratados pelo seu plano).
// "lg" = liga em que ele joga na temporada simulada (a regra de estrangeiros é a dela).
// "elenco" (opcional) = lista de jogadores depois da janela da IA
export function escalarClube(k, lg, fora = new Set(), elenco = null) {
  const sq = (elenco || jogadoresDo(k)).filter((p) => p && !fora.has(p.id));
  const pontas = sq.filter((p) => p.pos === "PE" || p.pos === "PD").length;
  const form = pontas >= 2 ? "4-3-3" : "4-4-2";
  const regra = regraDaLiga(lg);
  const limCampo = regra.campo ?? regra.relacionados ?? Infinity;
  const limRel = regra.relacionados ?? Infinity;
  const onze = FORMS[form].map(([vaga]) => ({ vaga, p: null })), usados = new Set();
  preencher(onze, sq, usados, lg, limCampo);
  arrumar(onze);
  const nEst = onze.filter((x) => x.p && ehEstrangeiro(x.p, lg)).length;
  const banco = montarBanco(sq, usados, lg, limRel - nEst);
  return { k, form, onze, banco, forca: calcularForca(onze, banco) };
}

// Time do seu clube, a partir do plano: a escalação da aba Time; vagas vazias são completadas sozinhas.
// Banco: os reservas escolhidos na aba Time (na ordem das vagas) e, se faltar para chegar a 7, os melhores que sobraram.
export function escalarPlano(plano, k = plano.club) {
  const sq = elencoAtual(plano).filter(Boolean);
  const porId = new Map(sq.map((p) => [p.id, p]));
  const ids = new Set(sq.map((p) => p.id)), usados = new Set();
  const onze = FORMS[plano.form].map(([vaga], i) => {
    const id = plano.xi[i];
    const p = id && ids.has(id) && !usados.has(id) ? porId.get(id) : null;
    if (p) usados.add(p.id);
    return { vaga, p };
  });
  const lg = D.CL[k]?.lg;
  preencher(onze, sq, usados, lg);
  const banco = [];
  FORMS[plano.form].forEach((v, i) => reservasDa(plano, i).forEach((id) => {
    if (ids.has(id) && !usados.has(id)) { banco.push(porId.get(id)); usados.add(id); }
  }));
  const escolhidos = banco.length > TAM_BANCO ? banco.sort(porOverall).slice(0, TAM_BANCO) : banco;
  for (const p of sq.filter((x) => !usados.has(x.id)).sort(porOverall)) {
    if (escolhidos.length >= TAM_BANCO) break;
    escolhidos.push(p);
  }
  return { k, form: plano.form, onze, banco: escolhidos, forca: calcularForca(onze, escolhidos) };
}

// Ids do elenco planejado: esses jogadores não jogam por mais ninguém na temporada simulada
export const idsDoPlano = (plano) => new Set(elencoAtual(plano).filter(Boolean).map((p) => p.id));
