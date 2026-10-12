import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">No pudimos validar el enlace</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        El enlace es inválido o ya expiró. Intenta iniciar sesión o solicita uno
        nuevo.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="text-sm font-medium underline underline-offset-4">
          Ir a iniciar sesión
        </Link>
        <Link href="/recuperar" className="text-sm font-medium underline underline-offset-4">
          Pedir un enlace nuevo
        </Link>
      </div>
    </div>
  );
}
