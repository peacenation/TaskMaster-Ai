import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className, ...rest }, ref) => {
    const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
    return <button ref={ref} className={classes} {...rest} />;
  }
);
Button.displayName = "Button";
