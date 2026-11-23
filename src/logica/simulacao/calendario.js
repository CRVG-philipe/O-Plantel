// Calendário de pontos corridos: turno e returno, pelo método do círculo.
// Um clube fica parado e os outros giram em volta dele; a cada rodada, cada um enfrenta um adversário novo.
// O returno repete o turno com o mando invertido, então cada clube joga metade dos jogos em casa.
// Com número ímpar de clubes, entra um "fantasma" (null): quem pega o fantasma folga na rodada.

// clubes: lista de chaves ("T42"). Devolve as rodadas: [[[casa, fora], ...], ...], 2 × (n − 1) rodadas
// (ou 2 × n com número ímpar, por causa das folgas).
export function gerarCalendario(clubes) {
  const t = [...clubes];
  if (t.length % 2) t.push(null);
  const n = t.length, fixo = t[0];
  let roda = t.slice(1);
  const turno = [];
  for (let r = 0; r < n - 1; r++) {
    const lista = [fixo, ...roda], jogos = [];
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i], b = lista[n - 1 - i];
      if (a === null || b === null) continue;
      // Mando alternado: o clube fixo troca de mando a cada rodada; os outros pares, conforme a rodada e a posição
      const aEmCasa = i === 0 ? r % 2 === 0 : (r + i) % 2 === 1;
      jogos.push(aEmCasa ? [a, b] : [b, a]);
    }
    turno.push(jogos);
    roda = [roda[roda.length - 1], ...roda.slice(0, -1)]; // gira o círculo
  }
  const returno = turno.map((jogos) => jogos.map(([a, b]) => [b, a]));
  return [...turno, ...returno];
}
