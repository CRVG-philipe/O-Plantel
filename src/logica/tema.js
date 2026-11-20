// Tema claro/escuro escolhido pela pessoa, salvo no navegador (chave plantel:tema).
// Sem escolha salva, o site segue o tema do sistema (celular/computador).
// O CSS já tem as cores dos dois temas: basta marcar <html data-theme="light|dark">.
const CHAVE = "plantel:tema";

export function lerTemaSalvo() {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "light" || t === "dark" ? t : null;
  } catch (e) {
    return null;
  }
}

// Tema em uso agora: o salvo ou, se não houver, o do sistema
export function temaAtual() {
  const salvo = lerTemaSalvo();
  if (salvo) return salvo;
  try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch (e) { return "light"; }
}

// Aplica um tema salvo na página (chamado também antes do app aparecer, para não piscar)
export function aplicarTema(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function salvarTema(t) {
  try { localStorage.setItem(CHAVE, t); } catch (e) { /* segue sem salvar */ }
  aplicarTema(t);
}
