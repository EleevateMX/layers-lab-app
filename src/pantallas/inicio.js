import { sb, urlPublica, SERVICIOS, fecha } from '../supabase.js';
import { h, esc, nav, ICO, iniciales, toast, ir } from '../ui.js';
import { pendientesCliente } from './pedidos.js';

export async function render(app, { perfil }) {
  const [nov, disp, ult, pend] = await Promise.all([
    sb.from('novedades').select('*').eq('activa', true).order('orden').order('creado_en', { ascending: false }),
    sb.from('disponibles').select('*').eq('activa', true).gt('existencias', 0).order('orden').limit(6),
    sb.from('mensajes').select('id,texto,tipo,pedido_id,creado_en,pedidos!inner(cliente_id,titulo)').eq('pedidos.cliente_id', perfil.id).eq('autor', 'taller').eq('leido_cliente', false).order('creado_en', { ascending: false }).limit(1),
    pendientesCliente(perfil.id),
  ]);
  const novedades = (nov.data || []).filter((n) => !n.solo_interes || perfil.intereses?.includes(n.solo_interes));
  const ultimo = ult.data?.[0];

  app.innerHTML = h`<div class="pantalla con-nav">
    <div class="fila entre">
      <a class="fila" href="#/perfil" style="text-decoration:none">
        ${perfil.foto_url ? `<img class="avatar" src="${urlPublica('avatares', perfil.foto_url)}" alt="">` : `<div class="avatar">${iniciales(perfil.nombre)}</div>`}
        <div><div class="muted">Hola,</div><h1 style="font-size:24px">${esc(perfil.nombre.split(' ')[0] || 'cliente')}</h1></div>
      </a>
      <a href="#/pedidos" class="redondo" style="background:#fff;border:1px solid var(--borde);position:relative" aria-label="Mensajes${pend ? `, ${pend} sin leer` : ''}">${ICO.chat}${pend ? `<span class="chip ambar" style="position:absolute;top:-4px;right:-4px;min-height:18px;padding:0 6px;font-size:11px">${pend}</span>` : ''}</a>
    </div>

    ${ultimo ? h`<a href="#/chat/${ultimo.pedido_id}" class="tarjeta azul fila" style="text-decoration:none">
      <img src="/simbolo-crema.png" alt="" style="width:40px">
      <div style="flex:1;min-width:0"><b style="font-weight:600">Tienes un mensaje del taller</b><div style="font-size:13px;color:var(--teal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ultimo.tipo === 'oferta' ? 'Tu cotización está lista' : ultimo.texto || 'Te mandamos una imagen')}</div></div>${ICO.flecha}</a>` : ''}

    ${disp.data?.length ? h`<section class="col">
      <div class="fila entre"><span class="eyebrow">Disponible hoy</span><span class="muted">Listo para llevar</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${disp.data.map((d) => h`<div class="tarjeta" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
          ${d.imagen_url ? `<img src="${urlPublica('contenido', d.imagen_url)}" alt="" style="height:110px;object-fit:cover;width:100%">` : `<div style="height:110px;background:#E9E4D6"></div>`}
          <div style="padding:10px 12px" class="col" style="gap:6px"><b style="font-weight:600;color:var(--azul);font-size:14px">${esc(d.nombre)}</b>
            <div class="fila entre">${d.precio != null ? `<span class="chip ambar" style="min-height:24px;padding:0 8px;font-size:13px">$${Number(d.precio).toLocaleString('es-MX')}</span>` : '<span></span>'}<button class="enlace quiero" data-id="${d.id}" data-n="${esc(d.nombre)}" style="min-height:36px;font-size:13px">La quiero</button></div></div>
        </div>`).join('')}
      </div></section>` : ''}

    <section class="col">
      <span class="eyebrow">¿Qué necesitas?</span>
      <div class="lista">
        ${Object.entries(SERVICIOS).map(([k, t]) => h`<a class="item" href="#/cotizar/${k}"><span class="ico">${ICO[k]}</span><span class="cuerpo"><b>${t}</b><span class="muted">${DESC[k]}</span></span>${ICO.flecha}</a>`).join('')}
      </div>
    </section>

    ${novedades.length ? h`<section class="col"><span class="eyebrow">Novedades</span>
      ${novedades.map((n) => h`<a class="tarjeta ${n.etiqueta === 'Temporada' ? 'oscura' : ''} fila" href="${n.enlace ? esc(n.enlace) : '#/cotizar'}" style="text-decoration:none;color:inherit">
        ${n.imagen_url ? `<img src="${urlPublica('contenido', n.imagen_url)}" alt="" style="width:64px;height:64px;border-radius:8px;object-fit:cover;flex:none">` : `<span class="ico" style="width:64px;height:64px;border-radius:8px;background:var(--teal);display:flex;align-items:center;justify-content:center;flex:none">${ICO.pedidos.replace('<svg', '<svg style="width:30px;height:30px;fill:none;stroke:var(--azul);stroke-width:1.8"')}</span>`}
        <div style="flex:1;min-width:0"><div class="eyebrow" style="color:${n.etiqueta === 'Temporada' ? 'var(--ambar)' : 'var(--azul)'}">${esc(n.etiqueta || 'Novedad')}${n.solo_interes ? ' · para ti' : ''}</div><h3 style="${n.etiqueta === 'Temporada' ? 'color:var(--crema)' : ''}">${esc(n.titulo)}</h3>${n.subtitulo ? `<div class="muted" style="${n.etiqueta === 'Temporada' ? 'color:#B9BBCB' : ''}">${esc(n.subtitulo)}</div>` : ''}</div>
      </a>`).join('')}</section>` : ''}
    ${nav('inicio', pend)}
  </div>`;

  app.querySelectorAll('.quiero').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    // Crea una solicitud ligada a la pieza y abre la conversación
    const { data: ped, error } = await sb.from('pedidos').insert({ cliente_id: perfil.id, servicio: 'impresion', titulo: b.dataset.n, descripcion: 'Quiero esta pieza disponible: ' + b.dataset.n, etapa: 'recibido' }).select().single();
    if (error) { toast('No se pudo enviar, intenta de nuevo'); b.disabled = false; return; }
    await sb.from('interesados').insert({ cliente_id: perfil.id, disponible_id: b.dataset.id, pedido_id: ped.id });
    await sb.from('mensajes').insert({ pedido_id: ped.id, autor: 'cliente', autor_id: perfil.id, tipo: 'texto', texto: `¡Hola! Me interesa "${b.dataset.n}" de "Disponible hoy". ¿Sigue disponible?` });
    ir('chat/' + ped.id);
  });
}

const DESC = { impresion: 'Props, figuras, regalos y repuestos', maqueta: 'Arquitectura y proyectos a escala', modelado: 'Diseñamos el archivo desde tu idea' };
