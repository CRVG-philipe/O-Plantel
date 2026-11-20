import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração do Vite: só liga o suporte a React.
// A pasta public/ (data.json e img/) é copiada como está para o site final.
export default defineConfig({
  plugins: [react()],
});
