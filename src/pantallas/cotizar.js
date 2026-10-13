import { sb, subir, SERVICIOS } from '../supabase.js';
import { h, esc, $, nav, ICO, toast, ir, comprimirImagen } from '../ui.js';

const ACEPTA = 'image/*,.stl,.obj,.3mf,.step,.stp';
const MAX = 5;

export async function render(app, { partes, perfil }) {
  const servicioInicial = SERVICIOS[partes[1]] ? partes[1] : 'impresion';
  let archivos = []; // {file, url}

  app.innerHTML = h`<div class="pantalla con-nav">
    <div><h1>Cotizar</h1><p class="muted">Te respondemos aquí mismo, en la conversación.</p></div>
    <form id="f" class="col" style="gap:14px">
      <fieldset style="border:0;padding:0;margin:0"><legend class="sr">Servicio</legend>
        <div class="segmento">
          ${Object.entries(SERVICIOS).map(([k, t]) => h`<label><input type="radio" name="servicio" value="${k}" ${k === servicioInicial ? 'checked' : ''}>${t.replace(' 3D', '')}</label>`).join('')}
        </div>
      </fieldset>
      <div class="col">
        <span class="campo">Imagen de referencia o archivo 3D</span>
        <div id="previa" hidden style="height:180px;border-radius:12px;background:var(--grafito);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#B9BBCB;font-size:13px"></div>
        <div class="galeria" id="galeria"></div>
        <label class="subir">${ICO.subir}<span>Sube tu modelo o referencia</span><span class="muted" style="font-weight:400">Fotos, capturas o STL / OBJ / 3MF · hasta ${MAX}</span><input type="file" id="archivo" accept="${ACEPTA}" multiple></label>
      </div>
      <div class="dos">
        <label class="campo">Medida aprox.<input name="medida" placeholder="Ej. 30 cm"></label>
        <label class="campo">¿Para cuándo?<input name="fecha" type="date" min="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <label class="campo">Cuéntanos tu idea<textarea name="descripcion" rows="3" placeholder="Color, acabado, personaje, escala de la maqueta…"></textarea></label>
      <div id="msg"></div>
      <button class="btn bloque" type="submit">${ICO.chat.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"')} Enviar y abrir conversación</button>
      <p class="muted" style="text-align:center">Cotización sin compromiso.</p>
    </form>
    ${nav('cotizar')}
  </div>`;

  const galeria = $('#galeria'), previa = $('#previa');
  const pintar = () => {
    galeria.innerHTML = archivos.map((a, i) => a.url
      ? `<img class="mini" src="${a.url}" alt="" data-i="${i}" style="cursor:pointer;${i === sel ? 'outline:2.5px solid var(--ambar)' : ''}">`
      : `<div class="mini" data-i="${i}" style="display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:var(--azul);cursor:pointer;${i === sel ? 'outline:2.5px solid var(--ambar)' : ''}">${esc(a.file.name.split('.').pop().toUpperCase())}</div>`).join('');
    const a = archivos[sel];
    previa.hidden = !a;
    if (a) previa.innerHTML = (a.url ? `<img src="${a.url}" alt="" style="width:100%;height:100%;object-fit:contain">` : `<span>${esc(a.file.name)}</span>`) +
      `<button type="button" class="redondo quitar" aria-label="Quitar" style="position:absolute;top:8px;right:8px;background:var(--crema)">${ICO.x}</button><span class="chip teal" style="position:absolute;left:10px;bottom:10px;min-height:22px;font-size:11px">${sel + 1} de ${archivos.length}</span>`;
  };
  let sel = 0;
  galeria.onclick = (e) => { const i = e.target.closest('[data-i]')?.dataset.i; if (i != null) { sel = +i; pintar(); } };
  previa.onclick = (e) => { if (e.target.closest('.quitar')) { archivos.splice(sel, 1); sel = Math.max(0, sel - 1); pintar(); } };
  $('#archivo').onchange = async (e) => {
    for (const f of [...e.target.files]) {
      if (archivos.length >= MAX) { toast(`Máximo ${MAX} archivos`); break; }
      if (f.size > 25e6) { toast(`${f.name} pesa más de 25 MB`); continue; }
      const file = await comprimirImagen(f);
      archivos.push({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    }
    sel = archivos.length - 1; pintar(); e.target.value = '';
  };

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!archivos.length && !f.get('descripcion').trim()) { $('#msg').innerHTML = '<div class="aviso error">Sube una referencia o cuéntanos tu idea.</div>'; return; }
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const rutas = [];
      for (const a of archivos) rutas.push(await subir('referencias', perfil.id, a.file));
      const servicio = f.get('servicio');
      const titulo = (f.get('descripcion') || '').trim().split(/[.\n]/)[0].slice(0, 60) || `${SERVICIOS[servicio]} · ${perfil.nombre.split(' ')[0]}`;
      const { data: ped, error } = await sb.from('pedidos').insert({
        cliente_id: perfil.id, servicio, titulo, descripcion: f.get('descripcion') || null,
        medida: f.get('medida') || null, fecha_deseada: f.get('fecha') || null, referencias: rutas,
      }).select().single();
      if (error) throw error;
      // Primer mensaje de la conversación: referencias + texto
      const msgs = rutas.filter((r, i) => archivos[i].url).map((r) => ({ pedido_id: ped.id, autor: 'cliente', autor_id: perfil.id, tipo: 'imagen', adjunto_url: r }));
      rutas.forEach((r, i) => { if (!archivos[i].url) msgs.push({ pedido_id: ped.id, autor: 'cliente', autor_id: perfil.id, tipo: 'archivo', adjunto_url: r, texto: archivos[i].file.name }); });
      const detalle = [f.get('descripcion'), f.get('medida') && `Medida: ${f.get('medida')}`, f.get('fecha') && `Lo necesito para el ${f.get('fecha')}`].filter(Boolean).join('\n');
      if (detalle) msgs.push({ pedido_id: ped.id, autor: 'cliente', autor_id: perfil.id, tipo: 'texto', texto: detalle });
      if (msgs.length) await sb.from('mensajes').insert(msgs);
      toast('Solicitud enviada');
      ir('chat/' + ped.id);
    } catch (err) {
      console.error(err);
      $('#msg').innerHTML = `<div class="aviso error">No se pudo enviar: ${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Enviar y abrir conversación';
    }
  };
}
