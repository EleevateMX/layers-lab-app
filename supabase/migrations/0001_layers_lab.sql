-- Layers Lab · app de clientes y panel
-- Esquema inicial

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type servicio as enum ('impresion', 'maqueta', 'modelado');
create type etapa_pedido as enum ('recibido', 'cotizando', 'oferta', 'aceptado', 'imprimiendo', 'acabado', 'listo', 'entregado', 'cancelado');
create type autor_mensaje as enum ('cliente', 'taller');
create type tipo_mensaje as enum ('texto', 'imagen', 'archivo', 'oferta', 'sistema');
create type estado_oferta as enum ('enviada', 'aceptada', 'rechazada', 'vencida');

-- ---------- Clientes (perfil, 1:1 con auth.users) ----------
create table clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  whatsapp text,
  correo text,
  intereses servicio[] not null default '{}',
  foto_url text,
  rol text not null default 'cliente' check (rol in ('cliente', 'admin')),
  acepta_avisos boolean not null default true,
  app_instalada boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Crea el perfil al registrarse; toma los datos extra del formulario (raw_user_meta_data)
create or replace function public.crear_perfil_cliente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.clientes (id, nombre, whatsapp, correo, intereses)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.raw_user_meta_data->>'whatsapp',
    new.email,
    coalesce((select array_agg(x::servicio) from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'intereses', '[]'::jsonb)) as x), '{}')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_cliente();

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where id = auth.uid() and rol = 'admin');
$$;

-- ---------- Pedidos (una solicitud = un pedido con su conversación) ----------
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  folio serial,
  cliente_id uuid not null references clientes(id) on delete cascade,
  servicio servicio not null,
  titulo text not null default '',
  descripcion text,
  medida text,
  fecha_deseada date,
  etapa etapa_pedido not null default 'recibido',
  referencias text[] not null default '{}',   -- rutas en storage (bucket referencias)
  avance_url text,                              -- foto del avance que sube el taller
  entrega_estimada date,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index on pedidos (cliente_id, creado_en desc);
create index on pedidos (etapa);

-- ---------- Mensajes (conversación por pedido) ----------
create table mensajes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  autor autor_mensaje not null,
  autor_id uuid references clientes(id),
  tipo tipo_mensaje not null default 'texto',
  texto text,
  adjunto_url text,
  oferta_id uuid,
  leido_cliente boolean not null default false,
  leido_taller boolean not null default false,
  creado_en timestamptz not null default now()
);
create index on mensajes (pedido_id, creado_en);

-- ---------- Ofertas (cotización enviada en la conversación) ----------
create table ofertas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  pieza text not null,
  material text,
  medida text,
  tiempo text,
  precio numeric(10,2) not null,
  vigente_hasta date,
  estado estado_oferta not null default 'enviada',
  creado_en timestamptz not null default now()
);
alter table mensajes add constraint mensajes_oferta_fk foreign key (oferta_id) references ofertas(id) on delete set null;

-- ---------- Contenido que controla el panel ----------
create table novedades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  etiqueta text default 'Novedad',          -- Temporada, Para ti, etc.
  imagen_url text,
  enlace text,
  solo_interes servicio,                     -- null = para todos
  activa boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table disponibles (                   -- "Disponible hoy": piezas listas para llevar
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(10,2),
  imagen_url text,
  existencias int not null default 1,
  activa boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table aliados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'General',
  beneficio text,
  etiqueta text,                             -- −10 %, 2×1, Regalo…
  logo_url text,
  enlace text,
  destacado boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table ajustes (                       -- secciones visibles y otros interruptores
  clave text primary key,
  valor jsonb not null default '{}'::jsonb
);
insert into ajustes (clave, valor) values
  ('secciones', '{"inicio":true,"cotizar":true,"aliados":true,"pedidos":true,"perfil":true}'),
  ('negocio', '{"nombre":"Layers Lab","instagram":"layers_lab.mid","ciudad":"Mérida, Yucatán","whatsapp":""}');

-- ---------- Avisos push ----------
create table push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);

create table avisos (                        -- campañas y avisos automáticos
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text,
  url text default '/',
  solo_interes servicio,
  cliente_id uuid references clientes(id),   -- aviso a una sola persona
  enviado_en timestamptz,
  creado_por uuid references clientes(id),
  creado_en timestamptz not null default now()
);

-- ---------- Interesados en una pieza disponible ("La quiero") ----------
create table interesados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  disponible_id uuid not null references disponibles(id) on delete cascade,
  pedido_id uuid references pedidos(id) on delete set null,
  creado_en timestamptz not null default now()
);

-- ---------- Triggers de mantenimiento ----------
create or replace function public.tocar_pedido()
returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;  -- evita el choque con el trigger de etapa
  update pedidos set actualizado_en = now() where id = new.pedido_id;
  return new;
end $$;
create trigger mensajes_tocan_pedido after insert on mensajes for each row execute function public.tocar_pedido();

