// Carrega o data.json. Enquanto carrega (ou se der erro), mostra só a moldura da tela inicial.
import { useEffect, useState } from "react";
import { carregarDados } from "./logica/dados.js";
import { lerCotacaoSalva } from "./logica/cotacao.js";
import Plantel from "./Plantel.jsx";
import { Moldura, COR_INICIO } from "./componentes/EscolhaClube.jsx";

export default function App() {
  const [estado, setEstado] = useState("carregando"); // "carregando" | "pronto" | "erro"

  useEffect(() => {
    carregarDados()
      .then(() => setEstado("pronto"))
      .catch((e) => { console.error(e); setEstado("erro"); });
  }, []);

  if (estado === "pronto") return <Plantel />;

  return (
    <Moldura cor={COR_INICIO} cotacao={lerCotacaoSalva()}>
      {estado === "erro" && <p className="esc-rotulo">Não foi possível carregar os dados. Recarregue a página.</p>}
    </Moldura>
  );
}
