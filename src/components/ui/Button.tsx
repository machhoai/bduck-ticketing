import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          // Base
          "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 select-none",
          // Size
          size === "sm" && "px-4 py-1.5 text-sm",
          size === "md" && "px-6 py-2.5 text-base",
          size === "lg" && "px-8 py-3.5 text-lg",
          // Variant
          variant === "primary" &&
            "bg-[#F5C842] text-[#1A1A2E] hover:bg-[#f0bc2a] active:scale-95 focus-visible:ring-[#F5C842] shadow-md hover:shadow-lg",
          variant === "secondary" &&
            "bg-[#1A1A2E] text-white hover:bg-[#252545] active:scale-95 focus-visible:ring-[#1A1A2E]",
          variant === "ghost" &&
            "bg-transparent text-[#1A1A2E] hover:bg-black/5 active:scale-95 focus-visible:ring-[#1A1A2E]",
          variant === "danger" &&
            "bg-red-500 text-white hover:bg-red-600 active:scale-95 focus-visible:ring-red-500",
          // Disabled
          (disabled || loading) && "opacity-50 cursor-not-allowed active:scale-100",
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
