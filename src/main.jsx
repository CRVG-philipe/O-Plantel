// Ponto de partida: coloca o app dentro do <div id="root"> do index.html.
import { createRoot } from "react-dom/client";
import "./estilo.css";
import App from "./App.jsx";
import { aplicarTema, lerTemaSalvo } from "./logica/tema.js";

// Aplica o tema escolhido antes de desenhar a página (assim ela não abre com a cor errada)
aplicarTema(lerTemaSalvo());

createRoot(document.getElementById("root")).render(<App />);
