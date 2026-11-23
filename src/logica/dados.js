// Carrega o data.json e monta as listas que o resto do app usa.
import { norm } from "./formato.js";

// "D" guarda os dados carregados. É preenchido uma vez só, por carregarDados().
//   D.DATA    o data.json inteiro
//   D.CLUBS   lista de clubes        D.CL[k]   clube pela chave (ex.: "T42")
//   D.LEAGUES lista de ligas         D.LG[k]   liga pela chave (ex.: "BRA")
//   D.ALL     todos os jogadores     D.BYID[id] jogador pelo id (ex.: "T42-3")
//   D.APELIDOS apelido → nome do jogador, os dois já preparados para a busca ("gabigol" → "gabriel barbosa")
//   Cada jogador pode ter p.ovr (overall, de overall.json com os ajustes manuais por cima) e p.atr (atributos)
//   D.ESTRANGEIROS regras de limite de estrangeiros (regras-estrangeiros.json) ou null
//   D.EMP     empréstimos por clube: { "<clube>": { in: [ids recebidos], out: [{ id, para: {k, n}, ate, contrato }] } }
//   D.ACESSO  acesso e rebaixamento da temporada simulada (acesso-rebaixamento.json) ou null
//   D.ZONAS   faixas coloridas da tabela do simulador (zonas-ligas.json) ou null
//   D.ATUAL   tabelas reais da temporada atual por liga (temporada-atual.json, campo "ligas") ou null; D.ATUAL_DATA = "atualizado"
//   D.FORMATOS formato de cada liga na temporada simulada (formatos-ligas.json, campo "ligas") ou null
//   D.COPAS   copas da temporada simulada (copas.json: { copas, por_liga, fora_nesta_versao }) ou null
export const D = { DATA: null, CLUBS: [], LEAGUES: [], LG: {}, CL: {}, ALL: [], BYID: {}, APELIDOS: {}, EMP: {}, ESTRANGEIROS: null, ACESSO: null, ZONAS: null,
  ATUAL: null, ATUAL_DATA: "", FORMATOS: null, COPAS: null };

// Apelidos (public/apelidos.json: { "apelido": "Nome como está no data.json" }). Se falhar, segue sem eles.
async function carregarApelidos() {
  try {
    const a = await fetch("apelidos.json").then((r) => r.json());
    return Object.fromEntries(Object.entries(a).map(([k, v]) => [norm(k.trim()), norm(v)]));
  } catch (e) {
    return {};
  }
}

// Valores estimados de quem está sem valor no Transfermarkt (public/valores-estimados.json, gerado por
// dados-brutos/estimar_valores.py): { "<clube>": { "<nome>|<nascimento>": valor_em_€mi } }. Se falhar, segue sem eles.
async function carregarEstimados() {
  try {
    return await fetch("valores-estimados.json").then((r) => r.json());
  } catch (e) {
    return {};
  }
}

// Overall e atributos (public/overall.json, gerado por dados-brutos/overall/overall.py):
// { "<clube>": { "<nome>|<nascimento>": [overall, estimado (0/1), atributos | null] } }. Se falhar, segue sem eles.
async function carregarOverall() {
  try {
    return await fetch("overall.json").then((r) => r.json());
  } catch (e) {
    return {};
  }
}

// Ajustes manuais do overall (public/overall-ajustes.json): { "<clube>": { "<nome>|<nascimento>": overall } }.
// Quando existe, substitui o número do overall.json (os atributos continuam os mesmos). Se falhar, segue sem eles.
async function carregarAjustesOverall() {
  try {
    return await fetch("overall-ajustes.json").then((r) => r.json());
  } catch (e) {
    return {};
  }
}

// Limite de estrangeiros por liga (public/regras-estrangeiros.json; ver estrangeiros.js). Se falhar ou vier num
// formato estranho, segue sem limites.
async function carregarRegrasEstrangeiros() {
  try {
    const r = await fetch("regras-estrangeiros.json").then((x) => x.json());
    return r && typeof r.ligas === "object" ? r : null;
  } catch (e) {
    return null;
  }
}

// Simulador da temporada: acesso e rebaixamento (public/acesso-rebaixamento.json, com a lista "pares") e as faixas
// coloridas da tabela (public/zonas-ligas.json). Se falhar ou vier num formato estranho, o simulador segue sem eles
// (todas as ligas mantêm a composição atual; a tabela só pinta o campeão).
async function carregarAcesso() {
  try {
    const r = await fetch("acesso-rebaixamento.json").then((x) => x.json());
    return r && Array.isArray(r.pares) ? r : null;
  } catch (e) {
    return null;
  }
}
async function carregarZonas() {
  try {
    const r = await fetch("zonas-ligas.json").then((x) => x.json());
    return r && typeof r === "object" && !Array.isArray(r) && !r.leagues ? r : null;
  } catch (e) {
    return null;
  }
}

