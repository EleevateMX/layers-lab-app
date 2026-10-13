# Layers Lab · app de clientes (PWA) y panel

Una sola PWA para Android, iPhone y web. El cliente se registra, cotiza con imagen de referencia, platica con el taller, acepta ofertas y sigue su pedido. El panel (`/#/admin`) controla todo lo que ve el cliente.

## Qué hay

| Carpeta | Qué es |
| --- | --- |
| `src/pantallas/` | App del cliente: registro, instalar, inicio (novedades), cotizar, conversación, aliados, pedidos, perfil |
| `src/panel/` | Panel: resumen, bandeja (chat + cotizador + etapa), contenido (novedades, disponibles, aliados, avisos push) |
| `public/manifest.webmanifest` | Instalable: nombre, iconos, accesos directos |
| `public/sw.js` | Service worker: solo avisos push y pantalla sin conexión. **No cachea la app** a propósito |
| `supabase/migrations/` | Esquema, RLS, triggers, buckets de storage |
| `supabase/functions/enviar-push/` | Función Edge que manda los avisos Web Push (VAPID, sin terceros) |

## Backend (ya está hecho)

Proyecto Supabase: `fvkzwvesepxacdbdozcx` (us-east-1). Ya tiene:

- Tablas: `clientes`, `pedidos`, `mensajes`, `ofertas`, `novedades`, `disponibles`, `aliados`, `ajustes`, `push_suscripciones`, `push_cola`, `avisos`, `interesados`.
- RLS: cada cliente ve solo lo suyo; `rol = 'admin'` ve y edita todo.
- Buckets: `referencias` y `avances` (privados), `contenido` y `avatares` (públicos).
- Realtime en `mensajes`, `pedidos` y `ofertas`.
- Triggers: al registrarse se crea el perfil; al cambiar la etapa se deja un mensaje de sistema y se encola un aviso push; cada mensaje del taller encola un aviso. La cola la vacía `enviar-push` vía `pg_net`.
- Función Edge `enviar-push` desplegada. Lee las llaves VAPID de `ajustes.push_vapid` (solo admin / service role).

## Correr en local

```bash
npm install
cp .env.example .env   # ya viene lleno en el .env de esta carpeta
npm run dev
```

`.env`:

```
VITE_SUPABASE_URL=https://fvkzwvesepxacdbdozcx.supabase.co
VITE_SUPABASE_KEY=sb_publishable_…      # llave publishable (es pública, va en el front)
VITE_VAPID_PUBLIC_KEY=BK4sy4J6…          # llave pública VAPID (la privada está en la base)
```

## Publicar (HTTPS obligatorio para PWA y push)

Cualquiera de estos, todos gratis:

- **Vercel / Netlify / Cloudflare Pages**: conecta el repo o arrastra la carpeta. Build: `npm run build`, salida: `dist`. Agrega las tres variables `VITE_…` en el panel del hosting.
- **GitHub Pages**: la app usa rutas con `#`, así que funciona sin configuración extra. Si queda en una subcarpeta (`usuario.github.io/layers-lab-app`), pon `base: '/layers-lab-app/'` en `vite.config.js` y cambia `/sw.js`, `/manifest.webmanifest` y los `/icons/…` por rutas relativas.

Después de publicar, en Supabase → Authentication → URL Configuration pon tu dominio en **Site URL** y en **Redirect URLs** (`https://tu-dominio/**`), para que los correos de confirmación regresen a la app.

## Primer admin

1. Regístrate en la app con tu correo.
2. En Supabase → SQL Editor:
   ```sql
   update clientes set rol = 'admin' where correo = 'tu@correo.com';
   ```
3. Entra a `https://tu-dominio/#/admin`.

Hay un cliente de prueba ya creado: `prueba@layerslab.test` / `prueba123`, con un pedido de ejemplo. Bórralo desde Supabase → Authentication cuando quieras.

## Entrar con Google ("Layers Lab quiere acceder a tu cuenta")

1. [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto **Layers Lab**.
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo *Externo*, nombre de la app **Layers Lab**, correo de soporte, logo (el cuervo) y dominio de la app. Ese nombre es el que verá el cliente en la pantalla de Google.
3. **Credenciales → Crear credencial → ID de cliente OAuth → Aplicación web**. En *URIs de redirección autorizados* pon:
   `https://fvkzwvesepxacdbdozcx.supabase.co/auth/v1/callback`
4. Copia el *Client ID* y el *Client secret* en Supabase → **Authentication → Providers → Google** y actívalo.
5. En Supabase → Authentication → URL Configuration agrega tu dominio en *Redirect URLs* (`https://tu-dominio/**`).

Mientras la app de Google esté en modo "Prueba", solo entran los correos que agregues como testers; pásala a "Producción" cuando la publiques (sin verificación de Google basta para los permisos básicos de nombre y correo).

## Avisos para ti (taller)

- **Push al celular:** entra como admin en tu celular → Panel → Contenido de la app → *Avisos para mí* → Activar.
- **Correo:** crea una cuenta gratis en [resend.com](https://resend.com), genera una API key y pégala en esa misma tarjeta junto con tu correo. Sin dominio propio, Resend solo entrega al correo con el que te registraste en Resend; cuando tengas dominio, verifícalo ahí y cambia el remitente.
- Te llega un aviso por cada solicitud nueva y cada mensaje de cliente, con botón directo a la bandeja.

## Aviso de privacidad y cookies

`#/privacidad` y `#/cookies` (en `src/pantallas/legal.js`). Cambia `[correo de contacto]` por tu correo real. El banner de cookies se muestra una vez por dispositivo.

## Avisos push

- El permiso se pide desde el botón **Activar** en Perfil, nunca al abrir.
- En iPhone solo funcionan con la app agregada a la pantalla de inicio (iOS 16.4+).
- Automáticos: mensaje del taller, oferta enviada, y etapas *imprimiendo*, *acabado* y *listo*.
- Campañas: Panel → Contenido de la app → Aviso push (a todos o por interés).
- Si algún día quieres mover las llaves VAPID a secretos de la función: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` en Edge Functions → Secrets; la función las prefiere sobre la tabla.

## Notas de desarrollo

- Sin framework: Vite + JS plano + `@supabase/supabase-js`. Rutas con hash (`#/inicio`, `#/chat/:id`, `#/admin/bandeja/:id`).
- `src/pantallas/chat.js` → `montar()` es el mismo chat para cliente y taller.
- El cliente **no puede** editar `pedidos` directo; acepta ofertas con la RPC `aceptar_oferta`. Elimina su cuenta con `eliminar_mi_cuenta`.
- Las imágenes se reducen a 1600 px antes de subir (`comprimirImagen`).
- Secciones de la app: `ajustes.secciones` las enciende/apaga desde el panel (está guardado; falta que la navegación lo lea si quieres ocultar pestañas).

## Pendientes sugeridos

- Ocultar pestañas según `ajustes.secciones`.
- Pago anticipado (Clip, Mercado Pago) cuando lo necesites.
- Empaquetar para Google Play con TWA (Bubblewrap), como en Shakeaholic.
