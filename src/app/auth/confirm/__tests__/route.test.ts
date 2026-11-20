/**
 * Pruebas de la ruta /auth/confirm con Supabase y `redirect` SIMULADOS (mock).
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { exchangeCodeForSession, verifyOtp } })),
}));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super("NEXT_REDIRECT");
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));

const { GET } = await import("@/app/auth/confirm/route");

const CODE = "3f1c9a2e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";
const TOKEN = "pkce_0123456789abcdef0123456789abcdef";

async function redirectFor(query: string): Promise<string> {
  try {
    await GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
  } catch (signal) {
    if (signal instanceof RedirectSignal) return signal.url;
    throw signal;
  }
  throw new Error("La ruta no redirigió");
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /auth/confirm – plantilla predeterminada (?code=, PKCE)", () => {
  it("canjea el código y confirma", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=exito");
    expect(exchangeCodeForSession).toHaveBeenCalledWith(CODE, undefined);
  });

  it("pasa sb_flow_id a Supabase cuando viene en la URL", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    await redirectFor(`?code=${CODE}&sb_flow_id=0123456789abcdef0123456789abcdef`);

    expect(exchangeCodeForSession).toHaveBeenCalledWith(CODE, { flowId: "0123456789abcdef0123456789abcdef" });
  });

  it("sin code_verifier (otro navegador) informa correo verificado sin sesión", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "pkce_code_verifier_not_found", status: 400 } });

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=otro-navegador");
  });

  it("verifier que no corresponde (registro repetido) informa correo verificado sin sesión", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "bad_code_verifier", status: 400 } });

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=otro-navegador");
  });

  it("código vencido", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "flow_state_expired", status: 403 } });

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=vencido");
  });

  it("código rechazado (p. ej. ya usado)", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "flow_state_not_found", status: 404 } });

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=invalido");
  });

  it("código con formato inválido: no consulta a Supabase", async () => {
    expect(await redirectFor("?code=%3Cscript%3E")).toBe("/auth/confirmacion?estado=invalido");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirm – errores informados por Supabase en la redirección", () => {
  it("otp_expired → vencido, sin llamar a Supabase", async () => {
    const query = "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

    expect(await redirectFor(query)).toBe("/auth/confirmacion?estado=vencido");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("otro error → inválido, aunque venga acompañado de un código", async () => {
    expect(await redirectFor(`?error=server_error&code=${CODE}`)).toBe("/auth/confirmacion?estado=invalido");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirm – plantilla personalizada (?token_hash=, compatibilidad)", () => {
  it("verifica el token", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });

    expect(await redirectFor(`?token_hash=${TOKEN}&type=email`)).toBe("/auth/confirmacion?estado=exito");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: TOKEN });
  });

  it("token vencido", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { code: "otp_expired", status: 403 } });

    expect(await redirectFor(`?token_hash=${TOKEN}&type=signup`)).toBe("/auth/confirmacion?estado=vencido");
  });

  it("tipo no permitido (recovery): no consulta a Supabase", async () => {
    expect(await redirectFor(`?token_hash=${TOKEN}&type=recovery`)).toBe("/auth/confirmacion?estado=invalido");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirm – casos generales", () => {
  it("sin parámetros → inválido", async () => {
    expect(await redirectFor("")).toBe("/auth/confirmacion?estado=invalido");
  });

  it("ignora parámetros de redirección externos (sin redirección abierta)", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    expect(await redirectFor(`?code=${CODE}&next=https://malicioso.example&redirect_to=//evil.example`)).toBe(
      "/auth/confirmacion?estado=exito",
    );
  });

  it("maneja errores inesperados", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("red caída"));

    expect(await redirectFor(`?code=${CODE}`)).toBe("/auth/confirmacion?estado=error");
  });

  it("no registra el código en los logs", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "flow_state_not_found", status: 404 } });

    await redirectFor(`?code=${CODE}`);

    expect(JSON.stringify(spy.mock.calls)).not.toContain(CODE);
  });
});
