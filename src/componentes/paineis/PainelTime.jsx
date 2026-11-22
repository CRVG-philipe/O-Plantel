// "Criar time do zero" (e editar um time criado): nome, sigla, cores, modelo de escudo, país/liga e caixa inicial.
// O escudo é desenhado na hora com a sigla e as cores (EscudoCriado), sem upload de imagem.
import { useMemo, useState } from "react";
import { D } from "../../logica/dados.js";
import { PAISES } from "../../logica/constantes.js";
import { CORES_PRONTAS, MODELOS, caixaSugerido, sugerirSigla } from "../../logica/times.js";
import { Cabecalho, noComputador } from "../Painel.jsx";
import { EscudoCriado } from "../Imagens.jsx";

const ligasEmOrdem = (P) => [...P.ligas].sort((a, b) => D.LG[a].div - D.LG[b].div);
const paisDaLiga = (lg) => PAISES.find((P) => P.ligas.includes(lg)) || PAISES[0];
const fmt = (x) => String(x).replace(".", ",");

// Cores prontas + seletor livre
function Cores({ id, rotulo, valor, onChange }) {
  return (
    <div className="field" role="group" aria-label={rotulo}>
      {rotulo}
      <div className="cores">
        {CORES_PRONTAS.map((c) => (
          <button key={c} type="button" className={"cor" + (valor.toLowerCase() === c ? " on" : "")} style={{ background: c }}
            aria-label={`${rotulo}: ${c}`} aria-pressed={valor.toLowerCase() === c} onClick={() => onChange(c)} />
        ))}
        <label className="cor livre" title="Escolher outra cor">
          <input type="color" id={id} aria-label={rotulo + " (outra cor)"} value={valor} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

export default function PainelTime({ app, k }) {
  const atual = k ? app.times[k] : null; // editando um time que já existe?
  const [n, setN] = useState(atual?.n || "");
  const [sigla, setSigla] = useState(atual?.sigla || "");
  const [siglaManual, setSiglaManual] = useState(!!atual); // depois que a pessoa mexe na sigla, o nome não muda mais ela
  const [c, setC] = useState(atual?.c || "#0b3d91");
  const [c2, setC2] = useState(atual?.c2 || "#ffffff");
  const [modelo, setModelo] = useState(atual?.modelo || "classico");
  const [pais, setPais] = useState(() => paisDaLiga(atual?.lg || "BRA").sigla);
  const [lg, setLg] = useState(atual?.lg || "BRA");
  const sugestao = useMemo(() => caixaSugerido(lg), [lg]);
  const [caixa, setCaixa] = useState(atual ? String(atual.caixa) : "");  // vazio = usa a sugestão
  const [erro, setErro] = useState("");

  const P = PAISES.find((x) => x.sigla === pais);
  const siglaFinal = (sigla || sugerirSigla(n)).toUpperCase().slice(0, 3);
  const mudaNome = (v) => { setN(v); if (!siglaManual) setSigla(sugerirSigla(v)); };
  const mudaPais = (s) => { setPais(s); setLg(ligasEmOrdem(PAISES.find((x) => x.sigla === s))[0]); };

  const salvar = () => {
    if (!n.trim()) { setErro("Dê um nome ao time."); return; }
    if (!siglaFinal) { setErro("Escreva uma sigla de até 3 letras."); return; }
    const v = caixa.trim() === "" ? sugestao : Math.max(0, +caixa.replace(",", "."));
    if (!Number.isFinite(v)) { setErro("O caixa precisa ser um número."); return; }
    const dados = { n: n.trim(), sigla: siglaFinal, c, c2, modelo, lg, caixa: Math.round(v * 100) / 100 };
    if (k) app.salvarTime(k, dados); else app.criarTime(dados);
  };

  return (
    <>
      <Cabecalho icone={<EscudoCriado sigla={siglaFinal} c={c} c2={c2} modelo={modelo} z={52} nome={n} />}
        titulo={k ? "Editar time" : "Criar time do zero"} sub={k ? atual.n : "O elenco começa vazio: você monta tudo pelo Mercado."} onFechar={app.fecharPainel} />
      <label className="field">Nome do time
        <input id="tn" value={n} maxLength={40} onChange={(e) => { mudaNome(e.target.value); setErro(""); }} autoFocus={noComputador()} placeholder="Ex.: Unidos da Várzea" />
      </label>
      <label className="field">Sigla (3 letras)
        <input id="ts" value={siglaFinal} maxLength={3} onChange={(e) => { setSigla(e.target.value.toUpperCase().replace(/[^A-Z0-9À-Ü]/g, "")); setSiglaManual(true); }} />
      </label>
      <Cores id="tc" rotulo="Cor principal" valor={c} onChange={setC} />
      <Cores id="tc2" rotulo="Cor secundária" valor={c2} onChange={setC2} />
      <div className="field" role="group" aria-label="Modelo do escudo">
        Modelo do escudo
        <div className="modelos">
          {MODELOS.map(([m, nome]) => (
            <button key={m} type="button" className={"modelo" + (modelo === m ? " on" : "")} aria-pressed={modelo === m} onClick={() => setModelo(m)}>
              <EscudoCriado sigla={siglaFinal || "ABC"} c={c} c2={c2} modelo={m} z={44} decorativo />
              <span>{nome}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="field">País
        <select id="tp" value={pais} onChange={(e) => mudaPais(e.target.value)}>
          {PAISES.map((x) => <option key={x.sigla} value={x.sigla}>{x.n}</option>)}
        </select>
      </label>
      <label className="field">Liga
        <select id="tl" value={lg} onChange={(e) => setLg(e.target.value)}>
          {ligasEmOrdem(P).map((x) => <option key={x} value={x}>{D.LG[x].n}</option>)}
        </select>
      </label>
      <label className="field">Caixa inicial (€ milhões)
        <input id="tcx" className="num" type="number" min="0" step="0.1" inputMode="decimal" value={caixa} placeholder={fmt(sugestao)}
          onChange={(e) => setCaixa(e.target.value)} />
      </label>
      <p className="note">Sugestão: € {fmt(sugestao)} mi, a média do valor dos elencos da {D.LG[lg].n}. A liga define a regra de estrangeiros, a recomendação do Mercado e o nível de preço.</p>
      {erro && <p className="note" role="alert" style={{ color: "var(--neg)" }}>{erro}</p>}
      <div className="acts" style={{ marginTop: 8 }}>
        <button className="btn" onClick={app.fecharPainel}>Cancelar</button>
        <button className="btn pri" id="ok" onClick={salvar}>{k ? "Salvar" : "Criar time"}</button>
      </div>
    </>
  );
}

// Confirmação antes de excluir um time criado: apaga o time e o plano dele
export function PainelExcluirTime({ app, k }) {
  const t = app.times[k];
  if (!t) return null;
  return (
    <>
      <Cabecalho icone={<EscudoCriado sigla={t.sigla} c={t.c} c2={t.c2} modelo={t.modelo} z={48} nome={t.n} />} titulo="Excluir time?" sub={t.n} onFechar={app.fecharPainel} />
      <p className="note">Isso apaga o time e o plano dele (contratações, escalação e caixa). Não dá para desfazer.</p>
      <div className="acts">
        <button className="btn" onClick={app.fecharPainel}>Cancelar</button>
        <button className="btn perigo" id="excluir-time" onClick={() => app.excluirTime(k)}>Excluir time</button>
      </div>
    </>
  );
}
