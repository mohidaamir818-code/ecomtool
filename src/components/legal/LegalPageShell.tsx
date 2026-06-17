import type { ReactNode } from "react";

interface LegalPageShellProps {
  title: string;
  updatedAt: string;
  intro: string;
  children: ReactNode;
}

export function LegalPageShell({ title, updatedAt, intro, children }: LegalPageShellProps) {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-7 sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {updatedAt}</p>
          <p className="mt-4 text-sm leading-7 text-gray-700">{intro}</p>
        </div>
        <div className="space-y-6 px-6 py-7 text-sm leading-7 text-gray-700 sm:px-8">{children}</div>
      </div>
    </section>
  );
}
