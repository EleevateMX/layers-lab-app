import { sb, urlPublica } from '../supabase.js';
import { h, esc, nav } from '../ui.js';
import { pendientesCliente } from './pedidos.js';

export async function render(app, { perfil }) {
  const [{ data }, pend] = await Promise.all([
    sb.from('aliados').select('*').eq('activo', true).order('destacado', { ascending: false }).order('orden').order('nombre'),
    pendientesCliente(perfil.id),
  ]);
  const aliados = data || [];
  const cats = [...new Set(aliados.map((a) => a.categoria))];
  let filtro = 'Todos';

  const pintar = () => {
    const lista = aliados.filter((a) => filtro === 'Todos' || a.categoria === filtro);
    const dest = lista.find((a) => a.destacado);
    app.querySelector('#lista').innerHTML = lista.length ? h`
      ${dest ? h`<div class="tarjeta teal col" style="gap:10px">
        <div class="fila">${logo(dest, 52)}<div><div class="eyebrow">Destacado · ${esc(dest.categoria)}</div><h3>${esc(dest.nombre)}</h3></div></div>
        ${dest.beneficio ? `<p>${esc(dest.beneficio)}</p>` : ''}
        ${dest.enlace ? `<a class="btn chico" href="${esc(dest.enlace)}" target="_blank" rel="noopener" style="align-self:flex-start">Ver beneficio</a>` : ''}
      </div>` : ''}
      <div class="lista">${lista.filter((a) => a !== dest).map((a) => h`<a class="item" href="${a.enlace ? esc(a.enlace) : '#'}" ${a.enlace ? 'target="_blank" rel="noopener"' : ''}>${logo(a, 48)}<span class="cuerpo"><b>${esc(a.nombre)}</b><span class="muted">${esc(a.beneficio || a.categoria)}</span></span>${a.etiqueta ? `<span class="chip ambar" style="min-height:24px;font-size:12px;white-space:nowrap">${esc(a.etiqueta)}</span>` : ''}</a>`).join('')}</div>`
      : '<div class="vacio">Pronto habrá aliados aquí.</div>';
  };

  app.innerHTML = h`<div class="pantalla con-nav">
    <div><h1>Nuestros aliados</h1><p class="muted">Beneficios por ser cliente de Layers Lab. Muestra tu app.</p></div>
    ${cats.length > 1 ? h`<div role="group" aria-label="Filtrar" class="rapidas" style="padding:0;background:none" id="filtros">${['Todos', ...cats].map((c) => `<button type="button" aria-pressed="${c === 'Todos'}" style="${c === 'Todos' ? 'background:var(--azul);color:var(--crema);border-color:var(--azul)' : ''}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div id="lista" class="col" style="gap:14px"></div>
    ${nav('aliados', pend)}
  </div>`;
  pintar();
  app.querySelector('#filtros')?.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    filtro = e.target.textContent;
    app.querySelectorAll('#filtros button').forEach((b) => { const on = b === e.target; b.setAttribute('aria-pressed', on); b.style.cssText = on ? 'background:var(--azul);color:var(--crema);border-color:var(--azul)' : ''; });
    pintar();
  });
}

const logo = (a, s) => a.logo_url
  ? `<img src="${urlPublica('contenido', a.logo_url)}" alt="" style="width:${s}px;height:${s}px;border-radius:10px;object-fit:cover;flex:none;background:#fff">`
  : `<span style="width:${s}px;height:${s}px;border-radius:10px;background:var(--crema);border:1px solid var(--borde);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--azul);flex:none">${esc(a.nombre[0])}</span>`;
