import { describe, expect, it } from "vitest";

import { parseOutcome, refineOutcomeWithHash } from "@/lib/auth/confirmation";

describe("parseOutcome", () => {
  it.each(["exito", "otro-navegador", "vencido", "invalido", "error"])("acepta %s", (value) => {
    expect(parseOutcome(value)).toBe(value);
  });

  it.each([undefined, "", "admin", ["exito"]])("trata %s como inválido", (value) => {
    expect(parseOutcome(value)).toBe("invalido");
  });
});

describe("refineOutcomeWithHash", () => {
  const expiredHash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

  it("precisa un resultado inválido como vencido si el fragmento trae otp_expired", () => {
    expect(refineOutcomeWithHash("invalido", expiredHash)).toBe("vencido");
  });

  it("no cambia el resultado con otros errores o sin fragmento", () => {
    expect(refineOutcomeWithHash("invalido", "#error=server_error")).toBe("invalido");
    expect(refineOutcomeWithHash("invalido", "")).toBe("invalido");
  });

  it("nunca altera un resultado de éxito (el fragmento lo controla el navegador)", () => {
    expect(refineOutcomeWithHash("exito", expiredHash)).toBe("exito");
  });
});
