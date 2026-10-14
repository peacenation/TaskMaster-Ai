import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <AuthShell title="Sign in by email" subtitle="We'll send you a one-time sign-in link.">
      <AuthForm mode="magic" />
    </AuthShell>
  );
}
