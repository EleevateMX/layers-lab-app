import { sb } from '../supabase.js';
import { h, $ } from '../ui.js';
import * as resumen from './resumen.js';
import * as bandeja from './bandeja.js';
import * as contenido from './contenido.js';

const SECC = { resumen, bandeja, contenido };

export async function render(app, { partes, perfil }) {
  const secc = SECC[partes[1]] ? partes[1] : 'resumen';
  const { count: sinResponder } = await sb.from('mensajes').select('id', { count: 'exact', head: true }).eq('autor', 'cliente').eq('leido_taller', false);
  app.innerHTML = h`<div class="panel">
    <header class="panel-cab">
      <a class="marca" href="#/admin"><img src="/logo-crema.png" alt="" style="width:38px">Layers Lab · Panel</a>
      <nav aria-label="Secciones">
        <a href="#/admin/resumen" class="${secc === 'resumen' ? 'activo' : ''}">Resumen</a>
        <a href="#/admin/bandeja" class="${secc === 'bandeja' ? 'activo' : ''}">Bandeja ${sinResponder ? `<span class="chip ambar" style="min-height:20px;padding:0 7px;font-size:11px">${sinResponder}</span>` : ''}</a>
        <a href="#/admin/contenido" class="${secc === 'contenido' ? 'activo' : ''}">Contenido de la app</a>
      </nav>
      <a href="#/inicio" class="salir" style="color:var(--teal);font-size:13px;text-decoration:none">Ver como cliente →</a>
    </header>
    <div id="secc" class="panel-cuerpo"></div>
  </div>`;
  return SECC[secc].render($('#secc'), { partes: partes.slice(2), perfil });
}
