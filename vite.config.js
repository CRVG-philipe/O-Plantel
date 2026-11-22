import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração do Vite: só liga o suporte a React.
// A pasta public/ (data.json e img/) é copiada como está para o site final.
export default defineConfig({
  plugins: [react()],
  // Testes (npm test): rodam num "navegador de mentira" (jsdom)
  // testTimeout: com ~33 mil jogadores, cada teste de tela carrega muitos dados; 30 s de limite (só espera se precisar)
  test: { environment: "jsdom", testTimeout: 30000 },
});
