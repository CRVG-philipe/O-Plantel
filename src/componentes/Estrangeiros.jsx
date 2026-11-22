// Peças do limite de estrangeiros (regras em public/regras-estrangeiros.json; contas em logica/estrangeiros.js):
// selo "EST", contador da aba Time e a linha "Estrangeiros no elenco" (Elenco e Resumo).
import { D } from "../logica/dados.js";
import { contarEstrangeiros, textoRegra } from "../logica/estrangeiros.js";

// Selo pequeno de estrangeiro (só nas ligas com algum limite: nas outras, todo mundo seria "estrangeiro" à toa)
export function SeloEst({ mini = false }) {
  return <span className={"est" + (mini ? " mini-est" : "")} title="Estrangeiro: ocupa vaga de estrangeiro nesta liga">EST</span>;
}

const Aproximada = ({ regra }) =>
  regra.confirmado ? null : <span className="est-aprox" title="Valor de referência, ainda não conferido no regulamento oficial">(regra aproximada)</span>;

// Aba Time: "Estrangeiros: X/limite" (titulares + reservas) e "Em campo: Y/limite"; em vermelho e com aviso se passar.
export function ContadorEstrangeiros({ plano }) {
  const c = contarEstrangeiros(plano), { regra } = c;
  const liga = D.LG[c.lg]?.n || "";
  const excedeu = c.excede.relacionados || c.excede.campo;
  return (
    <div className="est-box" id="estrangeiros">
      <div className="est-linha">
        <span className={"est-cont" + (c.excede.relacionados ? " excede" : "")} id="est-rel">
          Estrangeiros: <b className="num">{c.relacionados}{regra.relacionados != null ? "/" + regra.relacionados : ""}</b>
        </span>
        {regra.campo != null && (
          <span className={"est-cont" + (c.excede.campo ? " excede" : "")} id="est-campo">
            Em campo: <b className="num">{c.campo}/{regra.campo}</b>
          </span>
        )}
        {regra.relacionados == null && regra.campo == null && (
          <span className="est-sem">{regra.inscritos != null ? `sem limite no jogo (só ${regra.inscritos} inscritos no elenco)` : "sem limite nesta liga"}</span>
        )}
        <Aproximada regra={regra} />
      </div>
      {excedeu && (
        <div className="est-aviso" role="alert" id="est-aviso">
          <b>Limite de estrangeiros excedido</b>
          <span>{liga}: {textoRegra(regra)}.</span>
        </div>
      )}
    </div>
  );
}

// Elenco e Resumo: "Estrangeiros no elenco: N" e, se a liga tiver limite de inscritos, o aviso quando passar dele
export function EstrangeirosNoElenco({ plano }) {
  const c = contarEstrangeiros(plano), { regra } = c;
  return (
    <div className="est-elenco" id="est-elenco">
      <span>Estrangeiros no elenco: <b className="num">{c.elenco}</b>
        {regra.inscritos != null && <span className="est-lim"> · limite de inscritos: {regra.inscritos}</span>}
        {" "}<Aproximada regra={regra} />
      </span>
      {c.excede.inscritos && (
        <div className="est-aviso" role="alert">
          <b>{c.elenco} estrangeiros no elenco</b>
          <span>Pode contratar, mas só {regra.inscritos} podem ser inscritos ({D.LG[c.lg]?.n}: {textoRegra(regra)}).</span>
        </div>
      )}
    </div>
  );
}
