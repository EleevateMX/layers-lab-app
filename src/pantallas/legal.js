import { h } from '../ui.js';

const NEGOCIO = { nombre: 'Layers Lab', ciudad: 'Mérida, Yucatán, México', correo: '[correo de contacto]', instagram: '@layers_lab.mid', fecha: '13 de octubre de 2026' };

const marco = (titulo, cuerpo) => h`<div class="pantalla" style="max-width:720px">
  <div class="fila" style="gap:10px"><a href="#/" class="redondo" aria-label="Volver" style="background:#fff;border:1px solid var(--borde)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a><img src="/simbolo-azul.png" alt="" style="width:30px"><span style="font-family:var(--serif);font-size:18px;color:var(--azul)">Layers Lab</span></div>
  <h1>${titulo}</h1>
  <p class="muted">Última actualización: ${NEGOCIO.fecha}</p>
  <div class="tarjeta col" style="gap:14px;line-height:1.6;font-size:15px">${cuerpo}</div>
  <p class="muted" style="text-align:center">${NEGOCIO.nombre} · ${NEGOCIO.ciudad} · Instagram ${NEGOCIO.instagram}</p>
</div>`;

const sec = (t, c) => `<section><h3 style="margin-bottom:6px">${t}</h3>${c}</section>`;

export async function render(app, { ruta }) {
  app.innerHTML = ruta === 'cookies' ? cookies() : privacidad();
}

function privacidad() {
  return marco('Aviso de privacidad', [
    `<p><b>${NEGOCIO.nombre}</b>, con domicilio en ${NEGOCIO.ciudad}, es responsable del uso y protección de tus datos personales, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>`,
    sec('¿Qué datos recabamos?', `<ul style="margin:0;padding-left:20px"><li>Nombre, correo electrónico y número de WhatsApp.</li><li>Tus intereses (impresión 3D, maquetas, modelado 3D).</li><li>Imágenes, archivos 3D y descripciones que subes para cotizar.</li><li>Los mensajes que intercambias con el taller dentro de la app.</li><li>Si lo autorizas, un identificador para enviarte avisos (notificaciones push).</li><li>Si entras con Google: tu nombre, correo y foto de perfil que Google nos comparte.</li></ul>`),
    sec('¿Para qué los usamos?', `<ul style="margin:0;padding-left:20px"><li>Crear tu cuenta y atender tus solicitudes de cotización.</li><li>Platicar contigo sobre tu pedido y avisarte de su avance.</li><li>Fabricar y entregar la pieza que nos pidas.</li><li>Con tu consentimiento, enviarte novedades, colecciones de temporada y promociones. Puedes desactivarlo en cualquier momento desde <b>Perfil</b>.</li></ul>`),
    sec('¿Con quién los compartimos?', `<p>No vendemos ni cedemos tus datos. Para operar la app usamos proveedores que los procesan por cuenta nuestra: <b>Supabase</b> (base de datos y archivos, servidores en Estados Unidos), el servicio de hospedaje de la app, y <b>Google</b> solo si eliges entrar con tu cuenta de Google. Los avisos push se envían con el servicio de notificaciones de tu navegador o sistema operativo.</p>`),
    sec('¿Cuánto tiempo los guardamos?', `<p>Mientras tengas tu cuenta activa. Si la eliminas desde <b>Perfil → Eliminar mi cuenta</b>, se borran tu perfil, tus pedidos, tus mensajes y tus archivos. Podemos conservar comprobantes de venta el tiempo que exige la ley fiscal.</p>`),
    sec('Tus derechos (ARCO)', `<p>Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, y revocar tu consentimiento, escribiéndonos a <b>${NEGOCIO.correo}</b> o por mensaje directo a ${NEGOCIO.instagram}. Te respondemos en un máximo de 20 días hábiles.</p>`),
    sec('Seguridad', `<p>Tus datos viajan cifrados (HTTPS) y cada cliente solo puede ver su propia información. Tus imágenes y archivos de referencia son privados: solo tú y el taller pueden abrirlos.</p>`),
    sec('Menores de edad', `<p>La app está dirigida a mayores de 18 años. Si eres menor, pide a tu madre, padre o tutor que haga la solicitud por ti.</p>`),
    sec('Cambios a este aviso', `<p>Si cambia, lo publicaremos aquí mismo con la nueva fecha. Si el cambio afecta cómo usamos tus datos, te lo avisaremos dentro de la app.</p>`),
  ].join(''));
}

function cookies() {
  return marco('Cookies y almacenamiento', [
    `<p>Esta app usa muy pocas cookies y solo las necesarias para funcionar. No usamos cookies de publicidad ni de rastreo entre sitios.</p>`,
    sec('Lo que guardamos en tu dispositivo', `<div class="tabla-caja"><table style="min-width:0"><thead><tr><th>Nombre</th><th>Para qué</th><th>Dura</th></tr></thead><tbody>
      <tr><td>sb-…-auth-token</td><td>Mantener tu sesión iniciada</td><td>Hasta que cierres sesión</td></tr>
      <tr><td>ll-cookies</td><td>Recordar que ya viste este aviso</td><td>1 año</td></tr>
      <tr><td>Suscripción push</td><td>Enviarte avisos, solo si lo activas</td><td>Hasta que la desactives</td></tr>
      <tr><td>Service worker</td><td>Recibir avisos y mostrar una pantalla cuando no hay internet</td><td>Mientras la app esté instalada</td></tr>
    </tbody></table></div>`),
    sec('Google', `<p>Si entras con Google, Google puede colocar sus propias cookies durante el inicio de sesión, según su <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">política de privacidad</a>.</p>`),
    sec('Cómo borrarlas', `<p>Cierra sesión desde <b>Perfil</b> o borra los datos del sitio desde la configuración de tu navegador. Si desinstalas la app del celular, se eliminan todas.</p>`),
    `<p>Más detalles en nuestro <a href="#/privacidad">aviso de privacidad</a>.</p>`,
  ].join(''));
}

/** Banner de cookies: se muestra una vez, en cualquier pantalla. */
export function bannerCookies() {
  try { if (localStorage.getItem('ll-cookies')) return; } catch { return; }
  if (document.querySelector('#ll-cookies')) return;
  const el = document.createElement('div');
  el.id = 'll-cookies'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Aviso de cookies');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:60;background:#22242B;color:#FDF8EC;border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:center;font-size:13px;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:560px;margin:0 auto';
  el.innerHTML = `<span style="flex:1">Usamos solo las cookies necesarias para que la app funcione. <a href="#/cookies" style="color:#8EC4B4">Ver cuáles</a>.</span><button type="button" class="btn chico teal" id="ll-ok">Entendido</button>`;
  document.body.appendChild(el);
  el.querySelector('#ll-ok').onclick = () => { try { localStorage.setItem('ll-cookies', new Date().toISOString()); } catch {} el.remove(); };
}
