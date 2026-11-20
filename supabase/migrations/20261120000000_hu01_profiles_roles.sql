-- =============================================================================
-- OfertaYap · HU01 / OFY-10 · Registrar cuenta con correo
-- Perfiles de usuario y asignación segura del rol "comprador".
--
-- Aplicación: Supabase Dashboard → SQL Editor → pegar y ejecutar este archivo
-- en el proyecto de DESARROLLO (o `supabase db push` si se usa Supabase CLI).
-- Es idempotente: puede ejecutarse más de una vez sin duplicar objetos.
--
-- Modelo de seguridad:
--   * La fuente de autorización es public.profiles.role, NO user_metadata
--     (el usuario puede modificar sus propios metadatos).
--   * El rol se asigna con un trigger SECURITY DEFINER sobre auth.users que
--     siempre inserta 'comprador' e ignora cualquier dato enviado por el cliente.
--   * Con RLS, un usuario autenticado solo puede LEER su propio perfil.
--     No existen políticas ni permisos de INSERT/UPDATE/DELETE para
--     anon/authenticated, por lo que nadie puede asignarse 'administrador'.
--   * Un trigger adicional bloquea cambios de rol hechos por roles de API
--     (defensa en profundidad ante una futura política de UPDATE mal definida).
--   * Los administradores solo pueden designarse desde el SQL Editor / backend
--     con privilegios (ver HU16).
-- =============================================================================

begin;

-- 1. Tipo de rol ---------------------------------------------------------------
do $$
begin
  create type public.app_role as enum ('comprador', 'administrador');
exception
  when duplicate_object then null;
end
$$;

-- 2. Tabla de perfiles (1:1 con auth.users) -------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null default 'comprador',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de aplicación de cada usuario de Supabase Auth. Fuente confiable del rol (HU01).';
comment on column public.profiles.role is
  'Rol de aplicación. Asignado por trigger (comprador). No modificable por el propio usuario.';

-- 3. Row Level Security ---------------------------------------------------------
alter table public.profiles enable row level security;

-- Permisos mínimos: anon no accede; authenticated solo puede leer.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Intencionalmente NO se crean políticas INSERT / UPDATE / DELETE.

-- 4. Creación automática del perfil al registrarse ------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El rol se fija aquí; raw_user_meta_data (controlable por el cliente) se ignora.
  insert into public.profiles (id, role)
  values (new.id, 'comprador'::public.app_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Defensa en profundidad: impedir cambios de rol desde la API ----------------
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated') then
    raise exception 'No está permitido modificar el rol del perfil.'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.prevent_profile_role_change() from public, anon, authenticated;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_change();

-- 6. Backfill: perfiles para usuarios creados antes de esta migración -----------
insert into public.profiles (id, role)
select u.id, 'comprador'::public.app_role
from auth.users as u
on conflict (id) do nothing;

commit;
