// Confirmação antes de excluir um plano salvo (aberto pela lixeira em "Seus planos", na tela inicial).
import { D } from "../../logica/dados.js";
import { dinheiro, calcularDinheiro } from "../../logica/dinheiro.js";
import { saidas } from "../../logica/elenco.js";
import { Cabecalho } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelExcluirPlano({ app, k }) {
  const c = D.CL[k], p = app.db.plans[k];
  return (
    <>
      <Cabecalho icone={<Escudo k={k} z={48} />} titulo="Excluir plano?" sub={`${c.n} ${D.LG[c.lg].plan}`} onFechar={app.fecharPainel} />
      {p && <p className="note">+{p.ins.length} chegam · −{saidas(p).length} saem · caixa {dinheiro(calcularDinheiro(p).caixa)}</p>}
      <p className="note">Isso apaga as vendas, contratações, escalação e orçamento deste plano. Não dá para desfazer.</p>
      <div className="acts">
        <button className="btn" onClick={app.fecharPainel}>Cancelar</button>
        <button className="btn perigo" onClick={() => app.excluirPlano(k)}>Excluir plano</button>
      </div>
    </>
  );
}
