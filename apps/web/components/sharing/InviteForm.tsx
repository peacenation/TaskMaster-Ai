"use client";

import { useActionState, useState } from "react";
import { inviteToProject, type InviteState } from "@/app/actions/sharing";
import { Button, Field, Input } from "@/components/ui";

export function InviteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    inviteToProject.bind(null, projectId),
    {}
  );
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="auth-form">
      <Field label="Invite by email" htmlFor="invite-email">
        <Input id="invite-email" name="email" type="email" autoComplete="off" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Invite"}
      </Button>
      {state.message && (
        <p className={state.ok ? "notice" : "notice notice-danger"} role="status">
          {state.message}
        </p>
      )}
      {state.link && (
        <div className="button-row">
          <Input aria-label="Invitation link" readOnly value={state.link} />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
    </form>
  );
}
