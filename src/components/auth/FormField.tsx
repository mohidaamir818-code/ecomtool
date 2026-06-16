"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  function FormField({ label, error, hint, id, className = "", ...props }, ref) {
    const fieldId = id ?? props.name;

    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="block text-sm font-semibold text-[#374151]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={fieldId}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-[#111827] shadow-sm outline-none transition-all placeholder:text-[#9CA3AF] focus:border-brand focus:ring-4 focus:ring-brand/10 ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-gray-200 hover:border-gray-300"
          } ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-[#9CA3AF]">{hint}</p>
        )}
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>
    );
  },
);
