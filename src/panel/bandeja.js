import { sb, urlPrivada, SERVICIOS, ETAPAS, ETAPA_TXT, cuando, dinero } from '../supabase.js';
import { h, esc, $, toast, iniciales } from '../ui.js';
import { montar } from '../pantallas/chat.js';

export async function render(cont, { partes, perfil }) {
  let sel = partes[0] || null;
  let filtro = 'pendientes';
  let desmontar = null;

  cont.innerHTML = h`<div class="bandeja" style="margin:-24px;min-height:calc(100dvh - 64px)">
    <section class="convs" aria-label="Conversaciones">
      <div style="padding:14px;border-bottom:1px solid var(--borde)" class="col">
        <input type="search" id="buscar" placeholder="Buscar cliente o pieza" aria-label="Buscar" style="height:42px;border:1.5px solid #C9CBD6;border-radius:8px;padding:0 12px">
        <div class="rapidas" style="padding:0" id="filtros"><button data-f="pendientes" aria-pressed="true">Sin responder</button><button data-f="activos" aria-pressed="false">Activos</button><button data-f="todos" aria-pressed="false">Todos</button></div>
      </div>
      <div id="lista" style="flex:1;overflow-y:auto"></div>
    </section>
    <section class="conv-chat" id="chat"><div class="vacio" style="margin:auto">Elige una conversación</div></section>
    <aside class="lateral" id="lateral" hidden></aside>
  </div>`;

  const pintarFiltros = () => $$('#filtros button', cont).forEach((b) => { const on = b.dataset.f === filtro; b.setAttribute('aria-pressed', on); b.style.cssText = on ? 'background:var(--azul);color:var(--crema);border-color:var(--azul)' : ''; });
  const $$ = (s, r) => [...r.querySelectorAll(s)];

  async function cargarLista() {
    let q = sb.from('pedidos').select('id, folio, titulo, servicio, etapa, actualizado_en, cliente_id, clientes(nombre)').order('actualizado_en', { ascending: false }).limit(100);
    if (filtro === 'activos') q = q.not('etapa', 'in', '(entregado,cancelado)');
    const { data: peds } = await q;
    const { data: nl } = await sb.from('mensajes').select('pedido_id').eq('autor', 'cliente').eq('leido_taller', false);
    const sinLeer = {}; (nl || []).forEach((m) => sinLeer[m.pedido_id] = (sinLeer[m.pedido_id] || 0) + 1);
    const { data: ults } = await sb.from('mensajes').select('pedido_id, texto, tipo, autor, creado_en').in('pedido_id', (peds || []).map((p) => p.id)).order('creado_en', { ascending: false });
    const ult = {}; (ults || []).forEach((m) => { if (!ult[m.pedido_id]) ult[m.pedido_id] = m; });
    const txt = ($('#buscar', cont).value || '').toLowerCase();
    let lista = peds || [];
    if (filtro === 'pendientes') lista = lista.filter((p) => sinLeer[p.id] || p.etapa === 'recibido');
    if (txt) lista = lista.filter((p) => (p.titulo + ' ' + (p.clientes?.nombre || '')).toLowerCase().includes(txt));
    $('#lista', cont).innerHTML = lista.length ? lista.map((p) => { const u = ult[p.id]; return h`<a class="conv ${p.id === sel ? 'activa' : ''}" href="#/admin/bandeja/${p.id}" data-id="${p.id}">
      <span class="avatar" style="width:42px;height:42px;${sinLeer[p.id] ? 'background:var(--azul);color:var(--crema)' : ''}">${iniciales(p.clientes?.nombre)}</span>
      <span class="cuerpo"><span class="fila entre"><b style="font-weight:600;color:var(--azul)">${esc(p.clientes?.nombre || 'Cliente')}</b><span class="muted">${cuando(p.actualizado_en)}</span></span>
        <span class="ult">${u ? (u.autor === 'taller' ? 'Tú: ' : '') + esc(u.tipo === 'imagen' ? '📷 Imagen' : u.tipo === 'oferta' ? '💰 Oferta' : u.texto || '') : esc(p.titulo)}</span>
        <span class="fila" style="gap:6px;margin-top:4px"><span class="chip ${p.etapa === 'recibido' ? 'ambar' : 'gris'}" style="min-height:20px;font-size:11px">${SERVICIOS[p.servicio]} · ${ETAPA_TXT[p.etapa]}</span>${sinLeer[p.id] ? `<span class="chip" style="min-height:20px;padding:0 7px;font-size:11px">${sinLeer[p.id]}</span>` : ''}</span></span></a>`; }).join('')
      : '<div class="vacio">Nada por aquí</div>';
  }

  async function abrir(id) {
    sel = id;
    [...cont.querySelectorAll('.conv')].forEach((a) => a.classList.toggle('activa', a.dataset.id === id));
    if (desmontar) desmontar();
    const chat = $('#chat', cont); chat.innerHTML = '';
    desmontar = await montar(chat, { pedidoId: id, perfil, lado: 'taller', cabecera: true, alCambiar: () => { cargarLista(); lateral(id); } });
    // La cabecera del chat del taller: cambiar el enlace "atrás" por volver a la lista en móvil
    const a = chat.querySelector('.atras'); if (a) a.href = '#/admin/bandeja';
    lateral(id);
  }

  async function lateral(id) {
    const lat = $('#lateral', cont); lat.hidden = false;
    const [{ data: p }, { data: disp }, { data: ofs }] = await Promise.all([
      sb.from('pedidos').select('*, clientes(nombre, whatsapp, intereses, creado_en)').eq('id', id).single(),
      sb.from('disponibles').select('id,nombre,precio').eq('activa', true).gt('existencias', 0).order('orden').limit(6),
      sb.from('ofertas').select('*').eq('pedido_id', id).order('creado_en', { ascending: false }).limit(1),
    ]);
    if (!p) return;
    const { count } = await sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', p.cliente_id);
    const refs = await Promise.all((p.referencias || []).map((r) => urlPrivada('referencias', r)));
    const ultOf = ofs?.[0];
    lat.innerHTML = h`
      <div class="col" style="gap:4px"><h2>${esc(p.clientes?.nombre || 'Cliente')}</h2>
        <span class="muted">Le interesa: ${(p.clientes?.intereses || []).map((i) => SERVICIOS[i]).join(', ') || '—'} · ${count || 0} pedido${count === 1 ? '' : 's'}</span>
        ${p.clientes?.whatsapp ? `<a class="enlace" href="https://wa.me/52${esc(p.clientes.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" style="min-height:32px">Abrir WhatsApp · ${esc(p.clientes.whatsapp)}</a>` : ''}
      </div>
      ${refs.filter(Boolean).length ? `<div class="galeria">${refs.filter(Boolean).map((u) => `<a href="${u}" target="_blank" rel="noopener"><img class="mini" src="${u}" alt="Referencia"></a>`).join('')}</div>` : ''}
      <form id="cot" class="tarjeta col" style="gap:10px">
        <span class="eyebrow">Cotizador</span>
        <label class="campo">Pieza<input name="pieza" value="${esc(ultOf?.pieza || p.titulo)}" required></label>
        <div class="dos">
          <label class="campo">Material<input name="material" value="${esc(ultOf?.material || '')}" placeholder="PLA, PETG, resina…"></label>
          <label class="campo">Medida<input name="medida" value="${esc(ultOf?.medida || p.medida || '')}"></label>
          <label class="campo">Entrega<input name="tiempo" value="${esc(ultOf?.tiempo || '')}" placeholder="5 días"></label>
          <label class="campo">Precio<input name="precio" type="number" min="0" step="1" inputmode="numeric" value="${ultOf?.precio ?? ''}" required placeholder="$"></label>
        </div>
        <label class="campo">Vigente hasta<input name="vigente" type="date" value="${ultOf?.vigente_hasta || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)}"></label>
        <button class="btn" type="submit">Enviar oferta a la conversación</button>
      </form>
      ${disp?.length ? h`<div class="tarjeta col" style="gap:8px"><span class="eyebrow">Ofrecer al momento</span>${disp.map((d) => h`<div class="fila"><span style="flex:1;font-size:14px">${esc(d.nombre)}${d.precio != null ? ` · ${dinero(d.precio)}` : ''}</span><button class="btn chico secundario ofrecer" data-n="${esc(d.nombre)}" data-p="${d.precio ?? ''}">Ofrecer</button></div>`).join('')}</div>` : ''}
      <div class="tarjeta teal col" style="gap:8px">
        <span class="eyebrow">Etapa del pedido</span>
        <select id="etapa" style="height:44px;border:0;border-radius:8px;padding:0 10px;background:var(--crema)">${ETAPAS.map((e) => `<option value="${e}" ${e === p.etapa ? 'selected' : ''}>${ETAPA_TXT[e]}</option>`).join('')}</select>
        <label class="campo">Entrega estimada<input id="entrega" type="date" value="${p.entrega_estimada || ''}" style="background:var(--crema);border:0"></label>
        <span style="font-size:12px">Al cambiar la etapa, el cliente recibe un mensaje y un aviso.</span>
      </div>`;

    $('#cot', lat).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const { data: o, error } = await sb.from('ofertas').insert({ pedido_id: id, pieza: f.get('pieza'), material: f.get('material') || null, medida: f.get('medida') || null, tiempo: f.get('tiempo') || null, precio: +f.get('precio'), vigente_hasta: f.get('vigente') || null }).select().single();
      if (error) { toast('No se creó la oferta: ' + error.message); return; }
      await sb.from('mensajes').insert({ pedido_id: id, autor: 'taller', autor_id: perfil.id, tipo: 'oferta', oferta_id: o.id, texto: `Oferta: ${o.pieza} · ${dinero(o.precio)}`, leido_taller: true });
      await sb.from('pedidos').update({ etapa: 'oferta' }).eq('id', id);
      toast('Oferta enviada');
    };
    lat.querySelectorAll('.ofrecer').forEach((b) => b.onclick = async () => {
      await sb.from('mensajes').insert({ pedido_id: id, autor: 'taller', autor_id: perfil.id, tipo: 'texto', texto: `Tenemos lista "${b.dataset.n}"${b.dataset.p ? ` en ${dinero(+b.dataset.p)}` : ''}. ¿Te la apartamos?`, leido_taller: true });
      toast('Ofrecida en la conversación');
    });
    $('#etapa', lat).onchange = async (e) => {
      const { error } = await sb.from('pedidos').update({ etapa: e.target.value }).eq('id', id);
      toast(error ? 'No se cambió: ' + error.message : 'Etapa: ' + ETAPA_TXT[e.target.value]);
      cargarLista();
    };
    $('#entrega', lat).onchange = async (e) => { await sb.from('pedidos').update({ entrega_estimada: e.target.value || null }).eq('id', id); toast('Entrega estimada guardada'); };
  }

  $('#filtros', cont).onclick = (e) => { if (e.target.dataset.f) { filtro = e.target.dataset.f; pintarFiltros(); cargarLista(); } };
  $('#buscar', cont).oninput = () => cargarLista();
  $('#lista', cont).onclick = (e) => { const a = e.target.closest('.conv'); if (a) { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); abrir(a.dataset.id); } };
  pintarFiltros();
  await cargarLista();
  if (sel) await abrir(sel);

  // Realtime: mensajes nuevos de cualquier pedido refrescan la lista
  const canal = sb.channel('bandeja').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => cargarLista())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => { cargarLista(); toast('Nueva solicitud'); }).subscribe();
  return () => { sb.removeChannel(canal); if (desmontar) desmontar(); };
}
