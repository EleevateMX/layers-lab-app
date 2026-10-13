import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;
if (!url || !key) console.warn('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en .env');

export const sb = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

export const SERVICIOS = {
  impresion: 'Impresión 3D',
  maqueta: 'Maqueta',
  modelado: 'Modelado 3D',
};

export const ETAPAS = ['recibido', 'cotizando', 'oferta', 'aceptado', 'imprimiendo', 'acabado', 'listo', 'entregado', 'cancelado'];
export const ETAPA_TXT = {
  recibido: 'Recibido', cotizando: 'Cotizando', oferta: 'Oferta lista', aceptado: 'Aceptado',
  imprimiendo: 'Imprimiendo', acabado: 'Acabado', listo: 'Listo para entregar', entregado: 'Entregado', cancelado: 'Cancelado',
};
// Pasos que ve el cliente en la barra de avance
export const PASOS = [
  { k: 'recibido', t: 'Recibido', incluye: ['recibido', 'cotizando', 'oferta'] },
  { k: 'aceptado', t: 'Aceptado', incluye: ['aceptado'] },
  { k: 'imprimiendo', t: 'En taller', incluye: ['imprimiendo'] },
  { k: 'acabado', t: 'Acabado', incluye: ['acabado'] },
  { k: 'listo', t: 'Listo', incluye: ['listo', 'entregado'] },
];

/** Perfil del usuario actual (clientes). null si no hay sesión. */
let _perfil = null;
export async function perfil(fresco = false) {
  if (_perfil && !fresco) return _perfil;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { _perfil = null; return null; }
  const { data } = await sb.from('clientes').select('*').eq('id', user.id).single();
  _perfil = data ? { ...data, email: user.email } : null;
  return _perfil;
}
export function olvidarPerfil() { _perfil = null; }

/** URL firmada para un archivo privado (referencias, avances). */
const _firmas = new Map();
export async function urlPrivada(bucket, ruta) {
  if (!ruta) return null;
  const k = bucket + '/' + ruta;
  const c = _firmas.get(k);
  if (c && c.exp > Date.now()) return c.url;
  const { data } = await sb.storage.from(bucket).createSignedUrl(ruta, 3600);
  if (!data) return null;
  _firmas.set(k, { url: data.signedUrl, exp: Date.now() + 3300e3 });
  return data.signedUrl;
}
export function urlPublica(bucket, ruta) {
  if (!ruta) return null;
  if (/^https?:/.test(ruta)) return ruta;
  return sb.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

export async function subir(bucket, carpeta, file) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(ruta, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return ruta;
}

export const dinero = (n) => n == null ? '' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
export const fecha = (s) => s ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
export const hora = (s) => new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
export const esHoy = (s) => new Date(s).toDateString() === new Date().toDateString();
export const cuando = (s) => esHoy(s) ? hora(s) : fecha(s);
