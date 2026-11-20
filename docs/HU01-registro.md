# HU01 – Registrar cuenta con correo (OFY-10)

Sprint 1 · Base segura y catálogo inicial · 3 SP · Must Have

## 1. Arquitectura

```
/registro (página estática)
 └─ RegisterForm (cliente) ── valida → useActionState ──► registerAction (Server Action)
                                                            ├─ revalida (mismo validador)
                                                            ├─ ignora cualquier campo que no sea email/password
                                                            └─ supabase.auth.signUp ──► auth.users (hash bcrypt)
                                                                                         └─ trigger → public.profiles (role = 'comprador')
Correo "Confirm signup" (plantilla PREDETERMINADA de Supabase)
  └─► https://<proyecto>.supabase.co/auth/v1/verify?token=pkce_…&type=signup&redirect_to=http://localhost:3000/auth/confirm
        Supabase verifica el token y marca el correo como confirmado
  └─► /auth/confirm?code=<código>      (o ?error=…&error_code=otp_expired si el enlace venció / ya se usó)
        exchangeCodeForSession(code) usando la cookie code_verifier creada durante el registro
  └─► /auth/confirmacion?estado=exito | otro-navegador | vencido | invalido | error
```

### Flujo de confirmación (PKCE)

1. En el registro, `@supabase/ssr` genera un par PKCE: envía el `code_challenge` (S256) a Supabase y guarda el
   `code_verifier` en una cookie del navegador (`sb-<ref>-auth-token-code-verifier`).
2. El enlace del correo apunta al endpoint `/verify` de Supabase, que valida el token, **confirma el correo** y
   redirige a `emailRedirectTo` (`/auth/confirm`) con `?code=`.
3. `/auth/confirm` canjea el código con `exchangeCodeForSession`; Supabase solo lo acepta si el `code_verifier`
   corresponde al `code_challenge` original → se crea la sesión (cookies) en ese navegador.
4. Si el enlace se abre en **otro navegador/dispositivo** no existe la cookie del verifier: el correo ya quedó
   confirmado en el paso 2, pero no se crea sesión → estado `otro-navegador` («inicia sesión con tu correo y contraseña»).
5. Si Supabase rechaza el enlace (vencido o ya usado) redirige con `error_code` en la query y/o en el fragmento `#`;
   la ruta lee la query y la página `/auth/confirmacion` lee el fragmento (que no llega al servidor).
6. `/auth/confirm` también acepta `?token_hash=&type=email` (`verifyOtp`) para cuando se configure SMTP propio y
   una plantilla personalizada; no es necesario hoy.

| Capa | Archivo |
|---|---|
| Página | `src/app/registro/page.tsx` |
| Formulario | `src/components/auth/register-form.tsx` |
| Server Action | `src/app/registro/actions.ts` |
| Validación compartida | `src/lib/validation/auth.ts` |
| Mensajes y mapeo de errores | `src/lib/auth/register-messages.ts` |
| Cliente Supabase (servidor) | `src/lib/supabase/server.ts`, `src/lib/env.ts` |
| Confirmación de correo | `src/app/auth/confirm/route.ts`, `src/app/auth/confirmacion/page.tsx` |
| Base de datos | `supabase/migrations/20261120000000_hu01_profiles_roles.sql` |

**Fuente de autorización:** `public.profiles.role` (enum `app_role`). Nunca `user_metadata`, que el usuario puede editar.

## 2. Configuración de Supabase (manual, proyecto de DESARROLLO)

1. Crear un proyecto Supabase de desarrollo (no usar producción para pruebas).
2. **Variables**: copiar `.env.example` a `.env.local` y completar:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → Project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys → Publishable key (o la clave `anon` legacy).
   - `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000`.
   - **No** se necesita la clave `service_role`/secret.
3. **Authentication → Sign In / Providers → Email**:
   - Email provider: habilitado.
   - **Confirm email: ACTIVADO** (obligatorio; protege contra enumeración de cuentas).
4. **Authentication → Policies (Password)**: longitud mínima **8**; requisitos: *Lowercase, uppercase letters and digits*.
   (Debe coincidir con `PASSWORD_MIN_LENGTH` y la regla de complejidad de `src/lib/validation/auth.ts`.)
5. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: añadir `http://localhost:3000/auth/confirm`
6. **Authentication → Email Templates → Confirm signup**: **dejar la plantilla predeterminada** (no requiere cambios;
   en el plan gratuito sin SMTP propio no se puede editar). Usa `{{ .ConfirmationURL }}`, compatible con `/auth/confirm`.
7. **SQL Editor**: revisar y ejecutar `supabase/migrations/20261120000000_hu01_profiles_roles.sql`.
8. **Correo sin SMTP propio** (decisión actual): el servicio integrado de Supabase tiene un límite muy bajo de envíos
   por hora y solo entrega correos a los miembros del equipo de la organización Supabase (otros correos devuelven
   `email_address_not_authorized`, que la app muestra como «No pudimos enviar el correo de verificación…»).
   Para las pruebas, registra correos de miembros del equipo (Organization → Team). **No desactives la confirmación.**

