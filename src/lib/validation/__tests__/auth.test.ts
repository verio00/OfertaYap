/**
 * Pruebas unitarias de validación (RN-01, RN-02, RN-03). Sin mocks ni red.
 * Cubren CP-02, CP-03 y CP-04 a nivel de reglas.
 */
import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  VALIDATION_MESSAGES,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateRegistration,
} from "@/lib/validation/auth";

const VALID_PASSWORD = "Segura123";

describe("normalizeEmail", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizeEmail("  Ana.Perez@Correo.PE  ")).toBe("ana.perez@correo.pe");
  });

  it("trata valores que no son texto como vacío", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(new Blob(["x"]))).toBe("");
  });
});

describe("validateEmail", () => {
  it.each(["ana@correo.com", "ana.perez+ofertas@sub.dominio.com.pe", "user_1@mi-tienda.pe"])(
    "acepta %s",
    (email) => {
      expect(validateEmail(email)).toBeUndefined();
    },
  );

  it("CP-02: exige el correo", () => {
    expect(validateEmail("")).toBe(VALIDATION_MESSAGES.emailRequired);
  });

  it.each([
    "anacorreo.com",
    "ana@",
    "@correo.com",
    "ana@correo",
    "ana@@correo.com",
    "ana @correo.com",
    "ana@correo..com",
    ".ana@correo.com",
    "ana.@correo.com",
    "ana..perez@correo.com",
    "ana@-correo.com",
    "ana@correo.c",
    "ana@correo.123",
    "<script>@correo.com",
  ])("CP-04: rechaza el formato inválido %s", (email) => {
    expect(validateEmail(email)).toBe(VALIDATION_MESSAGES.emailInvalid);
  });

  it("rechaza correos demasiado largos", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(190)}.com`;
    expect(validateEmail(email)).toBe(VALIDATION_MESSAGES.emailTooLong);
  });

  it("rechaza una parte local mayor a 64 caracteres", () => {
    expect(validateEmail(`${"a".repeat(65)}@correo.com`)).toBe(VALIDATION_MESSAGES.emailInvalid);
  });
});

describe("validatePassword", () => {
  it("acepta una contraseña que cumple la política", () => {
    expect(validatePassword(VALID_PASSWORD)).toBeUndefined();
  });

  it("CP-03: exige la contraseña", () => {
    expect(validatePassword("")).toBe(VALIDATION_MESSAGES.passwordRequired);
  });

  it("exige la longitud mínima", () => {
    expect(validatePassword("Ab1")).toBe(VALIDATION_MESSAGES.passwordTooShort);
  });

  it("rechaza contraseñas mayores al límite de bcrypt", () => {
    expect(validatePassword(`Aa1${"x".repeat(PASSWORD_MAX_LENGTH)}`)).toBe(VALIDATION_MESSAGES.passwordTooLong);
  });

  it.each(["solominusculas1", "SOLOMAYUSCULAS1", "SinNumerosAqui", "        "])(
    "exige minúscula, mayúscula y número: %s",
    (password) => {
      expect(validatePassword(password)).toBe(VALIDATION_MESSAGES.passwordComplexity);
    },
  );
});

describe("validateRegistration", () => {
  it("devuelve datos normalizados cuando todo es válido", () => {
    const result = validateRegistration({ email: " Ana@Correo.com ", password: VALID_PASSWORD });
    expect(result).toEqual({ success: true, data: { email: "ana@correo.com", password: VALID_PASSWORD } });
  });

  it("CP-02: un correo con solo espacios se considera vacío", () => {
    const result = validateRegistration({ email: "    ", password: VALID_PASSWORD });
    expect(result).toEqual({ success: false, fieldErrors: { email: VALIDATION_MESSAGES.emailRequired } });
  });

  it("CP-02/CP-03: informa ambos campos vacíos a la vez", () => {
    const result = validateRegistration({ email: null, password: null });
    expect(result).toEqual({
      success: false,
      fieldErrors: {
        email: VALIDATION_MESSAGES.emailRequired,
        password: VALIDATION_MESSAGES.passwordRequired,
      },
    });
  });

  it("no recorta la contraseña (los espacios forman parte de ella)", () => {
    const result = validateRegistration({ email: "ana@correo.com", password: ` ${VALID_PASSWORD} ` });
    expect(result.success && result.data.password).toBe(` ${VALID_PASSWORD} `);
  });
});
