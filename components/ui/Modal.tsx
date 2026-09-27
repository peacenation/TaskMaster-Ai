"use client";

import { ReactNode, useEffect, useRef } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Baseline keyboard/a11y: Escape closes, backdrop click closes, focus
 * moves into the dialog on open. Not a full focus trap — Tab can still
 * reach the page behind the overlay. Phase 11 (hardening) is where the
 * full a11y pass happens; tracked there rather than gold-plated here.
 */
export function Modal({ open, onClose, title, description, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <p className="modal-title" id="modal-title">
          {title}
        </p>
        {description && <p className="modal-description">{description}</p>}
        {children}
      </div>
    </div>
  );
}
