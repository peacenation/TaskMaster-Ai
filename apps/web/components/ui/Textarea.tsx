import { TextareaHTMLAttributes, forwardRef } from "react";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => {
    const classes = ["textarea", className].filter(Boolean).join(" ");
    return <textarea ref={ref} className={classes} {...rest} />;
  }
);
Textarea.displayName = "Textarea";
