// Tabelas fixas do app: nomes das posições, agrupamentos, formações etc.

// Nome por extenso de cada posição (a ordem aqui também é a ordem de exibição)
export const POSN = { GOL: "Goleiro", ZAG: "Zagueiro", LE: "Lateral esquerdo", LD: "Lateral direito", VOL: "Volante", MC: "Meia central", MEI: "Meia ofensivo", MD: "Meia direita", ME: "Meia esquerda", PE: "Ponta esquerda", PD: "Ponta direita", SA: "Segundo atacante", CA: "Centroavante" };
export const ORDER = Object.keys(POSN);

// Setor de cada posição, para as cores: gol (amarelo), def (azul), mei (verde), ata (vermelho).
// As cores ficam no CSS: var(--gol), var(--def), var(--mei), var(--ata).
export const SETOR = { GOL: "gol", ZAG: "def", LD: "def", LE: "def", ALD: "def", ALE: "def", VOL: "mei", MC: "mei", MEI: "mei", MD: "mei", ME: "mei", PE: "ata", PD: "ata", SA: "ata", CA: "ata" };
export const corDoSetor = (pos) => `var(--${SETOR[pos] || "mei"})`;

// Seções da aba Elenco
export const SECT = [["Goleiros", ["GOL"]], ["Zagueiros", ["ZAG"]], ["Laterais", ["LD", "LE"]], ["Meio-campo", ["VOL", "MC", "MEI", "MD", "ME"]], ["Ataque", ["PE", "PD", "SA", "CA"]]];

// Botões de posição da aba Mercado
export const CHIPS = [["Todos", null], ["Goleiros", ["GOL"]], ["Zagueiros", ["ZAG"]], ["Laterais", ["LD", "LE"]], ["Volantes", ["VOL"]], ["Meias", ["MC", "MEI", "MD", "ME"]], ["Pontas", ["PE", "PD"]], ["Atacantes", ["CA", "SA"]]];

// Mínimo recomendado por grupo de posição (aba Resumo)
export const NEED = [["Goleiros", ["GOL"], 3], ["Zagueiros", ["ZAG"], 4], ["Laterais dir.", ["LD"], 2], ["Laterais esq.", ["LE"], 2], ["Volantes", ["VOL"], 3], ["Meias", ["MC", "MEI", "MD", "ME"], 4], ["Pontas", ["PE", "PD"], 4], ["Atacantes", ["CA", "SA"], 3]];

// Formações: cada vaga é [posição, x%, y%] no campinho
export const FORMS = {
  "4-3-3": [["GOL", 50, 91], ["LD", 84, 71], ["ZAG", 62, 75], ["ZAG", 38, 75], ["LE", 16, 71], ["VOL", 50, 57], ["MC", 68, 46], ["MEI", 32, 46], ["PD", 82, 23], ["CA", 50, 14], ["PE", 18, 23]],
  "4-4-2": [["GOL", 50, 91], ["LD", 84, 71], ["ZAG", 62, 75], ["ZAG", 38, 75], ["LE", 16, 71], ["VOL", 62, 53], ["VOL", 38, 53], ["PD", 85, 39], ["PE", 15, 39], ["CA", 62, 16], ["CA", 38, 16]],
  "4-2-3-1": [["GOL", 50, 91], ["LD", 84, 71], ["ZAG", 62, 75], ["ZAG", 38, 75], ["LE", 16, 71], ["VOL", 62, 57], ["VOL", 38, 57], ["PD", 83, 33], ["MEI", 50, 37], ["PE", 17, 33], ["CA", 50, 14]],
  "4-1-4-1": [["GOL", 50, 91], ["LD", 84, 71], ["ZAG", 62, 75], ["ZAG", 38, 75], ["LE", 16, 71], ["VOL", 50, 59], ["PD", 85, 37], ["MC", 62, 43], ["MC", 38, 43], ["PE", 15, 37], ["CA", 50, 14]],
  // Com 3 zagueiros, as vagas abertas são de ala (ALD/ALE, mostradas como "ALA"; ver compatibilidade.js)
  "3-5-2": [["GOL", 50, 91], ["ZAG", 74, 74], ["ZAG", 50, 77], ["ZAG", 26, 74], ["ALD", 88, 49], ["VOL", 62, 57], ["VOL", 38, 57], ["ALE", 12, 49], ["MEI", 50, 37], ["CA", 62, 16], ["CA", 38, 16]],
  "3-4-3": [["GOL", 50, 91], ["ZAG", 74, 74], ["ZAG", 50, 77], ["ZAG", 26, 74], ["ALD", 88, 49], ["VOL", 62, 53], ["MC", 38, 53], ["ALE", 12, 49], ["PD", 80, 21], ["CA", 50, 14], ["PE", 20, 21]],
  "3-4-2-1": [["GOL", 50, 91], ["ZAG", 74, 74], ["ZAG", 50, 77], ["ZAG", 26, 74], ["ALD", 88, 51], ["VOL", 62, 55], ["MC", 38, 55], ["ALE", 12, 51], ["MEI", 66, 33], ["MEI", 34, 33], ["CA", 50, 14]],
  "5-3-2": [["GOL", 50, 91], ["ZAG", 72, 76], ["ZAG", 50, 78], ["ZAG", 28, 76], ["ALD", 89, 63], ["MC", 74, 46], ["VOL", 50, 52], ["MC", 26, 46], ["ALE", 11, 63], ["CA", 62, 16], ["CA", 38, 16]],
  "5-4-1": [["GOL", 50, 91], ["ZAG", 72, 76], ["ZAG", 50, 78], ["ZAG", 28, 76], ["ALD", 89, 63], ["MD", 82, 38], ["VOL", 60, 48], ["MC", 40, 48], ["ME", 18, 38], ["ALE", 11, 63], ["CA", 50, 14]],
};

