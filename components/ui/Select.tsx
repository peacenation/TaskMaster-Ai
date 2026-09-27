import { SelectHTMLAttributes, forwardRef } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...rest }, ref) => {
    const classes = ["select", className].filter(Boolean).join(" ");
    return (
      <select ref={ref} className={classes} {...rest}>
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
