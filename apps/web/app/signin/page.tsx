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
      />
    </AuthShell>
  );
}