// Simulador v2: tabela real da temporada atual e formatos das ligas. Se falhar, o simulador usa o comportamento antigo
// (temporada atual simulada do zero; pontos corridos, turno e returno).
async function carregarLigasDe(arquivo) {
  try {
    const r = await fetch(arquivo).then((x) => x.json());
    return r && r.ligas && typeof r.ligas === "object" && !Array.isArray(r.ligas) ? r : null;
  } catch (e) {
    return null;
  }
}

// Copas (public/copas.json). Se falhar ou vier sem "copas" e "por_liga", o simulador segue só com a liga.
async function carregarCopas() {
  try {
    const r = await fetch("copas.json").then((x) => x.json());
    return r && r.copas && r.por_liga && typeof r.copas === "object" ? r : null;
  } catch (e) {
    return null;
  }
}

// Empréstimos (public/emprestimos.json, do Transfermarkt). Se falhar, segue sem eles.
async function carregarEmprestimos() {
  try {
    return await fetch("emprestimos.json").then((r) => r.json());
  } catch (e) {
    return {};
  }
}

// Posição do Transfermarkt (como vem nos emprestados que não estão na base) → código do site
const POS_TM = { Goleiro: "GOL", Zagueiro: "ZAG", Defensores: "ZAG", "Lateral Dir.": "LD", "Lateral Esq.": "LE", Volante: "VOL",
  "Meia Central": "MC", "Meio-Campo": "MC", "Meia Ofensivo": "MEI", "Meia Direita": "MD", "Meia Esquerda": "ME",
  "Ponta-Direita": "PD", "Ponta-Esquerda": "PE", "Seg. Atacante": "SA", Atacante: "CA", Centroavante: "CA" };

// Liga os empréstimos aos jogadores. Cada jogador emprestado ganha p.emp = { de: {k, n}, ate, contrato }
// (de = clube dono). Quem foi emprestado para um clube fora da base vira um jogador "avulso" (só no D.BYID,
// fora do Mercado), com os dados do próprio item. Um jogador que aparece no elenco do dono E no clube onde está
// fica só no clube onde está (assim ele aparece uma vez só no Mercado).
function montarEmprestimos(E) {
  const chave = (k, n, nasc) => k + "|" + n + "|" + nasc;
  const porChave = {};
  D.ALL.forEach((p) => { porChave[chave(p.club, p.n, p.nasc)] = p; });
  const emp = (k) => (D.EMP[k] = D.EMP[k] || { in: [], out: [] });
  const marcar = (p, dono, ate, contrato) => { if (!p.emp) p.emp = { de: { k: dono.k, n: dono.n }, ate, contrato }; };
  const fora = (dono, item) => { if (!emp(dono).out.some((o) => o.id === item.id)) emp(dono).out.push(item); };
  const duplicados = new Set();
  // 1. Recebidos ("in"): já estão no elenco de quem pegou emprestado
  for (const [k, x] of Object.entries(E)) {
    if (!D.CL[k]) continue;
    for (const it of x.in || []) {
      const p = porChave[chave(k, it.nome, it.nasc)];
      if (!p) continue;
      marcar(p, it.de, it.ate, it.contrato);
      emp(k).in.push(p.id);
    }
  }
  // 2. Emprestados ("out"): no elenco de outro clube da base ("em") ou fora da base (jogador avulso)
  for (const [k, x] of Object.entries(E)) {
    if (!D.CL[k]) continue;
    const dono = { k, n: D.CL[k].n };
    (x.out || []).forEach((it, i) => {
      let p = it.em && porChave[chave(it.em.k, it.em.nome, it.em.nasc)];
      if (p) {
        marcar(p, dono, it.ate, it.contrato);
        const copia = porChave[chave(k, it.em.nome, it.em.nasc)]; // ele também está no elenco do dono?
        if (copia && copia !== p) duplicados.add(copia.id);
      } else {
        p = { id: k + "-e" + i, num: "", n: it.nome, nn: norm(it.nome), pos: POS_TM[it.pos] || "MC", ctr: it.contrato, v: it.valor || 0,
          vEst: false, nat: "", a: +it.idade || 0, st: null, sp: -1, hd: 0, lg: D.CL[k].lg, club: k, end26: false, avulso: true,
          emp: { de: dono, ate: it.ate, contrato: it.contrato } };
        D.BYID[p.id] = p;
      }
      fora(k, { id: p.id, para: { k: it.para?.k || null, n: it.para?.n || "" }, ate: it.ate, contrato: it.contrato });
    });
  }
  // 3. Recebidos que não estavam na lista do dono: entram nos emprestados dele também
  for (const [k, x] of Object.entries(E)) {
    for (const it of x.in || []) {
      const p = porChave[chave(k, it.nome, it.nasc)];
      if (p && D.CL[it.de?.k]) fora(it.de.k, { id: p.id, para: { k, n: D.CL[k].n }, ate: it.ate, contrato: it.contrato });
    }
  }
  // 4. Tira do D.ALL a cópia que está no elenco do dono (continua no D.BYID, para planos antigos)
  if (duplicados.size) D.ALL = D.ALL.filter((p) => !duplicados.has(p.id));
}

