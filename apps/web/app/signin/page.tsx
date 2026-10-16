import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { googleConfigured } from "@/lib/auth/providers";
import { safeNext } from "@/lib/auth/redirect";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Pick up your plan where you left it."
      footer={
        <>
          New to TaskMasterAi? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <AuthForm
        mode="signin"

        googleEnabled={await googleConfigured()}
        oauthError={error}
        next={safeNext(next)}
      />
    </AuthShell>
  );
}
