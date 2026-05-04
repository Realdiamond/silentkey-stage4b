import { APP_NAME } from "@/lib/config";

interface SecureBadgeProps {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function SecureBadge({
  label = "End-to-End Encrypted",
  size = "md",
  className = "",
}: SecureBadgeProps) {
  const sizeStyles =
    size === "sm"
      ? "px-2.5 py-1 text-xs gap-1.5"
      : "px-3.5 py-1.5 text-sm gap-2";

  return (
    <div
      className={[
        "inline-flex items-center rounded-full",
        "bg-primary/10 border border-primary/25 text-primary font-semibold tracking-wide",
        sizeStyles,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={`${APP_NAME}: ${label}`}
    >
      {/* Shield icon */}
      <svg
        className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 2L4 6v6c0 5.25 3.6 10.15 8 11.5C16.4 22.15 20 17.25 20 12V6l-8-4z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </div>
  );
}
