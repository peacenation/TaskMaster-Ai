import { AuthForm } from "@/components/auth/AuthForm";
import { emailConfigured } from "@/lib/auth/email";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <div className="wrap auth-wrap">
      <header className="hero">
        <p className="eyebrow">Account</p>
        <h1>Reset your password</h1>
      </header>
      {error && (
        <p className="notice notice-danger">
          This link is invalid or expired. Request a new one.
        </p>
      )}
      <AuthForm mode="reset" token={token} emailReady={emailConfigured()} />
    </div>
  );
}
