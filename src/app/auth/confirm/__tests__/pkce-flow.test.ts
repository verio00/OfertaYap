// @vitest-environment node
/**
 * Prueba de contrato del flujo PKCE de la plantilla predeterminada de Supabase.
 *
 * Usa las librerías REALES @supabase/ssr y @supabase/auth-js; solo se simulan
 * la red (fetch hacia la API de Supabase) y el almacén de cookies de Next.
 * Comprueba que el `code_verifier` guardado en una cookie durante el registro
 * es el que se envía al canjear `?code=` en /auth/confirm.
 * NO sustituye la verificación contra un proyecto Supabase real.
 */
import { createHash } from "node:crypto";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initialRegisterState, REGISTER_MESSAGES } from "@/lib/auth/register-messages";

// ---- Almacén de cookies simulado (un "navegador") -----------------------------
type CookieOptions = { maxAge?: number };
function createBrowserCookies() {
  const jar = new Map<string, string>();
  return {
    jar,
    store: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string, options?: CookieOptions) => {
        if (value === "" || options?.maxAge === 0) jar.delete(name);
        else jar.set(name, value);
      },
    },
  };
}

let browser = createBrowserCookies();
vi.mock("next/headers", () => ({ cookies: async () => browser.store }));

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

// ---- API de Supabase simulada --------------------------------------------------
const AUTH_CODE = "3f1c9a2e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";
const USER = { id: "11111111-2222-3333-4444-555555555555", aud: "authenticated", role: "authenticated", email: "ana@correo.pe" };

interface Captured {
  signupBody?: Record<string, unknown>;
  redirectTo?: string | null;
  tokenBody?: Record<string, unknown>;
}
let captured: Captured;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;

  if (url.pathname === "/auth/v1/signup") {
    captured.signupBody = body;
    captured.redirectTo = url.searchParams.get("redirect_to");
    return json({ ...USER, identities: [{ id: "identity" }], email_confirmed_at: null });
  }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "pkce") {
    captured.tokenBody = body;
    return json({
      access_token: "access-token-de-prueba",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "refresh-token-de-prueba",
      user: { ...USER, email_confirmed_at: new Date().toISOString() },
    });
  }
  return json({ code: 404, error_code: "not_found", msg: "ruta no simulada" }, 404);
});

const { registerAction } = await import("@/app/registro/actions");
const { GET } = await import("@/app/auth/confirm/route");

async function openConfirmationLink(query: string): Promise<string> {
  try {
    await GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
  } catch (signal) {
    if (signal instanceof RedirectSignal) return signal.url;
    throw signal;
  }
  throw new Error("La ruta no redirigió");
}

async function register() {
  const form = new FormData();
  form.append("email", USER.email);
  form.append("password", "Segura2026x");
  return registerAction(initialRegisterState, form);
}

const base64url = (buffer: Buffer) => buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

beforeEach(() => {
  browser = createBrowserCookies();
  captured = {};
  fakeFetch.mockClear();
  vi.stubGlobal("fetch", fakeFetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Flujo PKCE con la plantilla predeterminada (librerías reales, red simulada)", () => {
  it("el registro envía un code_challenge S256 y guarda el code_verifier en una cookie", async () => {
    const state = await register();

    expect(state).toEqual({ status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} });
    expect(captured.signupBody?.code_challenge_method).toBe("s256");
    expect(typeof captured.signupBody?.code_challenge).toBe("string");
    expect(captured.redirectTo).toBe("http://localhost:3000/auth/confirm");
    expect(captured.signupBody?.data).toEqual({}); // sin metadatos (rol)
    expect([...browser.jar.keys()].some((name) => name.endsWith("-auth-token-code-verifier"))).toBe(true);
  });

  it("mismo navegador: /auth/confirm?code= canjea el código con el verifier correcto y crea la sesión", async () => {
    await register();
    const challenge = captured.signupBody?.code_challenge;

    const destino = await openConfirmationLink(`?code=${AUTH_CODE}`);

    expect(destino).toBe("/auth/confirmacion?estado=exito");
    expect(captured.tokenBody?.auth_code).toBe(AUTH_CODE);
    const verifier = String(captured.tokenBody?.code_verifier);
    expect(base64url(createHash("sha256").update(verifier).digest())).toBe(challenge);
    // Se elimina la cookie del verifier por defecto y se guarda la sesión. (auth-js conserva
    // el "slot" del flujo, ya inservible porque el código es de un solo uso.)
    expect(browser.jar.has("sb-mock-project-auth-token-code-verifier")).toBe(false);
    expect([...browser.jar.keys()].some((name) => /-auth-token(\.\d+)?$/.test(name))).toBe(true);
  });

  it("otro navegador (sin la cookie del verifier): no llama a Supabase y lo informa", async () => {
    await register();
    browser = createBrowserCookies(); // navegador distinto, sin cookies
    fakeFetch.mockClear();

    const destino = await openConfirmationLink(`?code=${AUTH_CODE}`);

    expect(destino).toBe("/auth/confirmacion?estado=otro-navegador");
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
