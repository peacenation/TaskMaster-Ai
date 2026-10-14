import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  // ?step=update: arrived from the recovery email (/auth/confirm signed in).
  const { step, error } = await searchParams;
  const update = step === "update";
  return (
    <AuthShell
      title="Reset your password"
      subtitle={update ? "Choose a new password." : "We'll email you a link to set a new one."}
    >
      {error && (
        <p className="notice notice-danger">
          This link is invalid or expired. Request a new one.
        </p>
      )}
      <AuthForm mode="reset" update={update} />
    </AuthShell>
  );
}
