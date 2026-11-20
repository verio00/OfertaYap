import type { FieldErrors } from "@/lib/validation/auth";

/**
 * Estado que la Server Action de registro devuelve al formulario.
 * Nunca contiene la contraseña (CP-07).
 */
export interface RegisterState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: FieldErrors;
}

export const initialRegisterState: RegisterState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export const REGISTER_MESSAGES = {
  /**
   * Mensaje neutral (CA-04): se muestra tanto para un registro nuevo como para
   * un correo ya registrado, para no revelar si una cuenta existe.
   */
  checkEmail:
    "Si el correo puede registrarse, te enviamos un enlace para confirmar tu cuenta. Revisa tu bandeja de entrada y la carpeta de spam.",
  /** Solo aplica si la confirmación de correo estuviera desactivada en Supabase. */
  accountCreated: "Tu cuenta fue creada correctamente. Ya puedes iniciar sesión.",
  invalidFields: "Revisa los campos marcados.",
  weakPassword:
    "La contraseña no cumple la política de seguridad. Usa una más larga y difícil de adivinar.",
  invalidEmail: "No pudimos usar ese correo electrónico. Verifica que esté bien escrito.",
  rateLimited: "Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  signupUnavailable: "El registro no está disponible en este momento. Inténtalo más tarde.",
  emailNotDeliverable:
    "No pudimos enviar el correo de verificación a esa dirección. Prueba con otro correo o inténtalo más tarde.",
  generic: "No pudimos completar el registro. Inténtalo nuevamente en unos minutos.",
} as const;

/** Subconjunto de `AuthError` de Supabase que necesitamos (evita acoplarse a la clase). */
export interface AuthErrorLike {
  code?: string;
  status?: number;
}

/**
 * Traduce un error de `supabase.auth.signUp` a un estado seguro para el usuario.
 * Nunca reenvía el texto original de Supabase.
 */
export function mapSignUpError(error: AuthErrorLike): RegisterState {
  switch (error.code) {
    // Correo ya registrado: misma respuesta que un registro nuevo (anti-enumeración).
    case "user_already_exists":
    case "email_exists":
      return { status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} };

    case "weak_password":
      return {
        status: "error",
        message: REGISTER_MESSAGES.invalidFields,
        fieldErrors: { password: REGISTER_MESSAGES.weakPassword },
      };

    case "email_address_invalid":
    case "validation_failed":
      return {
        status: "error",
        message: REGISTER_MESSAGES.invalidFields,
        fieldErrors: { email: REGISTER_MESSAGES.invalidEmail },
      };

    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return { status: "error", message: REGISTER_MESSAGES.rateLimited, fieldErrors: {} };

    case "signup_disabled":
    case "email_provider_disabled":
      return { status: "error", message: REGISTER_MESSAGES.signupUnavailable, fieldErrors: {} };

    case "email_address_not_authorized":
      return { status: "error", message: REGISTER_MESSAGES.emailNotDeliverable, fieldErrors: {} };

    default:
      if (error.status === 429) {
        return { status: "error", message: REGISTER_MESSAGES.rateLimited, fieldErrors: {} };
      }
      return { status: "error", message: REGISTER_MESSAGES.generic, fieldErrors: {} };
  }
}
