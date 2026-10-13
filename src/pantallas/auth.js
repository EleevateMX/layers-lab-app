import { sb } from '../supabase.js';
import { h, esc, $, toast } from '../ui.js';

const cabecera = (titulo, sub) => h`
  <div class="cabecera-azul" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px">
    <img src="/logo-crema.png" alt="Layers Lab" style="width:108px">
    <h1>${titulo}</h1>
    <p style="color:var(--teal);font-size:14px;max-width:320px">${sub}</p>
  </div>`;

export async function render(app, { ruta, perfil }) {
  if (ruta === 'entrar') return entrar(app);
  if (ruta === 'recuperar') return recuperar(app);
  if (ruta === 'completar') return completar(app, perfil);
  return registro(app);
}

const GOOGLE_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-3.9-13.5-9.4l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
function botonGoogle(txt = 'Continuar con Google') {
  return `<button type="button" class="btn bloque" id="google" style="background:#fff;color:var(--grafito);border:1.5px solid #C9CBD6">${GOOGLE_SVG}${txt}</button>
  <div class="fila" style="gap:10px;color:var(--gris);font-size:12px"><span style="flex:1;height:1px;background:var(--borde)"></span>o con tu correo<span style="flex:1;height:1px;background:var(--borde)"></span></div>`;
}
async function conGoogle(e) {
  e.target.disabled = true;
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/#/completar', queryParams: { prompt: 'select_account' } } });
  if (error) { toast('No se pudo abrir Google: ' + error.message); e.target.disabled = false; }
}

/** Después de entrar con Google: pide WhatsApp e intereses si faltan. */
function completar(app, perfil) {
  if (!perfil) { location.hash = '#/entrar'; return; }
  if (perfil.whatsapp && perfil.intereses?.length) { location.hash = '#/instalar'; return; }
  app.innerHTML = h`<div class="pantalla">
    ${cabecera('¡Hola, ' + esc(perfil.nombre.split(' ')[0]) + '!', 'Solo dos datos más para cotizarte y avisarte de tu pedido.')}
    <form id="f" class="col" style="gap:14px">
      <label class="campo">WhatsApp<input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="999 000 0000" value="${esc(perfil.whatsapp || '')}"></label>
      <fieldset style="border:0;padding:0;margin:0" class="col"><legend class="campo" style="margin-bottom:8px">¿Qué te interesa?</legend>
        <div class="chips">
          <label><input type="checkbox" name="intereses" value="impresion" checked>Impresión 3D</label>
          <label><input type="checkbox" name="intereses" value="maqueta">Maquetas</label>
          <label><input type="checkbox" name="intereses" value="modelado">Modelado 3D</label>
        </div></fieldset>
      <p class="muted">Al continuar aceptas el <a href="#/privacidad">aviso de privacidad</a>.</p>
      <button class="btn bloque" type="submit">Continuar</button>
    </form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await sb.from('clientes').update({ whatsapp: f.get('whatsapp') || null, intereses: f.getAll('intereses') }).eq('id', perfil.id);
    const { olvidarPerfil } = await import('../supabase.js'); olvidarPerfil();
    location.hash = '#/instalar';
  };
}

function registro(app) {
  app.innerHTML = h`<div class="pantalla">
    ${cabecera('Crea tu cuenta', 'Cotiza, platica con el taller, sigue tus pedidos y recibe las colecciones de temporada.')}
    <form id="f" class="col" style="gap:14px">
      ${botonGoogle('Registrarme con Google')}
      <label class="campo">Nombre completo<input name="nombre" required autocomplete="name" placeholder="Tu nombre"></label>
      <label class="campo">WhatsApp<input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="999 000 0000"></label>
      <label class="campo">Correo<input name="email" type="email" required autocomplete="email" placeholder="tu@correo.com"></label>
      <label class="campo">Contraseña<input name="password" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>
      <fieldset style="border:0;padding:0;margin:0" class="col">
        <legend class="campo" style="margin-bottom:8px">¿Qué te interesa?</legend>
        <div class="chips">
          <label><input type="checkbox" name="intereses" value="impresion" checked>Impresión 3D</label>
          <label><input type="checkbox" name="intereses" value="maqueta">Maquetas</label>
          <label><input type="checkbox" name="intereses" value="modelado">Modelado 3D</label>
        </div>
      </fieldset>
      <label style="display:flex;gap:10px;align-items:flex-start;font-size:12px;color:var(--gris)"><input type="checkbox" name="acepta" required style="width:18px;height:18px;margin-top:2px;accent-color:var(--azul)">Acepto el <a href="#/privacidad">aviso de privacidad</a> y recibir avisos de Layers Lab.</label>
      <div id="msg"></div>
      <button class="btn bloque" type="submit">Crear mi cuenta</button>
      <a class="enlace" href="#/entrar" style="align-self:center">Ya tengo cuenta · Entrar</a>
    </form>
  </div>`;
  $('#google').onclick = conGoogle;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    const { error } = await sb.auth.signUp({
      email: f.get('email'), password: f.get('password'),
      options: { data: { nombre: f.get('nombre'), whatsapp: f.get('whatsapp'), intereses: f.getAll('intereses') }, emailRedirectTo: location.origin + '/#/instalar' },
    });
    btn.disabled = false;
    if (error) { $('#msg').innerHTML = `<div class="aviso error">${esc(traducir(error.message))}</div>`; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (session) { location.hash = '#/instalar'; }
    else $('#msg').innerHTML = `<div class="aviso ok">Te mandamos un correo para confirmar tu cuenta. Ábrelo desde tu celular y entra.</div>`;
  };
}

function entrar(app) {
  app.innerHTML = h`<div class="pantalla">
    ${cabecera('Hola de nuevo', 'Entra para ver tus pedidos y mensajes.')}
    <form id="f" class="col" style="gap:14px">
      ${botonGoogle()}
      <label class="campo">Correo<input name="email" type="email" required autocomplete="email"></label>
      <label class="campo">Contraseña<input name="password" type="password" required autocomplete="current-password"></label>
      <div id="msg"></div>
      <button class="btn bloque" type="submit">Entrar</button>
      <div class="fila entre"><a class="enlace" href="#/recuperar">Olvidé mi contraseña</a><a class="enlace" href="#/registro">Crear cuenta</a></div>
    </form>
  </div>`;
  $('#google').onclick = conGoogle;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    btn.disabled = false;
    if (error) $('#msg').innerHTML = `<div class="aviso error">${esc(traducir(error.message))}</div>`;
  };
}

function recuperar(app) {
  app.innerHTML = h`<div class="pantalla">
    ${cabecera('Recuperar contraseña', 'Te mandamos un enlace a tu correo.')}
    <form id="f" class="col" style="gap:14px">
      <label class="campo">Correo<input name="email" type="email" required autocomplete="email"></label>
      <div id="msg"></div>
      <button class="btn bloque" type="submit">Enviar enlace</button>
      <a class="enlace" href="#/entrar" style="align-self:center">Volver</a>
    </form>
  </div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.resetPasswordForEmail(new FormData(e.target).get('email'), { redirectTo: location.origin + '/#/perfil' });
    $('#msg').innerHTML = error ? `<div class="aviso error">${esc(traducir(error.message))}</div>` : `<div class="aviso ok">Listo, revisa tu correo.</div>`;
  };
}

function traducir(m = '') {
  if (/Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Entra o recupera tu contraseña.';
  if (/Password should/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/Email not confirmed/i.test(m)) return 'Confirma tu correo primero (revisa tu bandeja).';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera un momento.';
  return m;
}
