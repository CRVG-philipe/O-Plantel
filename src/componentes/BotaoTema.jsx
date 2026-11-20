// Botão sol/lua: alterna entre tema claro e escuro (e guarda a escolha).
// Mostra o ícone do tema para o qual vai mudar: lua no claro, sol no escuro.
export default function BotaoTema({ app }) {
  const escuro = app.tema === "dark";
  return (
    <button className="tema" onClick={app.alternarTema} aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"} title={escuro ? "Tema claro" : "Tema escuro"}>
      {escuro ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
