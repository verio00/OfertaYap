import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/env";

/**
 * Crea un cliente de Supabase para el servidor (Server Actions y Route
 * Handlers). Usa solo la clave publishable: no tiene privilegios
 * administrativos. Se crea un cliente nuevo por solicitud.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies. En Server
          // Actions y Route Handlers (los únicos usos en HU01) sí es posible.
        }
      },
    },
  });
}
