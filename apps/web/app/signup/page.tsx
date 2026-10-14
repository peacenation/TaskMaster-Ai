import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { googleConfigured } from "@/lib/auth/providers";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell
      title="Make room for what matters"
      subtitle="Create your account and start with a Brain Dump."
      footer={
        <>
          <Link href="/privacy">How TaskMaster handles your data</Link>, including AI
          organising.
        </>
      }
    >
      <AuthForm
        mode="signup"

        googleEnabled={await googleConfigured()}
        oauthError={error}
      />
    </AuthShell>
  );
}
