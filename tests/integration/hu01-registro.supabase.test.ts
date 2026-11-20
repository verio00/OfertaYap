/**
 * PRUEBAS DE INTEGRACIÓN REAL contra Supabase (HU01 / OFY-10).
 *
 * - Requieren un proyecto Supabase de DESARROLLO con la migración
 *   supabase/migrations/20261120000000_hu01_profiles_roles.sql aplicada.
 * - Se omiten automáticamente si faltan las variables de entorno.
 * - El bloque de registro solo se ejecuta si se define INTEGRATION_TEST_EMAIL
 *   (un buzón propio, p. ej. tu.correo+ofy01@gmail.com): envía correos reales
 *   y consume el límite de envíos del proyecto.
 *
 * Ejecutar: npm run test:integration
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const testEmail = process.env.INTEGRATION_TEST_EMAIL;
const configured = Boolean(url && key);

function anonClient() {
  return createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

describe.skipIf(!configured)("Supabase real – RLS de public.profiles (CP-06)", () => {
  it("un visitante anónimo no puede leer perfiles", async () => {
    const { data, error } = await anonClient().from("profiles").select("id, role").limit(1);

    // Sin permiso de SELECT para anon: PostgREST responde 42501 (o, como mínimo, ninguna fila).
    expect(error?.code === "42501" || (Array.isArray(data) && data.length === 0)).toBe(true);
  });

  it("un visitante anónimo no puede crear un perfil administrador", async () => {
    const { error } = await anonClient()
      .from("profiles")
      .insert({ id: crypto.randomUUID(), role: "administrador" });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe.skipIf(!configured || !testEmail)("Supabase real – registro con correo (CP-01, CP-05, CP-07)", () => {
  const password = `Ofy-${crypto.randomUUID()}-A1`;

  it("registra el correo sin sesión (confirmación activada) y sin exponer la contraseña", async () => {
    const { data, error } = await anonClient().auth.signUp({ email: testEmail!, password });

    expect(error).toBeNull();
    expect(data.session).toBeNull(); // la confirmación de correo debe estar activada
    expect(data.user?.user_metadata?.role).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain(password);
  });

  it("un segundo registro con el mismo correo no crea otra identidad ni revela la cuenta", async () => {
    const { data, error } = await anonClient().auth.signUp({ email: testEmail!, password });

    expect(error).toBeNull();
    expect(data.session).toBeNull();
    // Supabase devuelve un usuario ofuscado sin identidades para correos ya registrados.
    expect(data.user?.identities ?? []).toHaveLength(0);
  });
});