-- Al cambiar la etapa, deja un mensaje de sistema en la conversación
create or replace function public.avisar_cambio_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into mensajes (pedido_id, autor, tipo, texto, leido_taller)
    values (new.id, 'taller', 'sistema',
      case new.etapa
        when 'aceptado' then 'Cotización aceptada. ¡Empezamos!'
        when 'imprimiendo' then 'Tu pieza ya está en la impresora, capa por capa.'
        when 'acabado' then 'Estamos en el lijado y la pintura.'
        when 'listo' then '¡Tu pieza está lista para entregar!'
        when 'entregado' then 'Pieza entregada. ¡Gracias por imprimir con nosotros!'
        when 'cancelado' then 'Este pedido se canceló.'
        else 'La etapa cambió a ' || new.etapa::text
      end, true);
    new.actualizado_en := now();
  end if;
  return new;
end $$;
create trigger pedidos_cambio_etapa before update on pedidos for each row execute function public.avisar_cambio_etapa();

-- ---------- RLS ----------
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table mensajes enable row level security;
alter table ofertas enable row level security;
alter table novedades enable row level security;
alter table disponibles enable row level security;
alter table aliados enable row level security;
alter table ajustes enable row level security;
alter table push_suscripciones enable row level security;
alter table avisos enable row level security;
alter table interesados enable row level security;

-- clientes: cada quien lo suyo; admin todo
create policy "cliente ve su perfil" on clientes for select using (id = auth.uid() or es_admin());
create policy "cliente edita su perfil" on clientes for update using (id = auth.uid() or es_admin()) with check (id = auth.uid() or es_admin());
create policy "cliente borra su cuenta" on clientes for delete using (id = auth.uid() or es_admin());

-- pedidos
create policy "pedidos propios" on pedidos for select using (cliente_id = auth.uid() or es_admin());
create policy "cliente crea pedido" on pedidos for insert with check (cliente_id = auth.uid() or es_admin());
create policy "taller edita pedido" on pedidos for update using (es_admin()) with check (es_admin());
create policy "taller borra pedido" on pedidos for delete using (es_admin());

-- mensajes: los del pedido propio
create policy "mensajes del pedido propio" on mensajes for select
  using (es_admin() or exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()));
create policy "cliente escribe en su pedido" on mensajes for insert
  with check (
    (autor = 'cliente' and exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()))
    or (autor = 'taller' and es_admin())
  );
create policy "marcar leidos" on mensajes for update
  using (es_admin() or exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()));

-- ofertas: el cliente las ve y responde; el taller las crea
create policy "ofertas del pedido propio" on ofertas for select
  using (es_admin() or exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()));
create policy "taller crea oferta" on ofertas for insert with check (es_admin());
create policy "cliente responde oferta" on ofertas for update
  using (es_admin() or exists (select 1 from pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()));

-- contenido: todos leen lo activo; admin edita
create policy "novedades activas" on novedades for select using (activa or es_admin());
create policy "admin novedades" on novedades for all using (es_admin()) with check (es_admin());
create policy "disponibles activas" on disponibles for select using (activa or es_admin());
create policy "admin disponibles" on disponibles for all using (es_admin()) with check (es_admin());
create policy "aliados activos" on aliados for select using (activo or es_admin());
create policy "admin aliados" on aliados for all using (es_admin()) with check (es_admin());
create policy "ajustes publicos" on ajustes for select using (clave in ('secciones','negocio') or es_admin());
create policy "admin ajustes" on ajustes for all using (es_admin()) with check (es_admin());

-- push
create policy "suscripcion propia" on push_suscripciones for all
  using (cliente_id = auth.uid() or es_admin()) with check (cliente_id = auth.uid() or es_admin());
create policy "admin avisos" on avisos for all using (es_admin()) with check (es_admin());

-- interesados
create policy "interes propio" on interesados for select using (cliente_id = auth.uid() or es_admin());
create policy "cliente se interesa" on interesados for insert with check (cliente_id = auth.uid());

-- ---------- Realtime ----------
alter publication supabase_realtime add table mensajes;
alter publication supabase_realtime add table pedidos;
alter publication supabase_realtime add table ofertas;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values
  ('referencias', 'referencias', false),
  ('avances', 'avances', false),
  ('contenido', 'contenido', true),
  ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- referencias: carpeta por cliente ({uid}/archivo); el taller lee todo
create policy "cliente sube referencias" on storage.objects for insert
  with check (bucket_id = 'referencias' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "referencias propias o taller" on storage.objects for select
  using (bucket_id = 'referencias' and ((storage.foldername(name))[1] = auth.uid()::text or es_admin()));
-- avances: sube el taller, lee el dueño del pedido ({pedido_id}/archivo)
create policy "taller sube avances" on storage.objects for insert with check (bucket_id = 'avances' and es_admin());
create policy "avances del pedido propio" on storage.objects for select
  using (bucket_id = 'avances' and (es_admin() or exists (
    select 1 from pedidos p where p.id::text = (storage.foldername(name))[1] and p.cliente_id = auth.uid())));
-- contenido (público): solo admin escribe
create policy "contenido publico" on storage.objects for select using (bucket_id in ('contenido', 'avatares'));
create policy "admin sube contenido" on storage.objects for insert with check (bucket_id = 'contenido' and es_admin());
create policy "admin edita contenido" on storage.objects for update using (bucket_id = 'contenido' and es_admin());
create policy "admin borra contenido" on storage.objects for delete using (bucket_id = 'contenido' and es_admin());
-- avatares: cada quien el suyo
create policy "cliente sube avatar" on storage.objects for insert
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cliente cambia avatar" on storage.objects for update
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
