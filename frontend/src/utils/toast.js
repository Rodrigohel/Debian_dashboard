// Barramento de eventos minúsculo — qualquer componente chama showToast(...)
// sem precisar de contexto/provider; o <ToastContainer/> (montado uma vez
// no topo do app) escuta e desenha a pilha de notificações.
const listeners = new Set();
let idCounter = 0;

export function showToast(message, type = 'info') {
  const toast = { id: ++idCounter, message, type };
  listeners.forEach((fn) => fn(toast));
  return toast.id;
}

export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
