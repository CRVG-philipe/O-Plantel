// Compatibilidade entre a vaga da formação e a posição do jogador, em três níveis:
//   ideal (verde) · boa (amarelo) · improvisado (vermelho, com aviso).
// Qualquer combinação que não está na tabela também é "improvisado".
// Vagas: as 13 posições do site + ALE e ALD (alas nas formações com 3 zagueiros, mostradas como "ALA").
// Usada para escolher titulares e reservas, escalar sozinho e encaixar quem chega.

export const COMPAT = {
  GOL: { ideal: ["GOL"], boa: [], improvisado: [] },
  ZAG: { ideal: ["ZAG"], boa: ["VOL"], improvisado: ["LE", "LD"] },
  LE: { ideal: ["LE"], boa: ["ME", "PE"], improvisado: ["ZAG", "VOL"] },
  LD: { ideal: ["LD"], boa: ["MD", "PD"], improvisado: ["ZAG", "VOL"] },
  ALE: { ideal: ["LE", "ME"], boa: ["PE", "MC", "VOL"], improvisado: ["MEI"] },
  ALD: { ideal: ["LD", "MD"], boa: ["PD", "MC", "VOL"], improvisado: ["MEI"] },
  VOL: { ideal: ["VOL"], boa: ["MC", "ZAG"], improvisado: ["MEI", "LE", "LD"] },
  MC: { ideal: ["MC", "VOL"], boa: ["MEI", "ME", "MD"], improvisado: ["PE", "PD"] },
  MEI: { ideal: ["MEI"], boa: ["MC", "SA", "ME", "MD"], improvisado: ["PE", "PD"] },
  ME: { ideal: ["ME"], boa: ["PE", "LE", "MEI"], improvisado: [] },
  MD: { ideal: ["MD"], boa: ["PD", "LD", "MEI"], improvisado: [] },
  PE: { ideal: ["PE"], boa: ["ME", "SA"], improvisado: ["LE", "CA", "MEI"] },
  PD: { ideal: ["PD"], boa: ["MD", "SA"], improvisado: ["LD", "CA", "MEI"] },
  SA: { ideal: ["SA"], boa: ["CA", "MEI"], improvisado: ["PE", "PD"] },
  CA: { ideal: ["CA"], boa: ["SA"], improvisado: ["PE", "PD"] },
};

// Nome e rótulo curto de cada vaga (no campinho, os alas aparecem como "ALA")
export const NOME_VAGA = {
  GOL: "Goleiro", ZAG: "Zagueiro", LE: "Lateral esquerdo", LD: "Lateral direito", ALE: "Ala esquerdo", ALD: "Ala direito",
  VOL: "Volante", MC: "Meia central", MEI: "Meia ofensivo", ME: "Meia esquerda", MD: "Meia direita",
  PE: "Ponta esquerda", PD: "Ponta direita", SA: "Segundo atacante", CA: "Centroavante",
};
export const rotuloVaga = (vaga) => (vaga === "ALE" || vaga === "ALD" ? "ALA" : vaga);

// Nível de um jogador (posição "pos") numa vaga: { nivel: "ideal"|"boa"|"improvisado", ordem }.
// "ordem" desempata dentro do nível: 0 = a posição principal da vaga (a 1ª ideal; nos alas, LE/LD),
// 1 = outra ideal, 2 = boa, 3 = improvisado da tabela, 4 = improvisado fora da tabela (o último recurso).
export function compatibilidade(vaga, pos) {
  const c = COMPAT[vaga];
  if (!c) return { nivel: "improvisado", ordem: 4 };
  if (pos === c.ideal[0]) return { nivel: "ideal", ordem: 0 };
  if (c.ideal.includes(pos)) return { nivel: "ideal", ordem: 1 };
  if (c.boa.includes(pos)) return { nivel: "boa", ordem: 2 };
  if (c.improvisado.includes(pos)) return { nivel: "improvisado", ordem: 3 };
  return { nivel: "improvisado", ordem: 4 };
}
export const nivel = (vaga, pos) => compatibilidade(vaga, pos).nivel;
