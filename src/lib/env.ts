/**
 * Lectura centralizada de variables de entorno públicas de Supabase.
 *
 * La clave publishable/anon es pública por diseño: la seguridad la aplican
 * Supabase Auth y las políticas RLS. La clave `service_role` NUNCA debe
 * usarse en esta aplicación ni definirse con el prefijo NEXT_PUBLIC_.
 */

export class MissingEnvError extends Error {
  constructor(variable: string) {
    super(`Falta la variable de entorno ${variable}. Revisa .env.example y docs/HU01-registro.md.`);
    this.name = "MissingEnvError";
  }
}

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new MissingEnvError("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) throw new MissingEnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return { url, publishableKey };
}

/**
 * URL pública del sitio, usada para construir el enlace de confirmación.
 * En desarrollo cae a http://localhost:3000; en producción es obligatoria.
 */
export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new MissingEnvError("NEXT_PUBLIC_SITE_URL");
}
