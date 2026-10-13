// Utilidades de UI: plantillas, iconos, navegación, toasts
export const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (vals[i] ?? ''), '');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICO = {
  inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10l8-6 8 6v10H4z"/></svg>',
  cotizar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></svg>',
  aliados: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10l1.5-5.5h14L20.5 10M4.5 10v10h15V10M3.5 10h17M10 20v-5h4v5"/></svg>',
  pedidos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  perfil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  flecha: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><path d="M9 6l6 6-6 6"/></svg>',
  imagen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8 8"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>',
  subir: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  impresion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 16h12M8 12h8M10 8h4M12 4v4"/></svg>',
  maqueta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18M5 20V10l5-4 5 4v10M15 20v-7h4v7M8 13h4"/></svg>',
  modelado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/></svg>',
  campana: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function nav(activa, pendientes = 0) {
  const it = (ruta, k, txt, extra = '') => h`<a href="#/${ruta}" class="${activa === ruta ? 'activo' : ''} ${extra}" ${extra ? `data-n="${pendientes}"` : ''}>${ICO[k]}${txt}</a>`;
  return h`<nav class="nav" aria-label="Navegación principal">
    ${it('inicio', 'inicio', 'Inicio')}
    ${it('cotizar', 'cotizar', 'Cotizar')}
    ${it('aliados', 'aliados', 'Aliados')}
    ${it('pedidos', 'pedidos', 'Pedidos', 'pin')}
    ${it('perfil', 'perfil', 'Perfil')}
  </nav>`;
}

let toastT;
export function toast(msg, ms = 2600) {
  $('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastT); toastT = setTimeout(() => el.remove(), ms);
}

export const ir = (ruta) => { location.hash = '#/' + ruta; };

export function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '·';
}

/** Lee un archivo de imagen y lo reduce (máx 1600 px) para subir rápido. */
export async function comprimirImagen(file, max = 1600, calidad = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const esc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (esc === 1 && file.size < 900e3) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', calidad));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
