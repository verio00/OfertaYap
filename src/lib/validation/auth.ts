/**
 * Validación de credenciales para el registro (HU01 / OFY-10).
 *
 * Módulo puro (sin dependencias de navegador ni de servidor) para que el
 * formulario y la Server Action apliquen exactamente las mismas reglas.
 * La validación del cliente mejora la experiencia de uso; la del servidor es
 * la que protege el sistema. Supabase Auth vuelve a validar y es la autoridad
 * final sobre la política de contraseñas configurada en el proyecto.
 */

/** Longitud máxima de un correo según RFC 5321. */
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;

/**
 * Política de contraseñas (RN-03). Debe coincidir con la configurada en
 * Supabase → Authentication → Policies (ver docs/HU01-registro.md).
 * 72 es el límite de bcrypt, el algoritmo de hash que usa Supabase Auth.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type RegistrationField = "email" | "password";
export type FieldErrors = Partial<Record<RegistrationField, string>>;

export interface RegistrationInput {
  email: string;
  password: string;
}

export type RegistrationValidationResult =
  | { success: true; data: RegistrationInput }
  | { success: false; fieldErrors: FieldErrors };

export const VALIDATION_MESSAGES = {
  emailRequired: "Ingresa tu correo electrónico.",
  emailInvalid: "Ingresa un correo electrónico válido, por ejemplo: nombre@correo.com.",
  emailTooLong: `El correo no puede superar los ${EMAIL_MAX_LENGTH} caracteres.`,
  passwordRequired: "Ingresa una contraseña.",
  passwordTooShort: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  passwordTooLong: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
  passwordComplexity:
    "La contraseña debe incluir al menos una letra minúscula, una mayúscula y un número.",
} as const;

/** Requisitos de contraseña mostrados al usuario como ayuda del campo. */
export const PASSWORD_REQUIREMENTS_HINT = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con mayúscula, minúscula y número.`;

// Etiqueta de dominio: alfanumérica, puede contener guiones internos (máx. 63).
const DOMAIN_LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const EMAIL_PATTERN = new RegExp(
  `^[A-Za-z0-9!#$%&'*+/=?^_\`{|}~.-]+@(?:${DOMAIN_LABEL}\\.)+[A-Za-z]{2,63}$`,
);

/** Convierte un valor de FormData en texto; cualquier otra cosa se trata como vacío. */
function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normaliza el correo: elimina espacios en los extremos y pasa a minúsculas. */
export function normalizeEmail(value: unknown): string {
  return toText(value).trim().toLowerCase();
}

/** Devuelve el mensaje de error del correo o `undefined` si es válido. */
export function validateEmail(email: string): string | undefined {
  if (email.length === 0) return VALIDATION_MESSAGES.emailRequired;
  if (email.length > EMAIL_MAX_LENGTH) return VALIDATION_MESSAGES.emailTooLong;
  if (!EMAIL_PATTERN.test(email)) return VALIDATION_MESSAGES.emailInvalid;

  const local = email.slice(0, email.lastIndexOf("@"));
  if (
    local.length > EMAIL_LOCAL_MAX_LENGTH ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return VALIDATION_MESSAGES.emailInvalid;
  }
  return undefined;
}

/** Devuelve el mensaje de error de la contraseña o `undefined` si es válida. */
export function validatePassword(password: string): string | undefined {
  if (password.length === 0) return VALIDATION_MESSAGES.passwordRequired;
  if (password.length < PASSWORD_MIN_LENGTH) return VALIDATION_MESSAGES.passwordTooShort;
  if (password.length > PASSWORD_MAX_LENGTH) return VALIDATION_MESSAGES.passwordTooLong;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return VALIDATION_MESSAGES.passwordComplexity;
  }
  return undefined;
}

/**
 * Valida los datos del formulario de registro. Solo considera `email` y
 * `password`: cualquier otro dato (por ejemplo, un `role` manipulado) se ignora.
 * La contraseña no se recorta: los espacios forman parte de ella.
 */
export function validateRegistration(input: {
  email: unknown;
  password: unknown;
}): RegistrationValidationResult {
  const email = normalizeEmail(input.email);
  const password = toText(input.password);

  const fieldErrors: FieldErrors = {};
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (emailError) fieldErrors.email = emailError;
  if (passwordError) fieldErrors.password = passwordError;

  if (emailError || passwordError) {
    return { success: false, fieldErrors };
  }
  return { success: true, data: { email, password } };
}
