// Layers Lab · enviar-push
// Envía avisos Web Push con VAPID, sin servicios de terceros.
// Body: { aviso_id } → campaña del panel (tabla avisos)
//       { cola: true } → vacía push_cola (avisos automáticos)
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SB_URL, SERVICE);

// Llaves VAPID: de los secretos de la función o, si no, de ajustes.push_vapid (solo admin / service role las leen)
let vapidListo = false;
async function prepararVapid() {
  if (vapidListo) return;
  let pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) {
    const { data } = await sb.from('ajustes').select('valor').eq('clave', 'push_vapid').single();
    pub = data?.valor?.public; priv = data?.valor?.private;
  }
  if (!pub || !priv) throw new Error('Faltan llaves VAPID');
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:layerslab.mid@gmail.com', pub, priv);
  vapidListo = true;
}

// Correo para el taller (Resend). Config en ajustes.avisos_admin = { correo, resend_key, de }
async function correoAdmin(titulo: string, cuerpo: string | null, url: string | null) {
  const { data } = await sb.from('ajustes').select('valor').eq('clave', 'avisos_admin').single();
  const v = data?.valor || {};
  if (!v.correo || !v.resend_key) return false;
  const base = v.app_url || '';
  const enlace = url ? base + url : base;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${v.resend_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: v.de || 'Layers Lab <onboarding@resend.dev>',
      to: [v.correo],
      subject: titulo,
      html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FDF8EC;color:#22242B">
        <h2 style="font-family:Georgia,serif;font-weight:400;color:#1C1F4A;margin:0 0 8px">${titulo}</h2>
        <p style="margin:0 0 20px;line-height:1.5">${(cuerpo || '').replace(/</g, '&lt;')}</p>
        ${enlace ? `<a href="${enlace}" style="display:inline-block;background:#1C1F4A;color:#FDF8EC;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Abrir en el panel</a>` : ''}
        <p style="margin:24px 0 0;font-size:12px;color:#4A4E5A">Layers Lab · Impresión 3D a tu medida · Mérida</p></div>`,
    }),
  });
  if (!r.ok) console.error('resend', r.status, await r.text());
  return r.ok;
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function enviarA(clientes: string[] | null, payload: Record<string, unknown>) {
  let q = sb.from('push_suscripciones').select('id, cliente_id, endpoint, p256dh, auth');
  if (clientes) q = q.in('cliente_id', clientes);
  const { data: subs } = await q;
  let ok = 0;
  const muertas: string[] = [];
  await Promise.all((subs || []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 });
      ok++;
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) muertas.push(s.id);
      else console.error('push', st, (e as Error).message);
    }
  }));
  if (muertas.length) await sb.from('push_suscripciones').delete().in('id', muertas);
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    await prepararVapid();

    if (body.cola) {
      // Avisos automáticos pendientes
      const { data: pend } = await sb.from('push_cola').select('*').is('enviado_en', null).order('id').limit(200);
      let enviados = 0;
      for (const p of pend || []) {
        enviados += await enviarA([p.cliente_id], { title: p.titulo, body: p.cuerpo, url: p.url, tag: p.tag });
        if (p.para_admin) await correoAdmin(p.titulo, p.cuerpo, p.url).catch((e) => console.error('correo', e));
        await sb.from('push_cola').update({ enviado_en: new Date().toISOString() }).eq('id', p.id);
      }
      return json({ enviados, procesados: pend?.length || 0 });
    }

    if (body.aviso_id) {
      // Campaña desde el panel: solo admin
      const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
      const { data: { user } } = await createClient(SB_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
      const { data: yo } = await sb.from('clientes').select('rol').eq('id', user?.id || '').single();
      if (yo?.rol !== 'admin') return json({ error: 'Solo admin' }, 403);

      const { data: av } = await sb.from('avisos').select('*').eq('id', body.aviso_id).single();
      if (!av) return json({ error: 'Aviso no existe' }, 404);
      let clientes: string[] | null = null;
      if (av.cliente_id) clientes = [av.cliente_id];
      else {
        let q = sb.from('clientes').select('id').eq('acepta_avisos', true);
        if (av.solo_interes) q = q.contains('intereses', [av.solo_interes]);
        const { data } = await q; clientes = (data || []).map((c) => c.id);
      }
      const enviados = await enviarA(clientes, { title: av.titulo, body: av.cuerpo, url: av.url || '/', tag: 'aviso-' + av.id });
      await sb.from('avisos').update({ enviado_en: new Date().toISOString() }).eq('id', av.id);
      return json({ enviados });
    }
    return json({ error: 'Nada que enviar' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
