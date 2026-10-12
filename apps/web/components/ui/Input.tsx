import { InputHTMLAttributes, forwardRef } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => {
    const classes = ["input", className].filter(Boolean).join(" ");
    return <input ref={ref} className={classes} {...rest} />;
  }
);
Input.displayName = "Input";
