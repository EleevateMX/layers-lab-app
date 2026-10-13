import { sb, perfil, olvidarPerfil } from './supabase.js';
import { $ } from './ui.js';
import * as auth from './pantallas/auth.js';
import * as inicio from './pantallas/inicio.js';
import * as cotizar from './pantallas/cotizar.js';
import * as chat from './pantallas/chat.js';
import * as aliados from './pantallas/aliados.js';
import * as pedidos from './pantallas/pedidos.js';
import * as perfilP from './pantallas/perfil.js';
import * as instalar from './pantallas/instalar.js';
import * as panel from './panel/panel.js';
import * as legal from './pantallas/legal.js';

const app = $('#app');
let limpiar = null; // función de limpieza de la pantalla actual (suscripciones realtime)

const RUTAS = {
  '': inicio, inicio, cotizar, aliados, pedidos, perfil: perfilP, instalar,
  chat, // #/chat/:pedidoId
  registro: auth, entrar: auth, recuperar: auth, completar: auth,
  privacidad: legal, cookies: legal,
  admin: panel, // #/admin/(resumen|bandeja|contenido)/...
};
const PUBLICAS = new Set(['registro', 'entrar', 'recuperar']);
const LIBRES = new Set(['privacidad', 'cookies']); // se ven con o sin sesión

// Al volver de Google/correo, Supabase trae ?code= o #access_token=: esperamos a que procese la sesión
let listoAuth = null;
function esperarAuth() {
  if (listoAuth) return listoAuth;
  const trae = /[?&]code=/.test(location.search) || /access_token=|error=/.test(location.hash);
  listoAuth = trae
    ? new Promise((res) => { const t = setTimeout(res, 6000); const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') { clearTimeout(t); data.subscription.unsubscribe(); res(); } }); })
    : sb.auth.getSession().then(() => {});
  return listoAuth;
}

export async function render() {
  if (limpiar) { try { limpiar(); } catch {} limpiar = null; }
  await esperarAuth();
  // Si Google dejó tokens en el hash, quítalos para que no pisen la ruta
  if (/access_token=|refresh_token=/.test(location.hash)) { history.replaceState(null, '', location.pathname + '#/completar'); }
  if (/[?&]code=/.test(location.search)) { history.replaceState(null, '', location.pathname + (location.hash || '#/completar')); }
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const ruta = partes[0] || '';
  const mod = RUTAS[ruta];
  if (!mod) { location.hash = '#/inicio'; return; }

  const p = await perfil();
  if (!p && !PUBLICAS.has(ruta) && !LIBRES.has(ruta)) { location.hash = '#/entrar'; return; }
  if (p && PUBLICAS.has(ruta)) { location.hash = '#/inicio'; return; }
  if (ruta === 'admin' && p?.rol !== 'admin') { location.hash = '#/inicio'; return; }

  app.innerHTML = '<div class="cargando">Cargando…</div>';
  window.scrollTo(0, 0);
  try {
    limpiar = await mod.render(app, { ruta, partes, perfil: p }) || null;
    if (LIBRES.has(ruta)) document.querySelector('#ll-cookies')?.remove(); else legal.bannerCookies();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="pantalla"><div class="aviso error">Algo falló: ${e.message || e}</div><a class="btn" href="#/inicio">Ir al inicio</a></div>`;
  }
}

window.addEventListener('hashchange', render);
let ultimoEv = null;
sb.auth.onAuthStateChange((ev) => {
  if (ev === ultimoEv && ev !== 'SIGNED_OUT') return;
  ultimoEv = ev;
  if (ev === 'SIGNED_OUT' || ev === 'SIGNED_IN' || ev === 'USER_UPDATED') { olvidarPerfil(); render(); }
});

// Service worker (solo push + pantalla sin conexión; no cachea la app)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW', e));
}

// Aviso nativo de instalación (Android/Chrome): lo guardamos para el botón "Instalar"
window.__instalarEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__instalarEvt = e; document.dispatchEvent(new Event('puede-instalar')); });
window.addEventListener('appinstalled', async () => {
  window.__instalarEvt = null;
  const p = await perfil();
  if (p) sb.from('clientes').update({ app_instalada: true }).eq('id', p.id);
});
// Si ya corre instalada, márcalo
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  perfil().then((p) => p && !p.app_instalada && sb.from('clientes').update({ app_instalada: true }).eq('id', p.id));
}

render();
