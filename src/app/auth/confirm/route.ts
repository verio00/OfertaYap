import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import type { ConfirmationOutcome } from "@/lib/auth/confirmation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Destino del enlace de confirmación de correo (HU01 / OFY-10).
 *
 * Flujo principal – plantilla PREDETERMINADA de Supabase ({{ .ConfirmationURL }}):
 *   1. El correo enlaza a https://<proyecto>.supabase.co/auth/v1/verify?token=pkce_…&type=signup&redirect_to=…
 *   2. Supabase verifica el token y marca el correo como confirmado.
 *   3. Redirige aquí con `?code=<código PKCE>` (o con `error`/`error_code` si falló).
 *   4. `exchangeCodeForSession` canjea el código usando el `code_verifier` que
 *      @supabase/ssr guardó en una cookie durante el registro (mismo navegador).
 *
 * Flujo alternativo – plantilla personalizada (requiere SMTP propio):
 *   /auth/confirm?token_hash={{ .TokenHash }}&type=email  →  `verifyOtp`.
 *
 * Seguridad:
 * - Valida el formato de los parámetros antes de llamar a Supabase.
 * - No acepta parámetros de redirección: el destino siempre es una ruta interna fija.
 * - No registra códigos, tokens ni correos; solo códigos de error.
 */

const ALLOWED_OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>(["email", "signup"]);
const OPAQUE_VALUE_PATTERN = /^[A-Za-z0-9_-]{8,512}$/;
const FLOW_ID_PARAM = "sb_flow_id";

function resultPath(outcome: ConfirmationOutcome): string {
  return `/auth/confirmacion?estado=${outcome}`;
}

function isOpaqueValue(value: string | null): value is string {
  return value !== null && OPAQUE_VALUE_PATTERN.test(value);
}

function logRejection(step: string, error: { code?: string; status?: number }) {
  console.error(`[confirmacion] ${step} rechazado`, { code: error.code ?? "desconocido", status: error.status });
}

async function exchangeCode(code: string, flowId: string | null): Promise<ConfirmationOutcome> {
  const supabase = await createSupabaseServerClient();
  // `sb_flow_id` solo llega si se activa la opción experimental de auth-js; si no, se usa el verifier por defecto.
  const options = isOpaqueValue(flowId) ? { flowId } : undefined;
  const { error } = await supabase.auth.exchangeCodeForSession(code, options);
  if (!error) return "exito";

  logRejection("exchangeCodeForSession", error);
  // Sin code_verifier (otro navegador/dispositivo) o con uno que no corresponde (registro
  // repetido en el mismo navegador): Supabase ya verificó el correo antes de redirigir
  // aquí, pero no es posible crear la sesión de forma segura.
  if (error.code === "pkce_code_verifier_not_found" || error.code === "bad_code_verifier") return "otro-navegador";
  if (error.code === "flow_state_expired" || error.code === "otp_expired") return "vencido";
  return "invalido";
}

async function verifyTokenHash(tokenHash: string, type: EmailOtpType): Promise<ConfirmationOutcome> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (!error) return "exito";

  logRejection("verifyOtp", error);
  return error.code === "otp_expired" ? "vencido" : "invalido";
}

async function resolveOutcome(params: URLSearchParams): Promise<ConfirmationOutcome> {
  // Error informado por Supabase en la redirección (p. ej. enlace vencido o ya usado).
  const supabaseError = params.get("error_code") ?? params.get("error");
  if (supabaseError) {
    logRejection("verify (Supabase)", { code: params.get("error_code") ?? undefined });
    return params.get("error_code") === "otp_expired" ? "vencido" : "invalido";
  }

  try {
    const code = params.get("code");
    if (code !== null) {
      return isOpaqueValue(code) ? await exchangeCode(code, params.get(FLOW_ID_PARAM)) : "invalido";
    }

    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (isOpaqueValue(tokenHash) && type !== null && ALLOWED_OTP_TYPES.has(type)) {
      return await verifyTokenHash(tokenHash, type as EmailOtpType);
    }
  } catch (unexpected) {
    const name = unexpected instanceof Error ? unexpected.name : "UnknownError";
    console.error("[confirmacion] error inesperado", { name });
    return "error";
  }

  return "invalido";
}

export async function GET(request: NextRequest) {
  const outcome = await resolveOutcome(request.nextUrl.searchParams);
  // `redirect` lanza una excepción controlada por Next: debe quedar fuera del try/catch.
  redirect(resultPath(outcome));
}
