-- =============================================================================
-- OfertaYap · HU01 / OFY-10 · Verificación manual de roles y RLS (CP-06)
--
-- Ejecutar en Supabase Dashboard → SQL Editor del proyecto de DESARROLLO,
-- DESPUÉS de aplicar la migración 20261120000000_hu01_profiles_roles.sql y de
-- registrar al menos un usuario desde /registro.
--
-- No es destructivo: los intentos de escalada se ejecutan dentro de bloques que
-- terminan en excepción, por lo que cualquier cambio se revierte. Los
-- resultados se muestran en la pestaña "Results" y en los NOTICE.
-- =============================================================================

-- 1. RLS activado en public.profiles (esperado: true)
select relname, relrowsecurity as rls_activado
from pg_class
where oid = 'public.profiles'::regclass;

-- 2. Políticas existentes (esperado: solo profiles_select_own, comando SELECT)
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles';

-- 3. Permisos de tabla para roles de API (esperado: authenticated → SELECT únicamente)
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 4. Usuarios recientes y su rol (esperado: role = comprador en todos)
select u.email, u.email_confirmed_at, p.role, p.created_at
from auth.users as u
left join public.profiles as p on p.id = u.id
order by u.created_at desc
limit 10;

-- 5. Usuarios sin perfil (esperado: 0)
select count(*) as usuarios_sin_perfil
from auth.users as u
left join public.profiles as p on p.id = u.id
where p.id is null;

-- 6. Simulación de ataque: un usuario autenticado intenta asignarse 'administrador'
do $$
declare
  v_user uuid;
  v_visible int;
begin
  select id into v_user from public.profiles order by created_at desc limit 1;
  if v_user is null then
    raise notice 'SIN DATOS: registra un usuario desde /registro y vuelve a ejecutar.';
    return;
  end if;

  -- Actuar como el usuario autenticado (igual que una petición de PostgREST).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 6a. Puede leer solo su propio perfil.
  select count(*) into v_visible from public.profiles;
  raise notice 'Perfiles visibles para el usuario: % (esperado: 1)', v_visible;

  -- 6b. UPDATE del propio rol → debe fallar.
  begin
    update public.profiles set role = 'administrador' where id = v_user;
    raise exception 'FALLO CP-06: el usuario pudo actualizar su rol';
  exception when insufficient_privilege then
    raise notice 'OK CP-06: UPDATE de rol rechazado (%)', sqlerrm;
  end;

  -- 6c. INSERT de un perfil administrador → debe fallar.
  begin
    insert into public.profiles (id, role) values (gen_random_uuid(), 'administrador');
    raise exception 'FALLO CP-06: el usuario pudo insertar un perfil administrador';
  exception when insufficient_privilege then
    raise notice 'OK CP-06: INSERT de perfil administrador rechazado (%)', sqlerrm;
  end;

  execute 'reset role';
end
$$;

-- 7. Un usuario anónimo no puede leer perfiles
do $$
begin
  execute 'set local role anon';
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'FALLO: anon pudo leer public.profiles';
  exception when insufficient_privilege then
    raise notice 'OK: anon no puede leer public.profiles (%)', sqlerrm;
  end;
  execute 'reset role';
end
$$;
