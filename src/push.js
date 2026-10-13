import { sb } from './supabase.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function b64aUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function pushActivo() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

/** Pide permiso (desde un botón, nunca al abrir) y guarda la suscripción. */
export async function activarPush(clienteId) {
  if (!VAPID) { console.warn('Falta VITE_VAPID_PUBLIC_KEY'); return false; }
  if (!('PushManager' in window)) return false;
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aUint8(VAPID) });
  const j = sub.toJSON();
  const { error } = await sb.from('push_suscripciones').upsert(
    { cliente_id: clienteId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: 'endpoint' },
  );
  return !error;
}
