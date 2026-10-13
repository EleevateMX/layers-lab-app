import { sb, subir, urlPublica, olvidarPerfil, SERVICIOS } from '../supabase.js';
import { h, esc, $, nav, ICO, iniciales, toast, comprimirImagen } from '../ui.js';
import { pendientesCliente } from './pedidos.js';
import { activarPush, pushActivo } from '../push.js';

export async function render(app, { perfil }) {
  const [{ count }, pend, pushOn] = await Promise.all([
    sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', perfil.id),
    pendientesCliente(perfil.id),
    pushActivo(),
  ]);
  const desde = new Date(perfil.creado_en).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });

  app.innerHTML = h`<div class="pantalla con-nav">
    <div class="cabecera-azul fila" style="gap:16px">
      <label style="position:relative;cursor:pointer" aria-label="Cambiar foto">
        ${perfil.foto_url ? `<img class="avatar grande" src="${urlPublica('avatares', perfil.foto_url)}" alt="">` : `<div class="avatar grande">${iniciales(perfil.nombre)}</div>`}
        <span style="position:absolute;right:-2px;bottom:-2px;width:26px;height:26px;border-radius:13px;background:var(--crema);display:flex;align-items:center;justify-content:center">${ICO.imagen.replace('<svg', '<svg style="width:14px;height:14px;fill:none;stroke:var(--azul);stroke-width:2"')}</span>
        <input type="file" accept="image/*" class="sr" id="foto">
      </label>
      <div><h1 style="font-size:24px">${esc(perfil.nombre)}</h1><div style="font-size:13px;color:var(--teal);margin-top:4px">Cliente desde ${desde} · ${count || 0} pedido${count === 1 ? '' : 's'}</div></div>
    </div>

    ${'Notification' in window ? h`<div class="tarjeta teal fila">
      ${ICO.campana}
      <div style="flex:1"><b style="font-weight:600">${pushOn ? 'Avisos activados' : 'Activa los avisos'}</b><div style="font-size:12px">${pushOn ? 'Te avisamos cuando te respondamos o tu pieza esté lista.' : 'Entérate cuando te respondamos o tu pieza esté lista.'}</div></div>
      ${pushOn ? '' : '<button class="btn chico" id="push">Activar</button>'}
    </div>` : ''}

    ${perfil.rol === 'admin' ? h`<a class="tarjeta azul fila" href="#/admin" style="text-decoration:none"><img src="/simbolo-crema.png" alt="" style="width:36px"><div style="flex:1"><b style="font-weight:600">Panel del taller</b><div style="font-size:12px;color:var(--teal)">Bandeja, cotizador y contenido de la app</div></div>${ICO.flecha}</a>` : ''}
    <form id="f" class="tarjeta col" style="gap:12px">
      <span class="eyebrow">Mis datos</span>
      <label class="campo">Nombre<input name="nombre" value="${esc(perfil.nombre)}" required></label>
      <label class="campo">WhatsApp<input name="whatsapp" type="tel" value="${esc(perfil.whatsapp || '')}"></label>
      <fieldset style="border:0;padding:0;margin:0" class="col"><legend class="campo" style="margin-bottom:6px">Mis intereses</legend>
        <div class="chips">${Object.entries(SERVICIOS).map(([k, t]) => h`<label><input type="checkbox" name="intereses" value="${k}" ${perfil.intereses?.includes(k) ? 'checked' : ''}>${t}</label>`).join('')}</div></fieldset>
      <label class="fila" style="font-size:14px"><input type="checkbox" name="acepta_avisos" ${perfil.acepta_avisos ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--azul)">Quiero recibir avisos de temporada</label>
      <button class="btn" type="submit">Guardar</button>
    </form>

    <div class="tarjeta" style="padding:0">
      <a class="item" href="#/instalar" style="border:0;border-radius:0">Instalar la app${ICO.flecha}</a>
      <a class="item" href="#/recuperar-pass" id="pass" style="border:0;border-top:1px solid #F0EBDD;border-radius:0">Cambiar contraseña${ICO.flecha}</a>
      <a class="item" href="https://www.instagram.com/layers_lab.mid" target="_blank" rel="noopener" style="border:0;border-top:1px solid #F0EBDD;border-radius:0">Síguenos · @layers_lab.mid${ICO.flecha}</a>
      <a class="item" href="#/privacidad" style="border:0;border-top:1px solid #F0EBDD;border-radius:0">Aviso de privacidad${ICO.flecha}</a>
      <a class="item" href="#/cookies" style="border:0;border-top:1px solid #F0EBDD;border-radius:0">Cookies${ICO.flecha}</a>
      <button class="item enlace" id="salir" style="width:100%;border:0;border-top:1px solid #F0EBDD;border-radius:0;font-weight:400">Cerrar sesión</button>
    </div>
    <button class="enlace" id="borrar" style="align-self:center;color:var(--rojo)">Eliminar mi cuenta</button>
    ${nav('perfil', pend)}
  </div>`;

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const { error } = await sb.from('clientes').update({ nombre: f.get('nombre'), whatsapp: f.get('whatsapp') || null, intereses: f.getAll('intereses'), acepta_avisos: !!f.get('acepta_avisos') }).eq('id', perfil.id);
    if (error) toast('No se guardó: ' + error.message); else { olvidarPerfil(); toast('Datos guardados'); }
  };
  $('#foto').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const ruta = await subir('avatares', perfil.id, await comprimirImagen(f, 512));
      await sb.from('clientes').update({ foto_url: ruta }).eq('id', perfil.id);
      olvidarPerfil(); toast('Foto actualizada'); location.reload();
    } catch (err) { toast('No se subió la foto'); }
  };
  $('#push')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const ok = await activarPush(perfil.id);
    toast(ok ? 'Avisos activados' : 'No se pudieron activar los avisos');
    if (ok) render(app, { perfil });
  });
  $('#pass').onclick = async (e) => {
    e.preventDefault();
    const nueva = prompt('Nueva contraseña (mínimo 6 caracteres):');
    if (!nueva) return;
    const { error } = await sb.auth.updateUser({ password: nueva });
    toast(error ? 'No se cambió: ' + error.message : 'Contraseña actualizada');
  };
  $('#salir').onclick = async () => { await sb.auth.signOut(); location.hash = '#/entrar'; };
  $('#borrar').onclick = async () => {
    if (!confirm('¿Eliminar tu cuenta y tus pedidos? Esto no se puede deshacer.')) return;
    const { error } = await sb.rpc('eliminar_mi_cuenta');
    if (error) { toast('No se pudo eliminar: ' + error.message); return; }
    await sb.auth.signOut(); location.hash = '#/registro';
  };
}
