// Rodapé: cotação usada para converter os valores e as fontes dos dados.
import { textoCotacao } from "../logica/dinheiro.js";

export default function Rodape({ cotacao }) {
  return (
    <footer className="col">
      {cotacao && <div className="cotacao">{textoCotacao(cotacao)}</div>}
      <div>
        Elencos, valores de mercado e contratos: Transfermarkt (valores com "~" são estimados pelo Plantel). Fotos, escudos, técnicos e estatísticas (temporada atual, somando liga, copas nacionais e competições continentais; seleções não entram): Sofascore. Bandeiras: Wikimedia Commons. Dados de 20/11/2026. Seus planos ficam salvos neste navegador.
      </div>
    </footer>
  );
}
