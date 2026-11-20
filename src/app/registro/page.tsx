import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/layout/auth-shell";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Regístrate en OfertaYap con tu correo para guardar y comparar ofertas.",
};

export default function RegistroPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      description="Regístrate con tu correo para recibir alertas y comparar precios entre supermercados, farmacias y tiendas."
    >
      <RegisterForm />
    </AuthShell>
  );
}
