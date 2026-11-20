// Tabelas fixas do app: nomes das posições, agrupamentos, formações etc.

// Nome por extenso de cada posição (a ordem aqui também é a ordem de exibição)
export const POSN = { GOL: "Goleiro", ZAG: "Zagueiro", LE: "Lateral esquerdo", LD: "Lateral direito", VOL: "Volante", MC: "Meia central", MEI: "Meia ofensivo", MD: "Meia direita", ME: "Meia esquerda", PE: "Ponta esquerda", PD: "Ponta direita", SA: "Segundo atacante", CA: "Centroavante" };
export const ORDER = Object.keys(POSN);

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
  "3-5-2": [["GOL", 50, 91], ["ZAG", 74, 74], ["ZAG", 50, 77], ["ZAG", 26, 74], ["LD", 88, 49], ["VOL", 62, 57], ["VOL", 38, 57], ["LE", 12, 49], ["MEI", 50, 37], ["CA", 62, 16], ["CA", 38, 16]],
  "3-4-3": [["GOL", 50, 91], ["ZAG", 74, 74], ["ZAG", 50, 77], ["ZAG", 26, 74], ["LD", 88, 49], ["VOL", 62, 53], ["MC", 38, 53], ["LE", 12, 49], ["PD", 80, 21], ["CA", 50, 14], ["PE", 20, 21]],
};

// Quem pode jogar em cada vaga: o primeiro é a posição exata, os outros são "adaptados"
export const FIT = { GOL: ["GOL"], ZAG: ["ZAG", "VOL"], LD: ["LD", "MD", "ZAG"], LE: ["LE", "ZAG"], VOL: ["VOL", "MC", "ZAG"], MC: ["MC", "VOL", "MEI", "ME", "MD"], MEI: ["MEI", "MC", "SA"], PD: ["PD", "MD", "PE", "SA"], PE: ["PE", "ME", "PD", "SA"], CA: ["CA", "SA"] };

export const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const FILTROS_PADRAO = { lg: "", club: "", age: 99, sort: "vd", fit: false, free: false };
