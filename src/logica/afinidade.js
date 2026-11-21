// Afinidade de transferência entre ligas: AFINIDADE[ligaDestino][ligaOrigem], de 0 a 1.
// Quanto maior, mais comum é um clube da liga de destino contratar alguém da liga de origem.
// Baseado nos padrões reais do mercado (de onde cada liga costuma comprar). Usado em recomendacao.js.
//
// Regras (a tabela é montada por elas, no fim do arquivo):
//   - mesma liga: 1; divisão de baixo do mesmo país: 0,9; divisão de cima do mesmo país: 0,8
//   - qualquer par sem regra: 0,3
//   - as demais estão nos blocos abaixo, liga de destino por liga de destino

const BR = ["BRA", "BRB", "BRC"];
const SULAM = ["ARG", "URU", "COL", "CHI", "PAR", "ECU", "PER"];
const GRANDES = ["ENG", "ESP", "ITA", "GER", "FRA"];
const SEGUNDAS = ["ENG2", "ESP2", "ITA2", "GER2", "FRA2"];
const VITRINE = ["POR", "NED", "BEL"];
const GOLFO = ["SAU", "QAT", "UAE"];
const NORTE = ["MEX", "USA"];
const ASIA = ["JPN", "KOR", "CHN"];
const NORDICOS = ["NOR", "SWE", "DEN"];
const LESTE = ["POL", "CZE", "CRO", "SRB", "UKR", "ROU", "RUS"];
const CENTRO = ["AUT", "SUI"];

const TODAS = [...BR, ...SULAM, ...GRANDES, ...SEGUNDAS, ...VITRINE, "TUR", "GRE", "SCO", ...CENTRO, ...NORDICOS, ...LESTE, ...GOLFO, ...NORTE, ...ASIA];

// País de cada liga (para "mesma liga / outra divisão do mesmo país")
const PAIS = { BRA: "br", BRB: "br", BRC: "br", ENG: "en", ENG2: "en", ESP: "es", ESP2: "es", ITA: "it", ITA2: "it", GER: "de", GER2: "de", FRA: "fr", FRA2: "fr" };
const DIV = { BRA: 1, BRB: 2, BRC: 3, ENG2: 2, ESP2: 2, ITA2: 2, GER2: 2, FRA2: 2 }; // as outras: 1ª divisão

const PADRAO = 0.3;

