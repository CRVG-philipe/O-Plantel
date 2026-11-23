// Confirmação antes de excluir um plano salvo (aberto pela lixeira em "Seus planos", na tela inicial, ou pela lista de
// planos do clube). k = id do plano (ver logica/planos.js).
import { D } from "../../logica/dados.js";
import { dinheiro, calcularDinheiro } from "../../logica/dinheiro.js";
import { saidas } from "../../logica/elenco.js";
import { nomeDoPlano, planosDoClube } from "../../logica/planos.js";
import { Cabecalho } from "../Painel.jsx";
import { Escudo } from "../Imagens.jsx";

export default function PainelExcluirPlano({ app, k }) {
  const p = app.db.plans[k];
  if (!p) return null;
  const c = D.CL[p.club], varios = planosDoClube(app.db, p.club).length > 1 || !!p.nome;
  return (
    <>
      <Cabecalho icone={<Escudo k={p.club} z={48} />} titulo={varios ? `Excluir o ${nomeDoPlano(k, p)}?` : "Excluir plano?"} sub={`${c.n} ${D.LG[c.lg].plan}`} onFechar={app.fecharPainel} />
      <p className="note">+{p.ins.length} chegam · −{saidas(p).length} saem · caixa {dinheiro(calcularDinheiro(p).caixa)}</p>
      <p className="note">Isso apaga as vendas, contratações, escalação e orçamento deste plano. Não dá para desfazer.</p>
      <div className="acts">
        <button className="btn" onClick={app.fecharPainel}>Cancelar</button>
        <button className="btn perigo" id="confirmar-excluir-plano" onClick={() => app.excluirPlano(k)}>Excluir plano</button>
      </div>
    </>
  );
}