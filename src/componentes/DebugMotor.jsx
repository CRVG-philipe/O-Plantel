// Página escondida "/debug-motor" (ou "?debug-motor"): mede o motor de placar com muitas temporadas de uma liga e
// mostra as metas de calibração (calibracao.js), para conferir os números sem rodar os testes.
import { useEffect, useState } from "react";
import { D } from "../logica/dados.js";
import { METAS, medirMotor, passou } from "../logica/simulacao/calibracao.js";
import { MOTOR } from "../logica/simulacao/motor.js";

const fmt = (m, v) => (v == null ? "—" : v.toFixed(m.pct ? 1 : 2).replace(".", ",") + (m.pct ? "%" : ""));
const faixa = (m) => (m.min != null && m.max != null ? `${fmt(m, m.min)} a ${fmt(m, m.max)}` : m.min != null ? `≥ ${fmt(m, m.min)}` : m.max != null ? `≤ ${fmt(m, m.max)}` : "—");

export default function DebugMotor() {
  const [lg, setLg] = useState("BRA");
  const [n, setN] = useState(1000);
  const [r, setR] = useState(null);
  const [rodando, setRodando] = useState(false);
  const medir = () => {
    setRodando(true);
    setTimeout(() => { setR(medirMotor({ lg, temporadas: n })); setRodando(false); }, 30);
  };
  useEffect(medir, []); // eslint-disable-line
  const ligas = Object.values(D.LG).sort((a, b) => a.n.localeCompare(b.n));
  return (
    <div className="dbg">
      <h1>Motor de placar · calibração</h1>
      <p className="dbg-nota">Temporadas de pontos corridos (turno e returno) com os elencos atuais, só placares. As metas valem para o Brasileirão.</p>
      <div className="dbg-ctrl">
        <select id="dbg-liga" value={lg} onChange={(e) => setLg(e.target.value)}>{ligas.map((l) => <option key={l.k} value={l.k}>{l.n}</option>)}</select>
        <select id="dbg-n" value={n} onChange={(e) => setN(+e.target.value)}>{[100, 300, 1000, 3000].map((x) => <option key={x} value={x}>{x} temporadas</option>)}</select>
        <button id="dbg-rodar" onClick={medir} disabled={rodando}>{rodando ? "Medindo…" : "Medir"}</button>
      </div>
      {r && (
        <>
          <table className="dbg-tab" id="dbg-metricas">
            <thead><tr><th>Métrica</th><th>Meta</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {METAS.map((m) => {
                const v = r.valores[m.id], info = m.min == null && m.max == null;
                return (
                  <tr key={m.id} className={info ? "" : passou(m, v) ? "dbg-ok" : "dbg-falha"}>
                    <td>{m.nome}</td><td>{faixa(m)}</td><td><b>{fmt(m, v)}</b></td><td>{info ? "" : passou(m, v) ? "✓" : "✗"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="dbg-nota">{D.LG[r.lg]?.n} · {r.temporadas} temporadas · {r.jogos.toLocaleString("pt-BR")} jogos · {Math.round(r.ms)} ms.
            Mais fraco: {D.CL[r.fraco[0]]?.n} (força {r.fraco[1].toFixed(1)}); mais forte: {D.CL[r.forte[0]]?.n} (força {r.forte[1].toFixed(1)}).</p>
        </>
      )}
      <h2>Coeficientes (motor.js)</h2>
      <pre className="dbg-pre">{JSON.stringify(MOTOR, null, 1)}</pre>
      <p className="dbg-nota"><a href="./">Voltar ao site</a></p>
    </div>
  );
}
