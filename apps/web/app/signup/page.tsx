import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { emailConfigured } from "@/lib/auth/email";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="wrap auth-wrap">
      <header className="hero">
        <p className="eyebrow">TaskMaster</p>
        <h1>Make room for what matters</h1>
      </header>
      <AuthForm mode="signup" emailReady={emailConfigured()} />
      <p className="field-hint">
        <Link href="/privacy">How TaskMaster handles your data</Link>, including AI organising.
      </p>
    </div>
  );
}
