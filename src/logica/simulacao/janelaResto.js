// Fase 2 da janela da IA (o resto do mundo) no Web Worker. Sem Worker (testes, navegador antigo) ou se ele falhar,
// roda direto aqui mesmo: o resultado é o mesmo (mesma semente = mesmas transferências).
import { D } from "../dados.js";
import { dadosParaWorker, janelaDoResto } from "./mercadoIA.js";

let worker = null, enviadoDe = null, seq = 0;
const pendentes = new Map();

function abrirWorker() {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./janela.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { id, transf, erro } = e.data || {};
      const p = pendentes.get(id);
      if (!p) return;
      pendentes.delete(id);
      if (erro) p.resolve(janelaDoResto(p.args)); else p.resolve(transf);
    };
    worker.onerror = () => {
      // O worker não abriu (ou quebrou): os pedidos que faltam rodam direto
      for (const [, p] of pendentes) p.resolve(janelaDoResto(p.args));
      pendentes.clear();
      worker = null; enviadoDe = null;
    };
    return worker;
  } catch (e) { return null; }
}

// args = { semente, proibidos, k0, ativos, transf } (ver janelaDoResto). Devolve uma Promise com as transferências novas.
export function calcularResto(args) {
  const w = abrirWorker();
  if (!w) return Promise.resolve(janelaDoResto(args));
  return new Promise((resolve) => {
    const id = ++seq;
    pendentes.set(id, { resolve, args });
    const msg = { id, args };
    if (enviadoDe !== D.ALL) { msg.dados = dadosParaWorker(); enviadoDe = D.ALL; }
    w.postMessage(msg);
  });
}
