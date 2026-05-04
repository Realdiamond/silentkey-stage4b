import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  accentColor?: "primary" | "secondary";
  className?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  accentColor = "primary",
  className = "",
}: FeatureCardProps) {
  const accent =
    accentColor === "secondary"
      ? {
          icon: "text-secondary bg-secondary/10 border-secondary/20",
          hover: "hover:border-secondary/40",
        }
      : {
          icon: "text-primary bg-primary/10 border-primary/20",
          hover: "hover:border-primary/40",
        };

  return (
    <div
      className={[
        "group relative flex flex-col gap-4 p-6 rounded-2xl",
        "bg-surface border border-border",
        "transition-all duration-300",
        "hover:bg-surface-elevated hover:shadow-xl hover:shadow-black/30",
        accent.hover,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Icon badge */}
      <div
        className={[
          "inline-flex w-12 h-12 items-center justify-center rounded-xl border",
          "transition-transform duration-300 group-hover:scale-110",
          accent.icon,
        ].join(" ")}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <p className="text-sm leading-relaxed text-text-muted">{description}</p>
      </div>
    </div>
  );
}
