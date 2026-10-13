import { h } from '../ui.js';

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;

export async function render(app) {
  app.innerHTML = h`<div class="pantalla" style="background:var(--teal);color:var(--azul);max-width:none">
    <div style="max-width:420px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:18px;flex:1">
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding-top:16px">
        <div style="width:96px;height:96px;border-radius:22px;background:var(--azul);display:flex;align-items:center;justify-content:center"><img src="/icons/icon-192.png" alt="" style="width:96px;border-radius:22px"></div>
        <h1>${instalada() ? '¡Ya la tienes instalada!' : '¡Listo! Lleva Layers Lab en tu celular'}</h1>
        <p style="font-size:14px">Instálala como app: sin tienda, sin descargas pesadas.</p>
      </div>
      ${instalada() ? '' : esIOS() ? pasosIOS() : pasosAndroid()}
      <a class="enlace" href="#/inicio" style="align-self:center;margin-top:auto">${instalada() ? 'Entrar a la app' : 'Ahora no, entrar a la app'}</a>
    </div>
  </div>`;
  const b = app.querySelector('#instalar');
  if (b) {
    const actualizar = () => { b.disabled = !window.__instalarEvt; b.textContent = window.__instalarEvt ? 'Instalar app' : 'Usa el menú de Chrome → "Instalar app"'; };
    actualizar();
    document.addEventListener('puede-instalar', actualizar);
    b.onclick = async () => { const e = window.__instalarEvt; if (!e) return; e.prompt(); await e.userChoice; window.__instalarEvt = null; actualizar(); };
  }
}

const pasosAndroid = () => h`
  <div class="tarjeta" style="background:var(--crema)">
    <div class="fila" style="font-weight:600;margin-bottom:12px">Android · Chrome</div>
    <button id="instalar" class="btn bloque">Instalar app</button>
  </div>
  <div class="tarjeta" style="background:var(--crema)">
    <div style="font-weight:600;margin-bottom:8px">iPhone · Safari</div>
    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.6"><li>Toca <b>Compartir</b>.</li><li>Elige <b>Agregar a pantalla de inicio</b>.</li><li>Toca <b>Agregar</b>.</li></ol>
  </div>`;

const pasosIOS = () => h`
  <div class="tarjeta" style="background:var(--crema)">
    <div style="font-weight:600;margin-bottom:8px">iPhone · Safari</div>
    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.6">
      <li>Toca <b>Compartir</b> en la barra de Safari (el cuadrito con la flecha).</li>
      <li>Elige <b>Agregar a pantalla de inicio</b>.</li>
      <li>Toca <b>Agregar</b>. El cuervo aparecerá con tus apps.</li>
    </ol>
    <p class="muted" style="margin-top:10px">Los avisos en iPhone solo funcionan con la app agregada a inicio.</p>
  </div>`;
