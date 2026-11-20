/**
 * Pruebas de la Server Action de registro con Supabase SIMULADO (mock).
 * Verifican la lógica de la aplicación; no prueban el servicio real de Supabase.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REGISTER_MESSAGES, initialRegisterState, type RegisterState } from "@/lib/auth/register-messages";

const signUp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { signUp } })),
}));

const { registerAction } = await import("@/app/registro/actions");
const { createSupabaseServerClient } = await import("@/lib/supabase/server");

const EMAIL = "nuevo.comprador@correo.pe";
const PASSWORD = "Secreta#2026Ofy";

function buildForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

function run(fields: Record<string, string>): Promise<RegisterState> {
  return registerAction(initialRegisterState, buildForm(fields));
}

/** Respuesta de Supabase con confirmación de correo activada: usuario sin sesión. */
function confirmationPendingResponse(identities: unknown[] = [{ id: "identity" }]) {
  return {
    data: { user: { id: "uuid-nuevo", email: EMAIL, identities }, session: null },
    error: null,
  };
}

beforeEach(() => {
  signUp.mockReset();
  vi.mocked(createSupabaseServerClient).mockClear();
});

describe("registerAction – CP-01 registro válido", () => {
  it("llama a Supabase Auth una sola vez y muestra las instrucciones de verificación", async () => {
    signUp.mockResolvedValue(confirmationPendingResponse());

    const state = await run({ email: `  ${EMAIL.toUpperCase()} `, password: PASSWORD });

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(state).toEqual({ status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} });
  });

  it("informa cuenta creada si Supabase devuelve sesión (confirmación desactivada)", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u" }, session: { access_token: "t" } }, error: null });

    const state = await run({ email: EMAIL, password: PASSWORD });

    expect(state.status).toBe("success");
    expect(state.message).toBe(REGISTER_MESSAGES.accountCreated);
  });
});

describe("registerAction – CP-02/CP-03/CP-04 validación en el servidor", () => {
  it.each([
    ["correo vacío", { email: "", password: PASSWORD }, "email"],
    ["correo solo con espacios", { email: "    ", password: PASSWORD }, "email"],
    ["contraseña vacía", { email: EMAIL, password: "" }, "password"],
    ["correo inválido", { email: "correo-invalido", password: PASSWORD }, "email"],
    ["correo con dominio incompleto", { email: "ana@correo", password: PASSWORD }, "email"],
    ["contraseña débil", { email: EMAIL, password: "123" }, "password"],
  ] as const)("%s: bloquea el registro sin llamar a Supabase", async (_case, fields, field) => {
    const state = await run(fields);

    expect(state.status).toBe("error");
    expect(state.fieldErrors[field]).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("bloquea el envío si faltan ambos campos en el FormData", async () => {
    const state = await registerAction(initialRegisterState, new FormData());

    expect(state.fieldErrors.email).toBeTruthy();
    expect(state.fieldErrors.password).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("registerAction – CP-05 correo existente sin enumeración", () => {
  it("con confirmación activada (usuario ofuscado sin identidades) responde igual que un registro nuevo", async () => {
    signUp.mockResolvedValueOnce(confirmationPendingResponse());
    const nuevo = await run({ email: EMAIL, password: PASSWORD });

    signUp.mockResolvedValueOnce(confirmationPendingResponse([]));
    const existente = await run({ email: EMAIL, password: PASSWORD });

    expect(existente).toEqual(nuevo);
  });

  it.each(["user_already_exists", "email_exists"])(
    "con error %s responde con el mismo mensaje neutral",
    async (code) => {
      signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code, status: 422, message: "User already registered" } });

      const state = await run({ email: EMAIL, password: PASSWORD });

      expect(state).toEqual({ status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} });
      expect(JSON.stringify(state)).not.toMatch(/already|registrad[oa] previamente|existe/i);
    },
  );
});

describe("registerAction – CP-06 sin escalada de privilegios desde el cliente", () => {
  it("ignora campos de rol o metadatos manipulados y no envía user_metadata a Supabase", async () => {
    signUp.mockResolvedValue(confirmationPendingResponse());

    await run({
      email: EMAIL,
      password: PASSWORD,
      role: "administrador",
      "data[role]": "administrador",
      "options[data][role]": "administrador",
      is_admin: "true",
    });

    expect(signUp).toHaveBeenCalledTimes(1);
    const [argumentos] = signUp.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(argumentos).sort()).toEqual(["email", "options", "password"]);
    expect(argumentos.options).toEqual({ emailRedirectTo: "http://localhost:3000/auth/confirm" });
    expect(JSON.stringify(argumentos)).not.toMatch(/administrador|is_admin|role/);
  });
});

describe("registerAction – CP-07 la contraseña no se expone", () => {
  const casos: Array<[string, () => void]> = [
    ["registro exitoso", () => signUp.mockResolvedValue(confirmationPendingResponse())],
    ["error de Supabase", () => signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "weak_password", status: 422, message: `weak ${PASSWORD}` } })],
    ["excepción inesperada", () => signUp.mockRejectedValue(new Error(`fallo con ${PASSWORD}`))],
  ];

  it.each(casos)("%s: la contraseña no aparece en la respuesta ni en los logs", async (_caso, preparar) => {
    preparar();
    const logs = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    const state = await run({ email: EMAIL, password: PASSWORD });

    expect(JSON.stringify(state)).not.toContain(PASSWORD);
    for (const spy of logs) {
      const salida = JSON.stringify(spy.mock.calls);
      expect(salida).not.toContain(PASSWORD);
      expect(salida).not.toContain(EMAIL); // tampoco se registra el correo (dato personal)
    }
  });

  it("no reenvía el mensaje original de Supabase al usuario", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "unexpected_failure", status: 500, message: "Database error saving new user" } });

    const state = await run({ email: EMAIL, password: PASSWORD });

    expect(state).toEqual({ status: "error", message: REGISTER_MESSAGES.generic, fieldErrors: {} });
  });
});

describe("registerAction – otros errores de Supabase", () => {
  it.each([
    ["weak_password", 422, { password: REGISTER_MESSAGES.weakPassword }, REGISTER_MESSAGES.invalidFields],
    ["email_address_invalid", 400, { email: REGISTER_MESSAGES.invalidEmail }, REGISTER_MESSAGES.invalidFields],
    ["over_email_send_rate_limit", 429, {}, REGISTER_MESSAGES.rateLimited],
    ["signup_disabled", 422, {}, REGISTER_MESSAGES.signupUnavailable],
    ["email_address_not_authorized", 400, {}, REGISTER_MESSAGES.emailNotDeliverable],
    [undefined, 429, {}, REGISTER_MESSAGES.rateLimited],
  ] as const)("traduce %s a un mensaje seguro en español", async (code, status, fieldErrors, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { code, status, message: "x" } });

    const state = await run({ email: EMAIL, password: PASSWORD });

    expect(state).toEqual({ status: "error", message, fieldErrors });
  });

  it("maneja la falta de configuración de Supabase sin filtrar detalles", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createSupabaseServerClient).mockRejectedValueOnce(new Error("Falta la variable de entorno"));

    const state = await run({ email: EMAIL, password: PASSWORD });

    expect(state).toEqual({ status: "error", message: REGISTER_MESSAGES.generic, fieldErrors: {} });
  });
});
