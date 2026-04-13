import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "sale" | "new" | "soldout" | "combo" | "default";
}

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide",
        variant === "sale" && "bg-red-500 text-white",
        variant === "new" && "bg-emerald-500 text-white",
        variant === "soldout" && "bg-gray-400 text-white",
        variant === "combo" && "bg-[#1A1A2E] text-[#F5C842]",
        variant === "default" && "bg-gray-100 text-gray-700",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-2xl shadow-sm border border-gray-100",
        hover &&
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded-xl",
        className
      )}
      style={{
        animation: "shimmer 1.5s infinite linear",
      }}
    />
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-semibold text-gray-700"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            "w-full px-4 py-2.5 rounded-xl border text-gray-900 text-base",
            "placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-all duration-200",
            error
              ? "border-red-400 focus:ring-red-300 bg-red-50"
              : "border-gray-200 focus:ring-[#F5C842]/60 focus:border-[#F5C842] bg-white",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