export const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Continentes, na ordem em que aparecem na tela de países
export const CONTINENTES = ["América do Sul", "América do Norte", "Europa", "Ásia e Oriente Médio"];

// Países da tela de escolha, na ordem da grade (dentro de cada continente).
// cor = fundo do cartão da bandeira e da escolha de divisão (escura o bastante para texto branco: brilho ≤ 0,6)
// bandeira = arquivo em public/img/flags/ (Wikimedia Commons)
// ligas = chaves das ligas do país (a ordem na tela segue o campo "div" de cada liga)
const AS = "América do Sul", AN = "América do Norte", EU = "Europa", AO = "Ásia e Oriente Médio";
export const PAISES = [
  { n: "Brasil", sigla: "BRA", continente: AS, cor: "#009c3b", bandeira: "brasil.svg", ligas: ["BRA", "BRB", "BRC"] },
  { n: "Argentina", sigla: "ARG", continente: AS, cor: "#3a83c4", bandeira: "argentina.svg", ligas: ["ARG"] },
  { n: "Colômbia", sigla: "COL", continente: AS, cor: "#a07a00", bandeira: "colombia.svg", ligas: ["COL"] },
  { n: "Uruguai", sigla: "URU", continente: AS, cor: "#2b6cb0", bandeira: "uruguai.svg", ligas: ["URU"] },
  { n: "Chile", sigla: "CHI", continente: AS, cor: "#0039a6", bandeira: "chile.svg", ligas: ["CHI"] },
  { n: "Paraguai", sigla: "PAR", continente: AS, cor: "#9c1c26", bandeira: "paraguai.svg", ligas: ["PAR"] },
  { n: "Equador", sigla: "ECU", continente: AS, cor: "#034ea2", bandeira: "equador.svg", ligas: ["ECU"] },
  { n: "Peru", sigla: "PER", continente: AS, cor: "#b5121b", bandeira: "peru.svg", ligas: ["PER"] },
  { n: "México", sigla: "MEX", continente: AN, cor: "#006847", bandeira: "mexico.svg", ligas: ["MEX"] },
  { n: "Estados Unidos", sigla: "USA", continente: AN, cor: "#2b2f6b", bandeira: "estados-unidos.svg", ligas: ["USA"] },
  { n: "Inglaterra", sigla: "ENG", continente: EU, cor: "#1d2a6b", bandeira: "inglaterra.svg", ligas: ["ENG", "ENG2"] },
  { n: "Espanha", sigla: "ESP", continente: EU, cor: "#aa151b", bandeira: "espanha.svg", ligas: ["ESP", "ESP2"] },
  { n: "Itália", sigla: "ITA", continente: EU, cor: "#0b6b3a", bandeira: "italia.svg", ligas: ["ITA", "ITA2"] },
  { n: "Alemanha", sigla: "GER", continente: EU, cor: "#222222", bandeira: "alemanha.svg", ligas: ["GER", "GER2"] },
  { n: "França", sigla: "FRA", continente: EU, cor: "#1f3d8f", bandeira: "franca.svg", ligas: ["FRA", "FRA2"] },
  { n: "Portugal", sigla: "POR", continente: EU, cor: "#7a1020", bandeira: "portugal.svg", ligas: ["POR"] },
  { n: "Holanda", sigla: "NED", continente: EU, cor: "#c4501a", bandeira: "holanda.svg", ligas: ["NED"] },
  { n: "Bélgica", sigla: "BEL", continente: EU, cor: "#a87b05", bandeira: "belgica.svg", ligas: ["BEL"] },
  { n: "Turquia", sigla: "TUR", continente: EU, cor: "#c8102e", bandeira: "turquia.svg", ligas: ["TUR"] },
  { n: "Escócia", sigla: "SCO", continente: EU, cor: "#005eb8", bandeira: "escocia.svg", ligas: ["SCO"] },
  { n: "Áustria", sigla: "AUT", continente: EU, cor: "#9b1b30", bandeira: "austria.svg", ligas: ["AUT"] },
  { n: "Suíça", sigla: "SUI", continente: EU, cor: "#d52b1e", bandeira: "suica.svg", ligas: ["SUI"] },
  { n: "Grécia", sigla: "GRE", continente: EU, cor: "#0d5eaf", bandeira: "grecia.svg", ligas: ["GRE"] },
  { n: "Dinamarca", sigla: "DEN", continente: EU, cor: "#a6192e", bandeira: "dinamarca.svg", ligas: ["DEN"] },
  { n: "Noruega", sigla: "NOR", continente: EU, cor: "#00205b", bandeira: "noruega.svg", ligas: ["NOR"] },
  { n: "Suécia", sigla: "SWE", continente: EU, cor: "#006aa7", bandeira: "suecia.svg", ligas: ["SWE"] },
  { n: "Polônia", sigla: "POL", continente: EU, cor: "#c8143c", bandeira: "polonia.svg", ligas: ["POL"] },
  { n: "Tchéquia", sigla: "CZE", continente: EU, cor: "#11457e", bandeira: "tchequia.svg", ligas: ["CZE"] },
  { n: "Croácia", sigla: "CRO", continente: EU, cor: "#0b3d91", bandeira: "croacia.svg", ligas: ["CRO"] },
  { n: "Sérvia", sigla: "SRB", continente: EU, cor: "#0c4076", bandeira: "servia.svg", ligas: ["SRB"] },
  { n: "Ucrânia", sigla: "UKR", continente: EU, cor: "#0057b7", bandeira: "ucrania.svg", ligas: ["UKR"] },
  { n: "Romênia", sigla: "ROU", continente: EU, cor: "#002b7f", bandeira: "romenia.svg", ligas: ["ROU"] },
  { n: "Rússia", sigla: "RUS", continente: EU, cor: "#1c3578", bandeira: "russia.svg", ligas: ["RUS"] },
  { n: "Arábia Saudita", sigla: "SAU", continente: AO, cor: "#0b6b3a", bandeira: "arabia-saudita.svg", ligas: ["SAU"] },
  { n: "Japão", sigla: "JPN", continente: AO, cor: "#bc002d", bandeira: "japao.svg", ligas: ["JPN"] },
  { n: "Coreia do Sul", sigla: "KOR", continente: AO, cor: "#003478", bandeira: "coreia-do-sul.svg", ligas: ["KOR"] },
  { n: "China", sigla: "CHN", continente: AO, cor: "#c8200e", bandeira: "china.svg", ligas: ["CHN"] },
  { n: "Catar", sigla: "QAT", continente: AO, cor: "#8a1538", bandeira: "catar.svg", ligas: ["QAT"] },
  { n: "Emirados Árabes", sigla: "UAE", continente: AO, cor: "#00732f", bandeira: "emirados.svg", ligas: ["UAE"] },
];

// Filtros do Mercado ao abrir: ordem "Recomendados" e "Só quem cabe no caixa" ligado
// (se a pessoa desligar, a escolha fica salva em "plantel:caixa"; ver armazenamento.js)
export const FILTROS_PADRAO = { lg: "", club: "", age: 99, sort: "rec", fit: true, free: false };
