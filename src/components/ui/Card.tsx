import { HTMLAttributes, forwardRef } from "react";

type CardVariant = "default" | "elevated" | "bordered" | "ghost";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantStyles: Record<CardVariant, string> = {
  default:  "bg-surface border border-border",
  elevated: "bg-surface-elevated border border-border shadow-xl shadow-black/40",
  bordered: "bg-transparent border border-border hover:border-primary/40 transition-colors",
  ghost:    "bg-transparent",
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm:   "p-4",
  md:   "p-6",
  lg:   "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          "rounded-2xl",
          variantStyles[variant],
          paddingStyles[padding],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
