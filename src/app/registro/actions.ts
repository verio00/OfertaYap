"use server";

import {
  mapSignUpError,
  REGISTER_MESSAGES,
  type RegisterState,
} from "@/lib/auth/register-messages";
import { getSiteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateRegistration } from "@/lib/validation/auth";

/**
 * Server Action del registro con correo (HU01 / OFY-10).
 *
 * Seguridad:
 * - Vuelve a validar en el servidor; no confía en la validación del navegador.
 * - Solo lee `email` y `password`. Cualquier otro campo (p. ej. `role`) se
 *   ignora, y no se envían metadatos de usuario a Supabase: el rol `comprador`
 *   lo asigna un trigger de la base de datos (supabase/migrations).
 * - La contraseña se entrega únicamente a Supabase Auth, que la almacena con
 *   hash. Nunca se devuelve al cliente ni se escribe en logs.
 * - Los logs solo incluyen el código de error, sin correo (dato personal).
 */
export async function registerAction(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const validation = validateRegistration({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validation.success) {
    return {
      status: "error",
      message: REGISTER_MESSAGES.invalidFields,
      fieldErrors: validation.fieldErrors,
    };
  }

  const { email, password } = validation.data;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm` },
    });

    if (error) {
      console.error("[registro] signUp rechazado", { code: error.code ?? "desconocido", status: error.status });
      return mapSignUpError(error);
    }

    // Con la confirmación de correo activada (configuración requerida), Supabase
    // no devuelve sesión, tanto para cuentas nuevas como para correos ya
    // registrados: en ambos casos se muestra el mismo mensaje neutral.
    if (data.session) {
      return { status: "success", message: REGISTER_MESSAGES.accountCreated, fieldErrors: {} };
    }
    return { status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} };
  } catch (unexpected) {
    const name = unexpected instanceof Error ? unexpected.name : "UnknownError";
    console.error("[registro] error inesperado", { name });
    return { status: "error", message: REGISTER_MESSAGES.generic, fieldErrors: {} };
  }
}
