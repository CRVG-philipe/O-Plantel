// Ponto de partida: coloca o app dentro do <div id="root"> do index.html.
import { createRoot } from "react-dom/client";
import "./estilo.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