export async function carregarDados() {
  const [DATA, APELIDOS, ESTIMADOS, EMPRESTIMOS, OVERALL, AJUSTES, ESTRANGEIROS, ACESSO, ZONAS, ATUAL, FORMATOS, COPAS] = await Promise.all([fetch("data.json").then((r) => r.json()),
    carregarApelidos(), carregarEstimados(), carregarEmprestimos(), carregarOverall(), carregarAjustesOverall(), carregarRegrasEstrangeiros(),
    carregarAcesso(), carregarZonas(), carregarLigasDe("temporada-atual.json"), carregarLigasDe("formatos-ligas.json"), carregarCopas()]);
  Object.assign(D, { DATA, APELIDOS, ESTRANGEIROS, ACESSO, ZONAS, LG: {}, CL: {}, ALL: [], BYID: {}, EMP: {} }); // começa do zero
  D.ATUAL = ATUAL?.ligas || null;
  D.ATUAL_DATA = ATUAL?.atualizado || "";
  D.FORMATOS = FORMATOS?.ligas || null;
  D.COPAS = COPAS;
  D.CLUBS = DATA.clubs;
  D.LEAGUES = DATA.leagues;

  // Ligas de calendário anual (temporada "2026") planejam "2027"; as outras, "27/28"
  D.LEAGUES.forEach((l) => {
    l.cal = /^\d{4}$/.test(l.season);
    l.plan = l.cal ? "2027" : "27/28";
    D.LG[l.k] = l;
  });

  D.CLUBS.forEach((c) => {
    D.CL[c.k] = c;
    c.nn = norm(c.n);
    const L = D.LG[c.lg];
    // Data de referência para a idade e limite de contrato "acabando"
    const ref = L.cal ? new Date(2027, 0, 1) : new Date(2027, 6, 1);
    const lim = L.cal ? "2026-12" : "2027-06";
    c.p.forEach((r, i) => {
      const [num, n, pos, dob, ctr, v, nat, sp, st, hd] = r;
      const b = new Date(dob);
      let a = ref.getFullYear() - b.getFullYear();
      if (new Date(ref.getFullYear(), b.getMonth(), b.getDate()) > ref) a--;
      if (!dob) a = 0;
      // Valor: o real do Transfermarkt sempre tem prioridade; sem ele (0), o estimado, marcado com "vEst"
      const est = v > 0 ? undefined : ESTIMADOS?.[c.k]?.[n + "|" + dob];
      const p = { id: c.k + "-" + i, num, n, nn: norm(n), nasc: dob, pos, ctr, v: est > 0 ? est : v, vEst: est > 0, nat, a, st, sp, hd, lg: c.lg, club: c.k, end26: !!ctr && ctr <= lim };
      // Overall e atributos ({ tipo: "L"|"G", v: [5 números] } ou null). O 2º campo do overall.json não é usado.
      const o = OVERALL?.[c.k]?.[n + "|" + dob];
      if (o) { p.ovr = o[0]; p.atr = o[2] || null; }
      // Ajuste manual: troca só o número do overall (vale em tudo: listas, força do time, ordem e recomendação)
      const aj = AJUSTES?.[c.k]?.[n + "|" + dob];
      if (typeof aj === "number") { p.ovr = aj; p.atr = p.atr || null; }
      D.ALL.push(p);
      D.BYID[p.id] = p;
    });
  });
  montarEmprestimos(EMPRESTIMOS || {});
}
