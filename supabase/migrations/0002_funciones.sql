-- Funciones que la app llama por RPC

-- El cliente acepta una oferta: pasa el pedido a "aceptado" (RLS no deja al cliente editar pedidos)
create or replace function public.aceptar_oferta(p_oferta uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_pedido uuid; v_cliente uuid;
begin
  select o.pedido_id, p.cliente_id into v_pedido, v_cliente
  from ofertas o join pedidos p on p.id = o.pedido_id where o.id = p_oferta;
  if v_cliente is distinct from auth.uid() and not es_admin() then
    raise exception 'No puedes aceptar esta oferta';
  end if;
  update ofertas set estado = 'aceptada' where id = p_oferta;
  update ofertas set estado = 'vencida' where pedido_id = v_pedido and id <> p_oferta and estado = 'enviada';
  update pedidos set etapa = 'aceptado' where id = v_pedido and etapa in ('recibido', 'cotizando', 'oferta');
end $$;

-- El cliente elimina su cuenta (y por cascada sus pedidos, mensajes y suscripciones)
create or replace function public.eliminar_mi_cuenta()
returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

-- Cola de avisos push automáticos: mensaje nuevo del taller, oferta y cambio de etapa.
-- La función Edge "enviar-push" procesa la cola (se llama con {cola:true}).
create table if not exists push_cola (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  titulo text not null,
  cuerpo text,
  url text default '/',
  tag text,
  creado_en timestamptz not null default now(),
  enviado_en timestamptz
);
alter table push_cola enable row level security;
create policy "admin cola" on push_cola for all using (es_admin()) with check (es_admin());

create or replace function public.encolar_push_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_titulo text;
begin
  if new.autor <> 'taller' or new.tipo = 'sistema' then return new; end if;
  select cliente_id, titulo into v_cliente, v_titulo from pedidos where id = new.pedido_id;
  insert into push_cola (cliente_id, titulo, cuerpo, url, tag)
  values (v_cliente,
    case new.tipo when 'oferta' then 'Tu cotización está lista' when 'imagen' then 'Layers Lab te mandó una imagen' else 'Layers Lab te escribió' end,
    case new.tipo when 'oferta' then v_titulo else left(coalesce(new.texto, ''), 120) end,
    '/#/chat/' || new.pedido_id, 'chat-' || new.pedido_id);
  return new;
end $$;
create trigger mensajes_push after insert on mensajes for each row execute function public.encolar_push_mensaje();

create or replace function public.encolar_push_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa and new.etapa in ('imprimiendo', 'acabado', 'listo') then
    insert into push_cola (cliente_id, titulo, cuerpo, url, tag)
    values (new.cliente_id,
      case new.etapa when 'listo' then '¡Tu pieza está lista!' when 'imprimiendo' then 'Tu pieza ya está en la impresora' else 'Tu pieza está en acabado' end,
      new.titulo, '/#/pedidos', 'pedido-' || new.id);
  end if;
  return new;
end $$;
create trigger pedidos_push after update on pedidos for each row execute function public.encolar_push_etapa();

-- Llama a la función Edge para vaciar la cola, usando pg_net (sin esperar respuesta)
create extension if not exists pg_net with schema extensions;
create or replace function public.procesar_push_cola()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_key text;
begin
  select valor->>'url', valor->>'key' into v_url, v_key from ajustes where clave = 'push_fn';
  if v_url is null then return new; end if;
  perform net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key), body := '{"cola":true}'::jsonb);
  return new;
end $$;
create trigger push_cola_procesar after insert on push_cola for each row execute function public.procesar_push_cola();

-- Llaves VAPID y URL de la función (la función Edge las lee con service role; solo admin las ve)
-- insert into ajustes (clave, valor) values ('push_vapid', '{"public":"…","private":"…"}'), ('push_fn', '{"url":"https://<ref>.supabase.co/functions/v1/enviar-push","key":"<anon key>"}');

-- ---------- Avisos para el taller (admins): push + correo ----------
alter table push_cola add column if not exists para_admin boolean not null default false;
alter table push_cola add column if not exists pedido_id uuid;

create or replace function public.avisar_admins_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text; v_titulo text;
begin
  if new.autor <> 'cliente' then return new; end if;
  select c.nombre, p.titulo into v_nombre, v_titulo from pedidos p join clientes c on c.id = p.cliente_id where p.id = new.pedido_id;
  insert into push_cola (cliente_id, titulo, cuerpo, url, tag, para_admin, pedido_id)
  select a.id, coalesce(v_nombre, 'Un cliente') || ' te escribió',
    case new.tipo when 'imagen' then '📷 Mandó una imagen · ' || coalesce(v_titulo, '') when 'archivo' then '📎 Mandó un archivo · ' || coalesce(v_titulo, '') else left(coalesce(new.texto, ''), 140) end,
    '/#/admin/bandeja/' || new.pedido_id, 'admin-' || new.pedido_id, true, new.pedido_id
  from clientes a where a.rol = 'admin';
  return new;
end $$;
create trigger mensajes_avisar_admins after insert on mensajes for each row execute function public.avisar_admins_mensaje();

create or replace function public.avisar_admins_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nombre text;
begin
  select nombre into v_nombre from clientes where id = new.cliente_id;
  insert into push_cola (cliente_id, titulo, cuerpo, url, tag, para_admin, pedido_id)
  select a.id, 'Nueva solicitud de ' || coalesce(v_nombre, 'un cliente'),
    initcap(new.servicio::text) || ' · ' || new.titulo || coalesce(' · ' || new.medida, '') || coalesce(' · para el ' || to_char(new.fecha_deseada, 'DD/MM'), ''),
    '/#/admin/bandeja/' || new.id, 'admin-' || new.id, true, new.id
  from clientes a where a.rol = 'admin';
  return new;
end $$;
create trigger pedidos_avisar_admins after insert on pedidos for each row execute function public.avisar_admins_pedido();
-- El correo se configura desde el panel: ajustes.avisos_admin = { correo, resend_key, app_url }
