import { sb, SERVICIOS, ETAPA_TXT, ETAPAS, cuando } from '../supabase.js';
import { h, esc } from '../ui.js';

const COLS = [
  { k: 'Nuevas', etapas: ['recibido'] }, { k: 'Cotizando', etapas: ['cotizando', 'oferta'] }, { k: 'Aceptadas', etapas: ['aceptado'] },
  { k: 'En impresión', etapas: ['imprimiendo'] }, { k: 'Acabado', etapas: ['acabado'] }, { k: 'Listas', etapas: ['listo'] },
];

export async function render(cont) {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const [cli, cliMes, peds, recientes, inst] = await Promise.all([
    sb.from('clientes').select('id', { count: 'exact', head: true }).eq('rol', 'cliente'),
    sb.from('clientes').select('id', { count: 'exact', head: true }).eq('rol', 'cliente').gte('creado_en', desde),
    sb.from('pedidos').select('id, folio, titulo, servicio, etapa, creado_en, clientes(nombre)').not('etapa', 'in', '(entregado,cancelado)').order('creado_en', { ascending: false }),
    sb.from('clientes').select('nombre, whatsapp, intereses, creado_en, app_instalada').eq('rol', 'cliente').order('creado_en', { ascending: false }).limit(8),
    sb.from('clientes').select('id', { count: 'exact', head: true }).eq('app_instalada', true),
  ]);
  const P = peds.data || [];
  const n = (et) => P.filter((p) => et.includes(p.etapa)).length;
  const { data: mes } = await sb.from('pedidos').select('servicio').gte('creado_en', desde);
  const porServ = Object.keys(SERVICIOS).map((k) => [k, (mes || []).filter((p) => p.servicio === k).length]);
  const maxServ = Math.max(1, ...porServ.map((x) => x[1]));

  cont.innerHTML = h`
    <div class="fila entre" style="flex-wrap:wrap;gap:12px"><div><h1 style="font-size:34px">Resumen del taller</h1><p class="muted">Lo que está pasando hoy</p></div><a class="btn" href="#/admin/bandeja">Ir a la bandeja</a></div>
    <div class="kpis">
      <div class="kpi azul"><span style="font-size:13px;color:var(--teal);font-weight:600">Clientes registrados</span><span class="n">${cli.count || 0}</span><span style="font-size:13px">+${cliMes.count || 0} en 30 días · ${inst.count || 0} con la app instalada</span></div>
      <div class="kpi"><span class="muted" style="font-weight:600">Solicitudes nuevas</span><span class="n">${n(['recibido'])}</span><span class="muted">Por cotizar</span></div>
      <div class="kpi"><span class="muted" style="font-weight:600">En producción</span><span class="n">${n(['aceptado', 'imprimiendo', 'acabado'])}</span><span class="muted">Impresión y acabado</span></div>
      <div class="kpi"><span class="muted" style="font-weight:600">Listos para entregar</span><span class="n">${n(['listo'])}</span><span class="muted">Avisar al cliente</span></div>
    </div>
    <section class="col" style="gap:12px"><h2>Producción</h2>
      <div class="tablero">${COLS.map((c) => h`<div class="columna"><h3>${c.k}<span>${n(c.etapas)}</span></h3>
        ${P.filter((p) => c.etapas.includes(p.etapa)).map((p) => h`<a class="ficha ${p.servicio}" href="#/admin/bandeja/${p.id}"><b>${esc(p.titulo)}</b>${SERVICIOS[p.servicio]} · ${esc(p.clientes?.nombre || '')}</a>`).join('')}</div>`).join('')}</div>
      <div class="fila" style="gap:18px;font-size:12px;color:var(--gris)"><span class="fila" style="gap:6px"><span style="width:14px;height:4px;background:var(--teal)"></span>Impresión 3D</span><span class="fila" style="gap:6px"><span style="width:14px;height:4px;background:var(--azul)"></span>Maqueta</span><span class="fila" style="gap:6px"><span style="width:14px;height:4px;background:var(--ambar)"></span>Modelado 3D</span></div>
    </section>
    <section class="rejilla">
      <div class="col" style="gap:12px"><h2>Clientes recientes</h2>
        <div class="tabla-caja"><table><thead><tr><th>Nombre</th><th>WhatsApp</th><th>Interés</th><th>Registro</th><th>App</th></tr></thead><tbody>
          ${(recientes.data || []).map((c) => h`<tr><td style="font-weight:600;color:var(--azul)">${esc(c.nombre)}</td><td>${c.whatsapp ? `<a href="https://wa.me/52${esc(c.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a>` : '—'}</td><td>${(c.intereses || []).map((i) => SERVICIOS[i]).join(', ')}</td><td>${cuando(c.creado_en)}</td><td><span class="chip ${c.app_instalada ? 'teal' : 'gris'}" style="min-height:22px;font-size:11px">${c.app_instalada ? 'Instalada' : 'Solo web'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Aún no hay clientes</td></tr>'}
        </tbody></table></div></div>
      <div class="col" style="gap:12px"><h2>Solicitudes por servicio</h2>
        <div class="tarjeta col" style="gap:16px">${porServ.map(([k, v]) => h`<div class="col" style="gap:6px"><div class="fila entre" style="font-size:14px"><span>${SERVICIOS[k]}</span><b style="font-weight:600;color:var(--azul)">${v}</b></div><div style="height:10px;background:#F0EBDD;border-radius:5px"><div style="width:${Math.round(v / maxServ * 100)}%;height:10px;border-radius:5px;background:${{ impresion: 'var(--teal)', maqueta: 'var(--azul)', modelado: 'var(--ambar)' }[k]}"></div></div></div>`).join('')}<span class="muted">Últimos 30 días</span></div></div>
    </section>`;
}
