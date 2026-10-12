import { AuthForm } from "@/components/auth/AuthForm";
import { emailConfigured } from "@/lib/auth/email";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="wrap auth-wrap">
      <header className="hero">
        <p className="eyebrow">TaskMaster</p>
        <h1>Sign in by email</h1>
      </header>
      <AuthForm mode="magic" emailReady={emailConfigured()} />
    </div>
  );
}
