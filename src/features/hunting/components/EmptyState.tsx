interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-light text-brand">
        {icon}
      </div>
      <h3 className="text-base font-bold text-[#111827]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#6B7280]">{description}</p>
    </div>
  );
}
