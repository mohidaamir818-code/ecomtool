"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    {
      label,
      error,
      hint,
      id,
      className = "",
      options,
      placeholder = "Select an option",
      ...props
    },
    ref,
  ) {
    const fieldId = id ?? props.name;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="block text-sm font-semibold text-[#374151]"
        >
          {label}
        </label>
        <select
          ref={ref}
          id={fieldId}
          className={`w-full appearance-none rounded-xl border bg-white px-4 py-3 text-[15px] text-[#111827] shadow-sm outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-gray-200 hover:border-gray-300"
          } ${className}`}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p className="text-xs text-[#9CA3AF]">{hint}</p>
        )}
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>
    );
  },
);

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  hint?: string;
}

export function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-[#374151]">{label}</label>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-xs font-bold text-brand">
          AE
        </span>
        <div>
          <p className="text-[15px] font-medium text-[#111827]">{value}</p>
          {hint && <p className="text-xs text-[#9CA3AF]">{hint}</p>}
        </div>
        <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          Default
        </span>
      </div>
    </div>
  );
}