// [destinos, origens, valor]: cada liga de "destinos" compra das ligas de "origens" com essa afinidade
const REGRAS = [
  // Brasil: muito da América do Sul e de Portugal; médio do México, EUA, Golfo e Japão (brasileiros voltando);
  // baixo das 5 grandes (só veteranos e reservas)
  [BR, ["ARG", "URU"], 0.8],
  [BR, ["COL", "PAR", "ECU", "CHI", "PER", "POR"], 0.75],
  [BR, ["MEX", "USA", "SAU", "QAT", "UAE", "JPN"], 0.5],
  [BR, GRANDES, 0.2],
  [BR, SEGUNDAS, 0.2],
  // América do Sul: entre si e do Brasil; baixo da Europa
  [SULAM, SULAM, 0.8],
  [SULAM, ["BRA"], 0.75],
  [SULAM, ["BRB"], 0.6],
  [SULAM, ["BRC"], 0.45],
  [SULAM, NORTE, 0.4],
  [SULAM, [...GRANDES, ...SEGUNDAS, ...VITRINE, "TUR", "GRE", "SCO", ...CENTRO, ...NORDICOS, ...LESTE], 0.15],
  // 5 grandes ligas: entre si, das vitrines, das segundas divisões, de Brasil, Argentina e ligas médias da Europa
  [GRANDES, GRANDES, 0.85],
  [GRANDES, VITRINE, 0.8],
  [GRANDES, SEGUNDAS, 0.75],
  [GRANDES, ["BRA", "ARG"], 0.65],
  [GRANDES, ["AUT", "SUI", "DEN", "CRO", "SRB", "SCO", "TUR"], 0.6],
  [GRANDES, ["URU", "COL", "NOR", "SWE", "UKR"], 0.4],
  [GRANDES, ["BRB", "MEX", "USA", "JPN", "KOR", "GRE"], 0.3],
  [GRANDES, ["BRC", "SAU", "QAT", "UAE", "CHN"], 0.1],
  // Portugal, Holanda e Bélgica: América do Sul, segundas divisões, ligas médias da Europa e reservas das grandes
  [VITRINE, VITRINE, 0.75],
  [VITRINE, ["BRA", "ARG", "URU", "COL"], 0.75],
  [VITRINE, [...SEGUNDAS, "DEN", "SWE", "NOR", "SUI", "AUT", "CRO", "SRB", "UKR"], 0.65],
  [VITRINE, GRANDES, 0.6],
  [VITRINE, ["BRB", "PAR", "ECU", "CHI", "PER"], 0.45],
  // Turquia, Grécia e Golfo: veteranos das 5 grandes, das vitrines e brasileiros
  [["TUR", "GRE", ...GOLFO], GRANDES, 0.7],
  [["TUR", "GRE", ...GOLFO], VITRINE, 0.7],
  [["TUR", "GRE", ...GOLFO], ["BRA"], 0.65],
  [["TUR", "GRE", ...GOLFO], ["BRB", ...SEGUNDAS], 0.45],
  [["TUR", "GRE", ...GOLFO], ["ARG"], 0.5],
  [GOLFO, GOLFO, 0.7],
  [GOLFO, ["TUR"], 0.55],
  [["TUR", "GRE"], ["TUR", "GRE", ...LESTE], 0.55],
  // México e EUA: muito da América do Sul, entre si e veteranos da Europa
  [NORTE, ["ARG", "URU", "COL", "PAR", "ECU", "CHI"], 0.75],
  [NORTE, NORTE, 0.8],
  [NORTE, GRANDES, 0.5],
  [NORTE, ["BRA", "PER"], 0.5],
  [NORTE, [...SEGUNDAS, ...VITRINE, "SCO"], 0.45],
  // Japão, Coreia e China: do Brasil e dos vizinhos
  [ASIA, ["BRA"], 0.65],
  [ASIA, ["BRB"], 0.6],
  [ASIA, ["BRC"], 0.4],
  [ASIA, ASIA, 0.6],
  // Nórdicos e Leste Europeu: dos vizinhos e da própria região
  [NORDICOS, NORDICOS, 0.7],
  [LESTE, LESTE, 0.65],
  [NORDICOS, ["SCO", "NED", "BEL", "GER2", "ENG2"], 0.4],
  [LESTE, ["AUT", "GRE", "TUR"], 0.45],
  [LESTE, ["BRA", "BRB", "POR"], 0.4],
  // Áustria e Suíça: da Alemanha, dos vizinhos e do Leste
  [CENTRO, CENTRO, 0.7],
  [CENTRO, ["GER", "GER2"], 0.65],
  [CENTRO, ["CRO", "SRB", "CZE", "DEN"], 0.5],
  [CENTRO, ["FRA2", "ITA2"], 0.45],
  // Escócia: da Inglaterra (sobretudo da 2ª divisão) e dos nórdicos
  [["SCO"], ["ENG2"], 0.7],
  [["SCO"], ["ENG"], 0.55],
  [["SCO"], NORDICOS, 0.45],
  // Segundas divisões da Europa: vitrines e ligas médias
  [SEGUNDAS, VITRINE, 0.45],
  [SEGUNDAS, [...NORDICOS, "SCO", ...CENTRO], 0.4],
  [SEGUNDAS, SEGUNDAS, 0.45],
];

function montar() {
  const A = {};
  for (const d of TODAS) {
    A[d] = {};
    for (const o of TODAS) A[d][o] = PADRAO;
  }
  for (const [destinos, origens, v] of REGRAS) {
    for (const d of destinos) for (const o of origens) A[d][o] = v;
  }
  // Mesmo país: por último, para valer sobre as regras de grupo
  for (const d of TODAS) {
    for (const o of TODAS) {
      if (d === o) A[d][o] = 1;
      else if (PAIS[d] && PAIS[d] === PAIS[o]) A[d][o] = (DIV[o] || 1) > (DIV[d] || 1) ? 0.9 : 0.8;
    }
  }
  return A;
}

export const AFINIDADE = montar();

// Afinidade de uma liga de destino com uma de origem (0,3 se uma das duas não estiver na tabela)
export const afinidade = (destino, origem) => AFINIDADE[destino]?.[origem] ?? PADRAO;
