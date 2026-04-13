import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "yellow" | "blue" | "emerald" | "purple";
  trend?: { value: number; label: string };
}

const COLOR_MAP = {
  yellow: "bg-[#F5C842]/10 text-[#F5C842]",
  blue: "bg-blue-50 text-blue-500",
  emerald: "bg-emerald-50 text-emerald-500",
  purple: "bg-purple-50 text-purple-500",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "yellow",
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-extrabold text-[#1A1A2E] mt-1">{value}</p>
          {trend && (
            <p className="text-xs text-gray-400 mt-1">
              <span
                className={`font-semibold ${trend.value >= 0 ? "text-emerald-500" : "text-red-400"}`}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%
              </span>{" "}
              {trend.label}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${COLOR_MAP[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
