"use client";

import { cn } from "@/lib/utils";
import { User, CreditCard, Ticket, Check } from "lucide-react";

interface CheckoutProgressBarProps {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
}

const STEP_ICONS = [User, CreditCard, Ticket] as const;

export function CheckoutProgressBar({
  currentStep,
  labels,
}: CheckoutProgressBarProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-[10%] right-[10%] h-[2px] bg-gray-200" />
        {/* Active connector line */}
        <div
          className="absolute top-5 left-[10%] h-[2px] bg-gradient-to-r from-[#F5C842] to-[#F5C842] transition-all duration-700 ease-out"
          style={{
            width:
              currentStep === 1
                ? "0%"
                : currentStep === 2
                ? "40%"
                : "80%",
          }}
        />

        {[1, 2, 3].map((step) => {
          const Icon = STEP_ICONS[step - 1];
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isUpcoming = step > currentStep;

          return (
            <div
              key={step}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              {/* Circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm",
                  isCompleted &&
                    "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-emerald-200/50 shadow-md scale-100",
                  isActive &&
                    "bg-gradient-to-br from-[#F5C842] to-[#E5B832] text-[#1A1A2E] shadow-[#F5C842]/30 shadow-lg scale-110 ring-4 ring-[#F5C842]/20",
                  isUpcoming &&
                    "bg-white border-2 border-gray-200 text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4.5 w-4.5" strokeWidth={3} />
                ) : (
                  <Icon className="h-4.5 w-4.5" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs font-semibold transition-colors duration-300 whitespace-nowrap",
                  isCompleted && "text-emerald-600",
                  isActive && "text-[#1A1A2E]",
                  isUpcoming && "text-gray-400"
                )}
              >
                {labels[step - 1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
