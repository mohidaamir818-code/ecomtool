import { AdminSupportPanel } from "@/features/admin/components/AdminSupportPanel";

export default function InternalAdminSupportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h1 className="text-2xl font-bold text-white">Help Center</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Read user messages, view their photos and videos, and reply with attachments.
        </p>
      </div>

      <AdminSupportPanel />
    </div>
  );
}
