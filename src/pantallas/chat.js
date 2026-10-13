import { sb, subir, urlPrivada, dinero, fecha, hora, cuando, SERVICIOS, ETAPA_TXT } from '../supabase.js';
import { h, esc, $, ICO, toast, comprimirImagen } from '../ui.js';

/**
 * Conversación de un pedido. Se usa igual en la app (lado cliente) y en el panel (lado taller).
 * montar(contenedor, { pedidoId, perfil, lado: 'cliente'|'taller', cabecera: bool })
 * Devuelve una función para desuscribirse.
 */
export async function montar(cont, { pedidoId, perfil, lado, cabecera = true, alCambiar }) {
  const { data: ped, error } = await sb.from('pedidos').select('*, clientes(nombre, whatsapp)').eq('id', pedidoId).single();
  if (error || !ped) { cont.innerHTML = '<div class="vacio">No encontramos esta conversación.</div>'; return () => {}; }
  const mio = lado; // autor de mis burbujas

  cont.innerHTML = h`<div class="chat">
    ${cabecera ? h`<div class="chat-cab">
      <a class="atras" href="${lado === 'taller' ? '#/admin/bandeja' : '#/pedidos'}" aria-label="Volver">${ICO.atras}</a>
      <div class="avatar" style="width:40px;height:40px">${lado === 'taller' ? esc((ped.clientes?.nombre || '?')[0]) : '<img src="/simbolo-azul.png" alt="" style="width:26px">'}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:600">${lado === 'taller' ? esc(ped.clientes?.nombre || 'Cliente') : 'Layers Lab'}</div><div style="font-size:12px;color:var(--teal)">${SERVICIOS[ped.servicio]} · #${String(ped.folio).padStart(4, '0')}</div></div>
      <span class="chip ambar" id="etapa-chip" style="min-height:26px;font-size:11px;margin-right:6px">${ETAPA_TXT[ped.etapa]}</span>
    </div>` : ''}
    <div class="chat-cuerpo" id="cuerpo"><div class="cargando">Cargando…</div></div>
    ${lado === 'taller' ? h`<div class="rapidas" id="rapidas">${RAPIDAS.map((t) => `<button type="button">${esc(t)}</button>`).join('')}</div>` : ''}
    <form class="chat-pie" id="pie">
      <label class="redondo" aria-label="Adjuntar imagen">${ICO.imagen}<input type="file" accept="image/*" class="sr" id="adj"></label>
      <input type="text" id="txt" placeholder="Escribe un mensaje…" autocomplete="off" aria-label="Mensaje">
      <button class="redondo azul" type="submit" aria-label="Enviar">${ICO.enviar}</button>
    </form>
  </div>`;

  const cuerpo = $('#cuerpo', cont);
  let mensajes = [];
  const ofertas = new Map();

  async function cargar() {
    const [{ data: ms }, { data: os }] = await Promise.all([
      sb.from('mensajes').select('*').eq('pedido_id', pedidoId).order('creado_en'),
      sb.from('ofertas').select('*').eq('pedido_id', pedidoId),
    ]);
    (os || []).forEach((o) => ofertas.set(o.id, o));
    mensajes = ms || [];
    await pintar();
    marcarLeidos();
  }

  async function pintar() {
    const partes = [];
    partes.push(`<div class="burbuja sistema">Solicitud recibida · ${cuando(ped.creado_en)}${ped.medida ? ` · ${esc(ped.medida)}` : ''}${ped.fecha_deseada ? ` · para el ${fecha(ped.fecha_deseada)}` : ''}</div>`);
    for (const m of mensajes) partes.push(await burbuja(m));
    cuerpo.innerHTML = partes.join('');
    cuerpo.scrollTop = cuerpo.scrollHeight;
    if (cabecera) { const c = $('#etapa-chip', cont); if (c) c.textContent = ETAPA_TXT[ped.etapa]; }
    cuerpo.querySelectorAll('[data-oferta]').forEach((b) => b.onclick = () => responderOferta(b.dataset.oferta, b.dataset.accion));
  }

  async function burbuja(m) {
    const esMio = m.autor === mio;
    if (m.tipo === 'sistema') return `<div class="burbuja sistema">${esc(m.texto)}</div>`;
    if (m.tipo === 'oferta') {
      const o = ofertas.get(m.oferta_id);
      if (!o) return '';
      const cinta = o.estado === 'aceptada' ? 'aceptada' : o.estado === 'rechazada' ? 'rechazada' : '';
      const tit = { enviada: 'Oferta', aceptada: 'Oferta aceptada', rechazada: 'Pidió cambios', vencida: 'Oferta vencida' }[o.estado];
      return h`<div class="oferta ${esMio ? 'mia' : ''}">
        <div class="cinta ${cinta}"><span>${tit}</span><span>${o.vigente_hasta ? 'Vigente hasta ' + fecha(o.vigente_hasta) : ''}</span></div>
        <div class="detalle"><div style="font-family:var(--serif);font-size:19px;color:var(--azul)">${esc(o.pieza)}</div>
          ${o.material ? `<div><span class="muted">Material</span><span>${esc(o.material)}</span></div>` : ''}
          ${o.medida ? `<div><span class="muted">Medida</span><span>${esc(o.medida)}</span></div>` : ''}
          ${o.tiempo ? `<div><span class="muted">Entrega</span><span>${esc(o.tiempo)}</span></div>` : ''}
          <div class="total"><span>Total</span><span>${dinero(o.precio)}</span></div></div>
        ${lado === 'cliente' && o.estado === 'enviada' ? `<div class="acciones"><button class="btn" data-oferta="${o.id}" data-accion="aceptada">Aceptar</button><button class="btn secundario" data-oferta="${o.id}" data-accion="rechazada">Pedir cambios</button></div>` : ''}
      </div>`;
    }
    let inner = '';
    if (m.tipo === 'imagen') { const u = await urlPrivada('referencias', m.adjunto_url) || await urlPrivada('avances', m.adjunto_url); inner += u ? `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Imagen" loading="lazy"></a>` : '<em>Imagen</em>'; }
    if (m.tipo === 'archivo') { const u = await urlPrivada('referencias', m.adjunto_url); inner += `<a href="${u || '#'}" target="_blank" rel="noopener" style="color:inherit;font-weight:600">📎 ${esc(m.texto || 'Archivo')}</a>`; }
    else if (m.texto) inner += esc(m.texto).replace(/\n/g, '<br>');
    return `<div class="burbuja ${esMio ? 'mia' : ''}">${inner}<span class="hora">${hora(m.creado_en)}</span></div>`;
  }

  async function marcarLeidos() {
    const col = lado === 'cliente' ? 'leido_cliente' : 'leido_taller';
    const otro = lado === 'cliente' ? 'taller' : 'cliente';
    const ids = mensajes.filter((m) => m.autor === otro && !m[col]).map((m) => m.id);
    if (ids.length) { await sb.from('mensajes').update({ [col]: true }).in('id', ids); alCambiar?.(); }
  }

  async function enviar(texto, file) {
    const msg = { pedido_id: pedidoId, autor: lado, autor_id: perfil.id, tipo: 'texto', texto };
    if (file) {
      const f = await comprimirImagen(file);
      const bucket = lado === 'taller' ? 'avances' : 'referencias';
      msg.adjunto_url = await subir(bucket, lado === 'taller' ? pedidoId : perfil.id, f);
      msg.tipo = 'imagen'; msg.texto = null;
      if (lado === 'taller') await sb.from('pedidos').update({ avance_url: msg.adjunto_url }).eq('id', pedidoId);
    }
    if (lado === 'taller') msg.leido_taller = true; else msg.leido_cliente = true;
    const { error } = await sb.from('mensajes').insert(msg);
    if (error) toast('No se envió: ' + error.message);
    // Si el cliente escribe en un pedido recibido, pasa a "cotizando" lo hace el taller; nada aquí.
  }

  async function responderOferta(id, accion) {
    const { error } = await sb.from('ofertas').update({ estado: accion }).eq('id', id);
    if (error) { toast('No se pudo responder'); return; }
    ofertas.get(id).estado = accion;
    await sb.from('mensajes').insert({ pedido_id: pedidoId, autor: 'cliente', autor_id: perfil.id, tipo: 'texto', texto: accion === 'aceptada' ? '✅ Acepto la oferta.' : 'Me gustaría pedir algunos cambios.', leido_cliente: true });
    if (accion === 'aceptada') {
      // El cliente puede aceptar: la etapa la cambia una función con permisos del servidor
      await sb.rpc('aceptar_oferta', { p_oferta: id });
    }
    pintar();
  }

  $('#pie', cont).onsubmit = async (e) => {
    e.preventDefault();
    const t = $('#txt', cont); const v = t.value.trim();
    if (!v) return; t.value = '';
    await enviar(v);
  };
  $('#adj', cont).onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await enviar(null, f); };
  $('#rapidas', cont)?.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { $('#txt', cont).value = e.target.textContent; $('#txt', cont).focus(); } });

  // Realtime
  const canal = sb.channel('chat-' + pedidoId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `pedido_id=eq.${pedidoId}` }, async ({ new: m }) => {
      if (mensajes.some((x) => x.id === m.id)) return;
      if (m.tipo === 'oferta' && m.oferta_id && !ofertas.has(m.oferta_id)) { const { data } = await sb.from('ofertas').select('*').eq('id', m.oferta_id).single(); if (data) ofertas.set(data.id, data); }
      mensajes.push(m); cuerpo.insertAdjacentHTML('beforeend', await burbuja(m)); cuerpo.scrollTop = cuerpo.scrollHeight;
      cuerpo.querySelectorAll('[data-oferta]').forEach((b) => b.onclick = () => responderOferta(b.dataset.oferta, b.dataset.accion));
      marcarLeidos();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ofertas', filter: `pedido_id=eq.${pedidoId}` }, ({ new: o }) => { ofertas.set(o.id, o); pintar(); })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` }, ({ new: p }) => { Object.assign(ped, p); pintar(); alCambiar?.(); })
    .subscribe();

  await cargar();
  return () => sb.removeChannel(canal);
}

const RAPIDAS = ['¡Qué buen proyecto! ¿Para cuándo lo necesitas?', '¿Qué medida aproximada quieres?', 'Te mando foto del avance 👇', '¡Tu pieza está lista! ¿Cuándo pasas por ella?', 'Gracias por imprimir con nosotros 🖤'];

// Pantalla #/chat/:id (lado cliente)
export async function render(app, { partes, perfil }) {
  const id = partes[1];
  if (!id) { location.hash = '#/pedidos'; return; }
  return montar(app, { pedidoId: id, perfil, lado: 'cliente' });
}
