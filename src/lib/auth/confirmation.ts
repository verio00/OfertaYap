/**
 * Resultados posibles de la confirmación de correo (HU01 / OFY-10) y sus textos.
 * Módulo puro, compartido por la ruta /auth/confirm y la página /auth/confirmacion.
 */

export const CONFIRMATION_OUTCOMES = ["exito", "otro-navegador", "vencido", "invalido", "error"] as const;
export type ConfirmationOutcome = (typeof CONFIRMATION_OUTCOMES)[number];

export interface ConfirmationContent {
  title: string;
  body: string;
  tone: "ok" | "warn";
  cta: { href: string; label: string };
}

export const CONFIRMATION_CONTENT: Record<ConfirmationOutcome, ConfirmationContent> = {
  exito: {
    title: "¡Correo confirmado!",
    body: "Tu cuenta de OfertaYap está activa.",
    tone: "ok",
    cta: { href: "/", label: "Ir al inicio" },
  },
  "otro-navegador": {
    title: "Correo verificado",
    body: "Abriste el enlace en un navegador o dispositivo distinto al que usaste para registrarte, por eso no iniciamos sesión automáticamente. Puedes iniciar sesión con tu correo y contraseña.",
    tone: "ok",
    cta: { href: "/login", label: "Ir a iniciar sesión" },
  },
  vencido: {
    title: "El enlace venció",
    body: "El enlace de confirmación ya no es válido porque expiró o ya fue utilizado. Si aún no confirmaste tu cuenta, regístrate nuevamente con el mismo correo para recibir un enlace nuevo.",
    tone: "warn",
    cta: { href: "/registro", label: "Solicitar un nuevo enlace" },
  },
  invalido: {
    title: "Enlace no válido",
    body: "No pudimos verificar este enlace. Asegúrate de abrir el enlace completo del último correo que te enviamos.",
    tone: "warn",
    cta: { href: "/registro", label: "Volver al registro" },
  },
  error: {
    title: "No pudimos confirmar tu correo",
    body: "Ocurrió un problema temporal. Vuelve a abrir el enlace en unos minutos.",
    tone: "warn",
    cta: { href: "/", label: "Volver al inicio" },
  },
};

export function parseOutcome(value: unknown): ConfirmationOutcome {
  return typeof value === "string" && (CONFIRMATION_OUTCOMES as readonly string[]).includes(value)
    ? (value as ConfirmationOutcome)
    : "invalido";
}

/**
 * Supabase puede informar errores del enlace solo en el fragmento de la URL
 * (`#error=access_denied&error_code=otp_expired…`), que no llega al servidor.
 * El navegador conserva ese fragmento tras la redirección a /auth/confirmacion,
 * así que la página lo usa para precisar un resultado "invalido".
 * Solo puede degradar a "vencido"; nunca convierte un error en éxito.
 */
export function refineOutcomeWithHash(outcome: ConfirmationOutcome, hash: string): ConfirmationOutcome {
  if (outcome !== "invalido" || hash.length <= 1) return outcome;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("error_code") === "otp_expired" ? "vencido" : outcome;
}