## 3. Comandos

| Comando | Qué hace | Requiere Supabase |
|---|---|---|
| `npm run dev` | Servidor de desarrollo | Sí, para registrar |
| `npm run lint` | ESLint | No |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` | No |
| `npm test` | Pruebas unitarias y de componentes **con mocks** | No |
| `npm run test:integration` | Pruebas **reales** (RLS y registro) | Sí (`.env.local`) |
| `npm run build` | Build de producción | No |

### Pruebas con mocks vs. reales

- `src/**/__tests__/*.test.ts(x)`: Supabase y `redirect` **simulados**. Verifican la lógica de la app, no el servicio.
- `tests/integration/hu01-registro.supabase.test.ts`: llamadas **reales** al proyecto de desarrollo.
  - Sin `.env.local` → se omiten (skipped).
  - RLS (anon no lee perfiles ni inserta administradores): solo requiere URL y clave publishable.
  - Registro real (CP-01/CP-05/CP-07): además requiere `INTEGRATION_TEST_EMAIL` (buzón propio; envía correos).
- `supabase/tests/hu01_verificacion_roles.sql`: verificación de CP-06 en el SQL Editor (no destructiva).

## 4. Prueba manual desde el navegador

1. `npm run dev` y abrir `http://localhost:3000` → botón **Crear cuenta**.
2. **CP-02/CP-03**: pulsar *Registrarse* con los campos vacíos → mensajes bajo cada campo; en DevTools → Network no aparece ninguna solicitud.
3. **CP-04**: correo `ana@correo` → «Ingresa un correo electrónico válido…».
4. Contraseña `abc` → mensaje de política. Probar *Mostrar/Ocultar*.
5. **CP-01**: correo de un miembro del equipo Supabase + `Segura2026` → botón «Registrando…» deshabilitado → mensaje «Si el correo puede registrarse, te enviamos un enlace…».
   En DevTools → Application → Cookies debe aparecer `sb-<ref>-auth-token-code-verifier`.
6. Supabase → Authentication → Users: el usuario aparece como *Waiting for verification*.
7. Abrir el correo **en el mismo navegador** → el enlace pasa por `…supabase.co/auth/v1/verify` → `/auth/confirm?code=…`
   → `/auth/confirmacion` muestra «¡Correo confirmado!». En Users, `Confirmed at` tiene fecha; aparece la cookie `sb-<ref>-auth-token`.
8. Volver a abrir el mismo enlace → «El enlace venció» (token ya usado).
9. (Opcional) Registrar otro correo y abrir el enlace en otro navegador o en una ventana privada → «Correo verificado»
   sin sesión; en Users el usuario figura como confirmado.
10. **CP-05**: registrar de nuevo el mismo correo → el **mismo** mensaje neutral; en Users sigue habiendo un solo usuario.
11. **CP-06**: ejecutar `supabase/tests/hu01_verificacion_roles.sql` → `role = comprador` y NOTICE `OK CP-06`.
12. **CP-07**: DevTools → Network → solicitud POST de `/registro` → la respuesta no contiene la contraseña; la terminal de `npm run dev` solo muestra códigos de error, nunca contraseña ni correo.
13. Navegación con teclado: Tab recorre correo → contraseña → Mostrar → Registrarse → Inicia sesión.

## 5. Limitaciones conocidas

- La neutralidad ante correos existentes (CA-04) depende de tener **Confirm email activado**. Si se desactivara,
  un correo nuevo vería «Tu cuenta fue creada» y uno existente el mensaje neutral.
- Un correo existente **no confirmado** provoca que Supabase reenvíe el correo de confirmación (comportamiento de Supabase).
- Tras confirmar el correo, Supabase crea una sesión (cookies). Su refresco mediante `proxy.ts` y el inicio de sesión son de HU02.
- Con la plantilla predeterminada (PKCE), la sesión solo se crea si el enlace se abre en el mismo navegador del registro. En otro navegador el correo igualmente queda confirmado, pero no se inicia sesión.
- La cookie de un flujo PKCE ya canjeado puede permanecer (comportamiento de auth-js sin `sb_flow_id`); es inservible porque el código es de un solo uso.
- Si el usuario se registra varias veces en el mismo navegador, solo el enlace del registro más reciente puede crear sesión. Abrir un enlace anterior confirma el correo sin sesión (`bad_code_verifier` → estado `otro-navegador`) y consume la cookie del verifier, por lo que el enlace más reciente también terminará sin sesión.
- No hay CAPTCHA; se confía en los límites de Supabase Auth. Recomendado para producción (Authentication → Attack Protection).
- La protección contra contraseñas filtradas (HaveIBeenPwned) solo existe en planes de pago de Supabase.
