import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not Found",
  robots: { index: false, follow: false },
};

export default function AdminAuthGatewayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
