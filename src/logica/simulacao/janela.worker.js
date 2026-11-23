// Web Worker da janela da IA: roda a fase 2 (o resto do mundo) fora da tela, para ela não travar.
// Recebe uma vez os dados mínimos ({ dados }) e depois os pedidos ({ id, args }); responde { id, transf }.
import { janelaDoResto, montarDadosNoWorker } from "./mercadoIA.js";

self.onmessage = (e) => {
  const { dados, id, args } = e.data || {};
  if (dados) montarDadosNoWorker(dados);
  if (args) {
    try { self.postMessage({ id, transf: janelaDoResto(args) }); }
    catch (err) { self.postMessage({ id, erro: String(err?.message || err) }); }
  }
};
