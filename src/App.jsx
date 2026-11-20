// Carrega o data.json. Enquanto carrega (ou se der erro), mostra só a "casca" da página.
import { useEffect, useState } from "react";
import { carregarDados } from "./logica/dados.js";
import Plantel from "./Plantel.jsx";
import Rodape from "./componentes/Rodape.jsx";

export default function App() {
  const [estado, setEstado] = useState("carregando"); // "carregando" | "pronto" | "erro"

  useEffect(() => {
    carregarDados()
      .then(() => setEstado("pronto"))
      .catch((e) => { console.error(e); setEstado("erro"); });
  }, []);

  if (estado === "pronto") return <Plantel />;

  return (
    <>
      <div className="top"><div className="col"><div className="bar"><div className="logo"><i></i>Plantel</div></div></div></div>
      <main className="col">
        <section id="pick" className="pick">
          {estado === "erro" ? (
            <p className="mute">Não foi possível carregar os dados. Recarregue a página.</p>
          ) : (
            <>
              <h1>Escolha o clube</h1>
              <p>Escolha a liga, navegue pelas setas ou toque no escudo.</p>
            </>
          )}
        </section>
      </main>
      <Rodape />
    </>
  );
}
