"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { registerAction } from "@/app/registro/actions";
import { initialRegisterState, REGISTER_MESSAGES } from "@/lib/auth/register-messages";
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_HINT,
  validateRegistration,
  type FieldErrors,
  type RegistrationField,
} from "@/lib/validation/auth";

const inputBase =
  "block w-full rounded-xl border bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50";
const inputOk = "border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/20";
const inputError = "border-red-500 focus:border-red-600 focus:ring-red-600/20";

/**
 * Formulario de registro con correo y contraseña (HU01 / OFY-10).
 * Valida en el cliente para dar respuesta inmediata; la Server Action
 * `registerAction` vuelve a validar y es la que se comunica con Supabase Auth.
 */
export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialRegisterState);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [hideServerErrors, setHideServerErrors] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const ids = {
    email: useId(),
    emailError: useId(),
    password: useId(),
    passwordHint: useId(),
    passwordError: useId(),
    formMessage: useId(),
  };

  const errorFor = (field: RegistrationField): string | undefined =>
    clientErrors[field] ?? (hideServerErrors ? undefined : state.fieldErrors[field]);
  const emailError = errorFor("email");
  const passwordError = errorFor("password");

  const formMessage =
    Object.keys(clientErrors).length > 0
      ? REGISTER_MESSAGES.invalidFields
      : !hideServerErrors && state.status === "error"
        ? state.message
        : "";

  // Lleva el foco al primer campo con error o al mensaje de éxito tras la respuesta del servidor.
  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
    } else if (state.fieldErrors.email) {
      emailRef.current?.focus();
    } else if (state.fieldErrors.password) {
      passwordRef.current?.focus();
    }
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault(); // evita envíos duplicados
      return;
    }
    const result = validateRegistration({ email, password });
    if (!result.success) {
      // Bloquea el envío: no se hace ninguna solicitud al servidor ni a Supabase (CA-02, CA-03).
      event.preventDefault();
      setClientErrors(result.fieldErrors);
      setHideServerErrors(true);
      (result.fieldErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setClientErrors({});
    setHideServerErrors(false);
  }

  function clearFieldError(field: RegistrationField) {
    setHideServerErrors(true);
    setClientErrors((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 outline-none"
      >
        <div className="flex items-start gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <div>
            <h2 className="font-semibold">¡Solicitud recibida!</h2>
            <p className="mt-1 text-sm leading-6">{state.message}</p>
          </div>
        </div>
        <Link
          href="/login"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isPending}
      aria-describedby={formMessage ? ids.formMessage : undefined}
      className="space-y-5"
    >
      <div role="alert" id={ids.formMessage} className={formMessage ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" : "sr-only"}>
        {formMessage}
      </div>

      <div>
        <label htmlFor={ids.email} className="mb-1.5 block text-sm font-medium text-slate-800">
          Correo electrónico
        </label>
        <input
          ref={emailRef}
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={EMAIL_MAX_LENGTH}
          placeholder="nombre@correo.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearFieldError("email");
          }}
          readOnly={isPending}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? ids.emailError : undefined}
          className={`${inputBase} ${emailError ? inputError : inputOk}`}
        />
        {emailError ? (
          <p id={ids.emailError} className="mt-1.5 text-sm text-red-700">
            {emailError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={ids.password} className="mb-1.5 block text-sm font-medium text-slate-800">
          Contraseña
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id={ids.password}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            readOnly={isPending}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? `${ids.passwordError} ${ids.passwordHint}` : ids.passwordHint}
            className={`${inputBase} pr-28 ${passwordError ? inputError : inputOk}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-controls={ids.password}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {passwordError ? (
          <p id={ids.passwordError} className="mt-1.5 text-sm text-red-700">
            {passwordError}
          </p>
        ) : null}
        <p id={ids.passwordHint} className="mt-1.5 text-xs text-slate-500">
          {PASSWORD_REQUIREMENTS_HINT}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
            Registrando…
          </>
        ) : (
          "Registrarse"
        )}
      </button>

      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
