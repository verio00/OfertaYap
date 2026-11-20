/**
 * Pruebas del componente RegisterForm con la Server Action SIMULADA (mock).
 * Verifican la interfaz, la accesibilidad y el bloqueo de envíos inválidos.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegisterState } from "@/lib/auth/register-messages";
import { REGISTER_MESSAGES } from "@/lib/auth/register-messages";
import { VALIDATION_MESSAGES } from "@/lib/validation/auth";

const registerAction = vi.fn<(prev: RegisterState, formData: FormData) => Promise<RegisterState>>();

vi.mock("@/app/registro/actions", () => ({
  registerAction: (prev: RegisterState, formData: FormData) => registerAction(prev, formData),
}));

const { RegisterForm } = await import("@/components/auth/register-form");

const EMAIL = "ana@correo.pe";
const PASSWORD = "Segura123";

function setup() {
  const user = userEvent.setup();
  render(<RegisterForm />);
  return {
    user,
    email: screen.getByLabelText("Correo electrónico") as HTMLInputElement,
    password: screen.getByLabelText("Contraseña") as HTMLInputElement,
    submit: screen.getByRole("button", { name: "Registrarse" }),
  };
}

beforeEach(() => {
  registerAction.mockReset();
});

describe("RegisterForm – estructura y accesibilidad", () => {
  it("muestra los campos con etiquetas, el botón y el enlace a /login", () => {
    const { email, password } = setup();

    expect(email.type).toBe("email");
    expect(email.autocomplete).toBe("email");
    expect(password.type).toBe("password");
    expect(password.autocomplete).toBe("new-password");
    expect(screen.getByRole("link", { name: "Inicia sesión" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByLabelText(/rol/i)).toBeNull(); // RN-06: no hay selección de rol
  });

  it("permite mostrar y ocultar la contraseña", async () => {
    const { user, password } = setup();

    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password.type).toBe("text");
    const toggle = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(toggle.textContent).toBe("Ocultar");

    await user.click(toggle);
    expect(password.type).toBe("password");
  });

  it("se puede recorrer con el teclado en orden lógico", async () => {
    const { user, email, password, submit } = setup();

    await user.tab();
    expect(document.activeElement).toBe(email);
    await user.tab();
    expect(document.activeElement).toBe(password);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mostrar contraseña" }));
    await user.tab();
    expect(document.activeElement).toBe(submit);
  });
});

describe("RegisterForm – validación en el cliente (sin solicitudes)", () => {
  it("CP-02/CP-03: con campos vacíos muestra errores y no envía la solicitud", async () => {
    const { user, email, password, submit } = setup();

    await user.click(submit);

    expect(screen.getByText(VALIDATION_MESSAGES.emailRequired)).toBeTruthy();
    expect(screen.getByText(VALIDATION_MESSAGES.passwordRequired)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(REGISTER_MESSAGES.invalidFields);
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(email);
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("CP-02: un correo con solo espacios no es válido", async () => {
    const { user, email, password, submit } = setup();

    await user.type(email, "    ");
    await user.type(password, PASSWORD);
    await user.click(submit);

    expect(screen.getByText(VALIDATION_MESSAGES.emailRequired)).toBeTruthy();
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("CP-04: un correo inválido muestra el error asociado al campo", async () => {
    const { user, email, password, submit } = setup();

    await user.type(email, "ana@correo");
    await user.type(password, PASSWORD);
    await user.click(submit);

    const error = screen.getByText(VALIDATION_MESSAGES.emailInvalid);
    expect(email.getAttribute("aria-describedby")).toBe(error.id);
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("el error del campo desaparece al corregirlo", async () => {
    const { user, email, submit } = setup();

    await user.click(submit);
    await user.type(email, "a");

    expect(screen.queryByText(VALIDATION_MESSAGES.emailRequired)).toBeNull();
  });
});

describe("RegisterForm – envío al servidor", () => {
  it("CP-01: envía solo correo y contraseña, bloquea el doble envío y muestra la confirmación", async () => {
    let resolver: (state: RegisterState) => void = () => {};
    registerAction.mockImplementation(() => new Promise((resolve) => (resolver = resolve)));
    const { user, email, password, submit } = setup();

    await user.type(email, EMAIL);
    await user.type(password, PASSWORD);
    await user.click(submit);

    const pendingButton = await screen.findByRole("button", { name: /Registrando/ });
    expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(pendingButton);
    expect(registerAction).toHaveBeenCalledTimes(1);

    const formData = registerAction.mock.calls[0][1];
    expect([...formData.keys()].sort()).toEqual(["email", "password"]);

    resolver({ status: "success", message: REGISTER_MESSAGES.checkEmail, fieldErrors: {} });

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(REGISTER_MESSAGES.checkEmail);
    expect(document.activeElement).toBe(status);
    expect(screen.queryByLabelText("Contraseña")).toBeNull();
    expect(document.body.textContent).not.toContain(PASSWORD);
  });

  it("muestra los errores devueltos por el servidor en el campo correspondiente", async () => {
    registerAction.mockResolvedValue({
      status: "error",
      message: REGISTER_MESSAGES.invalidFields,
      fieldErrors: { password: REGISTER_MESSAGES.weakPassword },
    });
    const { user, email, password, submit } = setup();

    await user.type(email, EMAIL);
    await user.type(password, PASSWORD);
    await user.click(submit);

    expect(await screen.findByText(REGISTER_MESSAGES.weakPassword)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(password));
    expect(password.getAttribute("aria-invalid")).toBe("true");
  });

  it("muestra errores generales del servidor en una alerta", async () => {
    registerAction.mockResolvedValue({ status: "error", message: REGISTER_MESSAGES.rateLimited, fieldErrors: {} });
    const { user, email, password, submit } = setup();

    await user.type(email, EMAIL);
    await user.type(password, PASSWORD);
    await user.click(submit);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(REGISTER_MESSAGES.rateLimited));
  });
});
