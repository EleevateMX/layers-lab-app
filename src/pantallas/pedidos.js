import { sb, urlPrivada, SERVICIOS, ETAPA_TXT, PASOS, fecha } from '../supabase.js';
import { h, esc, nav, ICO } from '../ui.js';

export async function pendientesCliente(clienteId) {
  const { count } = await sb.from('mensajes').select('id, pedidos!inner(cliente_id)', { count: 'exact', head: true })
    .eq('pedidos.cliente_id', clienteId).eq('autor', 'taller').eq('leido_cliente', false);
  return count || 0;
}

export async function render(app, { perfil }) {
  const [{ data: peds }, { data: noLeidos }, pend] = await Promise.all([
    sb.from('pedidos').select('*').eq('cliente_id', perfil.id).order('actualizado_en', { ascending: false }),
    sb.from('mensajes').select('pedido_id, pedidos!inner(cliente_id)').eq('pedidos.cliente_id', perfil.id).eq('autor', 'taller').eq('leido_cliente', false),
    pendientesCliente(perfil.id),
  ]);
  const porPedido = {};
  (noLeidos || []).forEach((m) => porPedido[m.pedido_id] = (porPedido[m.pedido_id] || 0) + 1);
  const activos = (peds || []).filter((p) => !['entregado', 'cancelado'].includes(p.etapa));
  const pasados = (peds || []).filter((p) => ['entregado', 'cancelado'].includes(p.etapa));

  const tarjetas = await Promise.all(activos.map((p) => tarjeta(p, porPedido[p.id] || 0)));
  app.innerHTML = h`<div class="pantalla con-nav">
    <h1>Mis pedidos</h1>
    ${activos.length ? `<div class="lista">${tarjetas.join('')}</div>` : h`<div class="vacio"><p>Aún no tienes pedidos.</p><a class="btn" href="#/cotizar" style="margin-top:12px">Cotizar mi primera pieza</a></div>`}
    ${pasados.length ? h`<span class="eyebrow" style="margin-top:8px">Anteriores</span><div class="lista">${pasados.map((p) => h`<a class="item" href="#/chat/${p.id}"><div class="cuerpo"><span class="muted">${SERVICIOS[p.servicio]} · #${String(p.folio).padStart(4, '0')}</span><b>${esc(p.titulo)}</b></div><span class="chip ${p.etapa === 'entregado' ? 'teal' : 'gris'}" style="min-height:24px;font-size:11px">${ETAPA_TXT[p.etapa]}</span></a>`).join('')}</div>` : ''}
    ${nav('pedidos', pend)}
  </div>`;
}

async function tarjeta(p, sinLeer) {
  const idx = PASOS.findIndex((s) => s.incluye.includes(p.etapa));
  const avance = p.avance_url ? await urlPrivada('avances', p.avance_url) : null;
  const ofertaLista = p.etapa === 'oferta';
  return h`<div class="tarjeta ${ofertaLista ? 'azul' : ''} col" style="gap:12px">
    <div class="fila" style="align-items:flex-start">
      <div style="flex:1;min-width:0"><span class="muted" style="${ofertaLista ? 'color:var(--teal)' : ''}">${SERVICIOS[p.servicio]} · #${String(p.folio).padStart(4, '0')}</span><h3 style="${ofertaLista ? 'color:var(--crema)' : ''}">${esc(p.titulo)}</h3></div>
      <span class="chip ${['oferta', 'imprimiendo', 'acabado'].includes(p.etapa) ? 'ambar' : p.etapa === 'listo' ? 'teal' : 'gris'}" style="min-height:26px;font-size:11px;white-space:nowrap">${ETAPA_TXT[p.etapa]}</span>
    </div>
    ${ofertaLista ? '' : h`<ol class="progreso" aria-label="Avance del pedido">${PASOS.map((s, i) => `<li class="${i < idx ? 'hecho' : i === idx ? 'actual' : ''}">${s.t}</li>`).join('')}</ol>`}
    ${avance ? `<img src="${avance}" alt="Avance de tu pieza" style="border-radius:10px;max-height:200px;object-fit:cover;width:100%">` : ''}
    ${p.entrega_estimada ? `<div class="muted" style="${ofertaLista ? 'color:var(--teal)' : ''}">Entrega estimada: ${fecha(p.entrega_estimada)}</div>` : ''}
    <a class="btn ${ofertaLista ? 'teal' : 'secundario'}" href="#/chat/${p.id}">${ICO.chat.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8"')}${ofertaLista ? 'Ver oferta y responder' : 'Conversación'}${sinLeer ? `<span class="chip ambar" style="min-height:20px;padding:0 7px;font-size:11px">${sinLeer}</span>` : ''}</a>
  </div>`;
}
