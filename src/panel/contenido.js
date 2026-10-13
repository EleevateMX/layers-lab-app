import { sb, subir, urlPublica, SERVICIOS, dinero } from '../supabase.js';
import { h, esc, $, toast, comprimirImagen } from '../ui.js';
import { activarPush, pushActivo } from '../push.js';

export async function render(cont, { perfil }) {
  cont.innerHTML = h`
    <div class="fila entre" style="flex-wrap:wrap;gap:12px"><div><h1 style="font-size:34px">Lo que ve el cliente</h1><p class="muted">Enciende, apaga y edita cada parte de la app sin volver a publicarla.</p></div>
      <div class="chips" id="secciones" role="group" aria-label="Secciones visibles"></div></div>
    <div class="rejilla">
      <section class="tarjeta col" id="novedades"></section>
      <section class="tarjeta col" id="disponibles"></section>
      <section class="tarjeta col" id="aliados"></section>
      <section class="tarjeta azul col" id="avisos"></section>
      <section class="tarjeta col" id="avisos-admin"></section>
    </div>
    <dialog id="dlg"></dialog>`;

  await Promise.all([secciones(), novedades(), disponibles(), aliados(), avisos(), avisosAdmin()]);

  // ---------- Avisos para el taller (push al celular + correo) ----------
  async function avisosAdmin() {
    const el = $('#avisos-admin', cont);
    const [{ data }, pushOn, { count: pendientes }] = await Promise.all([
      sb.from('ajustes').select('valor').eq('clave', 'avisos_admin').maybeSingle(),
      pushActivo(),
      sb.from('push_cola').select('id', { count: 'exact', head: true }).eq('para_admin', true).gte('creado_en', new Date(Date.now() - 7 * 864e5).toISOString()),
    ]);
    const v = data?.valor || {};
    el.innerHTML = h`<h2>Avisos para mí</h2>
      <p class="muted">Cada solicitud nueva y cada mensaje de un cliente te llega al celular y al correo. ${pendientes || 0} avisos esta semana.</p>
      <div class="fila" style="padding:10px 0;border-bottom:1px solid #F0EBDD"><div style="flex:1"><b style="font-weight:600;color:var(--azul)">Push en este dispositivo</b><div class="muted">${pushOn ? 'Activado' : 'Actívalo en el celular con el que atiendes'}</div></div>${pushOn ? '<span class="chip teal">Activo</span>' : '<button class="btn chico" id="push-admin" type="button">Activar</button>'}</div>
      <form id="f-admin" class="col" style="gap:10px;padding-top:6px">
        <label class="campo">Correo donde quieres recibir avisos<input name="correo" type="email" value="${esc(v.correo || perfil.email || '')}" placeholder="tu@correo.com"></label>
        <label class="campo">Clave de Resend (gratis, 3,000 correos/mes)<input name="resend_key" type="password" value="${esc(v.resend_key || '')}" placeholder="re_…" autocomplete="off"></label>
        <label class="campo">Dirección de la app (para el botón del correo)<input name="app_url" value="${esc(v.app_url || location.origin)}"></label>
        <button class="btn chico" type="submit">Guardar</button>
        <span class="muted">Crea la clave en resend.com → API Keys. Sin dominio propio, los correos salen de onboarding@resend.dev y solo llegan a tu correo registrado en Resend.</span>
      </form>`;
    $('#push-admin', el)?.addEventListener('click', async (e) => { e.target.disabled = true; const ok = await activarPush(perfil.id); toast(ok ? 'Push activado' : 'No se pudo activar'); if (ok) avisosAdmin(); });
    $('#f-admin', el).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const valor = { correo: f.get('correo') || null, resend_key: f.get('resend_key') || null, app_url: (f.get('app_url') || '').replace(/\/$/, '') };
      const { error } = await sb.from('ajustes').upsert({ clave: 'avisos_admin', valor });
      toast(error ? 'No se guardó: ' + error.message : 'Avisos guardados');
    };
  }

  // ---------- Secciones visibles ----------
  async function secciones() {
    const { data } = await sb.from('ajustes').select('valor').eq('clave', 'secciones').single();
    const v = data?.valor || {};
    const el = $('#secciones', cont);
    el.innerHTML = ['inicio', 'cotizar', 'aliados', 'pedidos', 'perfil'].map((k) => h`<label><input type="checkbox" name="${k}" ${v[k] !== false ? 'checked' : ''}>${k[0].toUpperCase() + k.slice(1)}</label>`).join('');
    el.onchange = async () => {
      const nuevo = {}; el.querySelectorAll('input').forEach((i) => nuevo[i.name] = i.checked);
      const { error } = await sb.from('ajustes').update({ valor: nuevo }).eq('clave', 'secciones');
      toast(error ? 'No se guardó' : 'Secciones guardadas');
    };
  }

  // ---------- Lista genérica con interruptor ----------
  function lista(sel, titulo, btn, filas, alNuevo, alEditar, alCambiar) {
    const el = $(sel, cont);
    el.innerHTML = h`<div class="fila entre"><h2>${titulo}</h2><button class="btn chico" type="button">+ ${btn}</button></div>
      ${filas.length ? filas.map((f) => h`<div class="interruptor"><span class="miniatura" style="width:46px;height:46px;border-radius:8px;overflow:hidden">${f.img ? `<img src="${f.img}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}</span>
        <button type="button" class="cuerpo editar" data-id="${f.id}" style="background:none;border:0;text-align:left;cursor:pointer;padding:0"><b style="font-weight:600;color:var(--azul);display:block">${esc(f.t)}</b><span class="muted">${esc(f.s)}</span></button>
        <input type="checkbox" role="switch" aria-label="Activo" data-id="${f.id}" ${f.on ? 'checked' : ''}></div>`).join('') : '<div class="vacio">Nada todavía</div>'}`;
    el.querySelector('.btn').onclick = alNuevo;
    el.querySelectorAll('.editar').forEach((b) => b.onclick = () => alEditar(b.dataset.id));
    el.querySelectorAll('input[role=switch]').forEach((i) => i.onchange = () => alCambiar(i.dataset.id, i.checked));
  }

  // ---------- Formulario en diálogo ----------
  function formulario(titulo, campos, valores, guardar, borrar) {
    const dlg = $('#dlg', cont);
    dlg.innerHTML = h`<form method="dialog" class="col" style="gap:12px"><h2>${titulo}</h2>
      ${campos.map((c) => c.tipo === 'select' ? h`<label class="campo">${c.t}<select name="${c.n}">${c.op.map(([v, t]) => `<option value="${v}" ${String(valores[c.n] ?? '') === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`
        : c.tipo === 'check' ? h`<label class="fila" style="font-size:14px"><input type="checkbox" name="${c.n}" ${valores[c.n] ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--azul)">${c.t}</label>`
        : c.tipo === 'file' ? h`<label class="campo">${c.t}<input type="file" name="${c.n}" accept="image/*"></label>`
        : h`<label class="campo">${c.t}<input name="${c.n}" type="${c.tipo || 'text'}" value="${esc(valores[c.n] ?? '')}" ${c.req ? 'required' : ''} ${c.ph ? `placeholder="${c.ph}"` : ''}></label>`).join('')}
      <div class="fila" style="justify-content:flex-end;gap:8px;margin-top:6px">${borrar ? '<button type="button" class="enlace" id="borrar" style="color:var(--rojo);margin-right:auto">Eliminar</button>' : ''}<button type="button" class="btn secundario chico" id="cancelar">Cancelar</button><button class="btn chico" type="submit">Guardar</button></div></form>`;
    dlg.showModal();
    $('#cancelar', dlg).onclick = () => dlg.close();
    if (borrar) $('#borrar', dlg).onclick = async () => { if (confirm('¿Eliminar?')) { await borrar(); dlg.close(); } };
    dlg.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const b = e.target.querySelector('[type=submit]'); b.disabled = true; try { await guardar(new FormData(e.target)); dlg.close(); } catch (err) { toast('No se guardó: ' + err.message); b.disabled = false; } };
  }
  async function imagen(f, campo) { const file = f.get(campo); if (file && file.size) return subir('contenido', campo, await comprimirImagen(file, 1200)); return undefined; }

  // ---------- Novedades ----------
  async function novedades() {
    const { data } = await sb.from('novedades').select('*').order('orden').order('creado_en', { ascending: false });
    const rows = data || [];
    const campos = [
      { n: 'titulo', t: 'Título', req: 1 }, { n: 'subtitulo', t: 'Subtítulo', ph: 'Pedidos hasta…' },
      { n: 'etiqueta', t: 'Etiqueta', tipo: 'select', op: [['Novedad', 'Novedad'], ['Temporada', 'Temporada'], ['Para ti', 'Para ti'], ['Nuevo', 'Nuevo']] },
      { n: 'solo_interes', t: 'Mostrar solo a', tipo: 'select', op: [['', 'Todos'], ...Object.entries(SERVICIOS)] },
      { n: 'enlace', t: 'Enlace (opcional)', ph: '#/cotizar o https://…' }, { n: 'imagen', t: 'Imagen', tipo: 'file' }, { n: 'activa', t: 'Activa', tipo: 'check' },
    ];
    const guardar = (id) => async (f) => {
      const v = { titulo: f.get('titulo'), subtitulo: f.get('subtitulo') || null, etiqueta: f.get('etiqueta'), solo_interes: f.get('solo_interes') || null, enlace: f.get('enlace') || null, activa: !!f.get('activa') };
      const img = await imagen(f, 'imagen'); if (img) v.imagen_url = img;
      const { error } = id ? await sb.from('novedades').update(v).eq('id', id) : await sb.from('novedades').insert(v);
      if (error) throw error; toast('Novedad guardada'); novedades();
    };
    lista('#novedades', 'Novedades', 'Nueva',
      rows.map((n) => ({ id: n.id, img: urlPublica('contenido', n.imagen_url), t: n.titulo, s: `${n.etiqueta}${n.solo_interes ? ' · solo ' + SERVICIOS[n.solo_interes] : ''}${n.subtitulo ? ' · ' + n.subtitulo : ''}`, on: n.activa })),
      () => formulario('Nueva novedad', campos, { etiqueta: 'Novedad', activa: true }, guardar(null)),
      (id) => { const n = rows.find((x) => x.id === id); formulario('Editar novedad', campos, n, guardar(id), async () => { await sb.from('novedades').delete().eq('id', id); novedades(); }); },
      async (id, on) => { await sb.from('novedades').update({ activa: on }).eq('id', id); toast(on ? 'Encendida' : 'Apagada'); });
  }

  // ---------- Disponibles ----------
  async function disponibles() {
    const { data } = await sb.from('disponibles').select('*').order('orden').order('creado_en', { ascending: false });
    const rows = data || [];
    const campos = [{ n: 'nombre', t: 'Pieza', req: 1 }, { n: 'precio', t: 'Precio', tipo: 'number' }, { n: 'existencias', t: 'Existencias', tipo: 'number' }, { n: 'imagen', t: 'Foto', tipo: 'file' }, { n: 'activa', t: 'Activa', tipo: 'check' }];
    const guardar = (id) => async (f) => {
      const v = { nombre: f.get('nombre'), precio: f.get('precio') ? +f.get('precio') : null, existencias: +(f.get('existencias') || 1), activa: !!f.get('activa') };
      const img = await imagen(f, 'imagen'); if (img) v.imagen_url = img;
      const { error } = id ? await sb.from('disponibles').update(v).eq('id', id) : await sb.from('disponibles').insert(v);
      if (error) throw error; toast('Pieza guardada'); disponibles();
    };
    lista('#disponibles', 'Disponible hoy', 'Pieza',
      rows.map((d) => ({ id: d.id, img: urlPublica('contenido', d.imagen_url), t: d.nombre, s: `${d.precio != null ? dinero(d.precio) + ' · ' : ''}quedan ${d.existencias}`, on: d.activa })),
      () => formulario('Nueva pieza disponible', campos, { existencias: 1, activa: true }, guardar(null)),
      (id) => { const d = rows.find((x) => x.id === id); formulario('Editar pieza', campos, d, guardar(id), async () => { await sb.from('disponibles').delete().eq('id', id); disponibles(); }); },
      async (id, on) => { await sb.from('disponibles').update({ activa: on }).eq('id', id); toast(on ? 'Encendida' : 'Apagada'); });
  }

  // ---------- Aliados ----------
  async function aliados() {
    const { data } = await sb.from('aliados').select('*').order('destacado', { ascending: false }).order('orden').order('nombre');
    const rows = data || [];
    const campos = [{ n: 'nombre', t: 'Nombre', req: 1 }, { n: 'categoria', t: 'Categoría', ph: 'Cosplay, Arquitectura, Gaming…', req: 1 }, { n: 'beneficio', t: 'Beneficio', ph: '10 % en telas con tu app' }, { n: 'etiqueta', t: 'Etiqueta corta', ph: '−10 %, 2×1, Regalo' }, { n: 'enlace', t: 'Enlace', ph: 'https://instagram.com/…' }, { n: 'logo', t: 'Logo', tipo: 'file' }, { n: 'destacado', t: 'Destacado', tipo: 'check' }, { n: 'activo', t: 'Activo', tipo: 'check' }];
    const guardar = (id) => async (f) => {
      const v = { nombre: f.get('nombre'), categoria: f.get('categoria'), beneficio: f.get('beneficio') || null, etiqueta: f.get('etiqueta') || null, enlace: f.get('enlace') || null, destacado: !!f.get('destacado'), activo: !!f.get('activo') };
      const img = await imagen(f, 'logo'); if (img) v.logo_url = img;
      const { error } = id ? await sb.from('aliados').update(v).eq('id', id) : await sb.from('aliados').insert(v);
      if (error) throw error; toast('Aliado guardado'); aliados();
    };
    lista('#aliados', 'Aliados', 'Aliado',
      rows.map((a) => ({ id: a.id, img: urlPublica('contenido', a.logo_url), t: a.nombre, s: `${a.categoria}${a.etiqueta ? ' · ' + a.etiqueta : ''}${a.destacado ? ' · destacado' : ''}`, on: a.activo })),
      () => formulario('Nuevo aliado', campos, { activo: true }, guardar(null)),
      (id) => { const a = rows.find((x) => x.id === id); formulario('Editar aliado', campos, a, guardar(id), async () => { await sb.from('aliados').delete().eq('id', id); aliados(); }); },
      async (id, on) => { await sb.from('aliados').update({ activo: on }).eq('id', id); toast(on ? 'Encendido' : 'Apagado'); });
  }

  // ---------- Avisos push ----------
  async function avisos() {
    const el = $('#avisos', cont);
    const { data: ult } = await sb.from('avisos').select('titulo, enviado_en').not('enviado_en', 'is', null).order('enviado_en', { ascending: false }).limit(3);
    const { count } = await sb.from('push_suscripciones').select('id', { count: 'exact', head: true });
    el.innerHTML = h`<h2>Aviso push</h2><p style="font-size:13px;color:var(--teal)">${count || 0} celular${count === 1 ? '' : 'es'} con avisos activados</p>
      <form id="aviso" class="col" style="gap:10px">
        <label class="campo" style="color:var(--teal)">Título<input name="titulo" required placeholder="Llegó la colección Hanal Pixán" style="border:0"></label>
        <label class="campo" style="color:var(--teal)">Mensaje<input name="cuerpo" placeholder="Calaveritas y catrinas impresas en Mérida. Pide la tuya." style="border:0"></label>
        <label class="campo" style="color:var(--teal)">Abre en<input name="url" value="/#/inicio" style="border:0"></label>
        <fieldset style="border:0;padding:0;margin:0"><legend class="campo" style="color:var(--teal);margin-bottom:6px">Para quién</legend>
          <div class="chips" style="--azul:var(--teal)"><label style="border-color:var(--teal);color:var(--crema)"><input type="radio" name="para" value="" checked>Todos</label>${Object.entries(SERVICIOS).map(([k, t]) => `<label style="border-color:var(--teal);color:var(--crema)"><input type="radio" name="para" value="${k}">${t}</label>`).join('')}</div></fieldset>
        <button class="btn ambar" type="submit">Enviar ahora</button>
      </form>
      ${ult?.length ? `<div class="col" style="gap:4px;font-size:12px;color:var(--teal)"><span>Últimos enviados</span>${ult.map((a) => `<span>· ${esc(a.titulo)} — ${new Date(a.enviado_en).toLocaleDateString('es-MX')}</span>`).join('')}</div>` : ''}`;
    $('#aviso', el).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target); const b = e.target.querySelector('button'); b.disabled = true;
      const { data: av, error } = await sb.from('avisos').insert({ titulo: f.get('titulo'), cuerpo: f.get('cuerpo') || null, url: f.get('url') || '/', solo_interes: f.get('para') || null, creado_por: perfil.id }).select().single();
      if (error) { toast('No se guardó el aviso'); b.disabled = false; return; }
      const { data, error: e2 } = await sb.functions.invoke('enviar-push', { body: { aviso_id: av.id } });
      b.disabled = false;
      if (e2) { toast('Guardado, pero no se pudo enviar: ' + e2.message); return; }
      toast(`Enviado a ${data?.enviados ?? 0} celular${data?.enviados === 1 ? '' : 'es'}`);
      e.target.reset(); avisos();
    };
  }
}
