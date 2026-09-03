import { SignOutButton } from "@/components/auth/sign-out-button";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-lg items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">ReservaPrimero</span>
        <SignOutButton />
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
