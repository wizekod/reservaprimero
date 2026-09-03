import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        ReservaPrimero
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
