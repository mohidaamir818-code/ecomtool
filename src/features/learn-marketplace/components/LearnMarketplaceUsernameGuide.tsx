"use client";

export const USERNAME_GUIDE_KEY = "learn_marketplace_username_guide_ack";
export const USERNAME_CURSOR_KEY_PREFIX = "learn_marketplace_username_cursor_";
export const PRACTICE_USERNAME_KEY = "learn_marketplace_practice_username";

export function LearnMarketplaceUsernameGuide({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-guide-title"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3665f3]">
            Step 4 · Choose your username
          </p>
          <h2 id="username-guide-title" className="mt-3 text-2xl font-bold tracking-tight text-[#191919]">
            Write your username
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#555]">
            Pick a username that represents your business or brand. This is how buyers will see you on
            the marketplace.
          </p>
        </div>

        <div className="space-y-3 px-8 py-6 text-left">
          {[
            "Use letters and numbers only — no spaces or special characters.",
            "Keep it professional and easy to remember, for example your company or brand name.",
            "Your username must be at least 6 characters long.",
          ].map((text, index) => (
            <div
              key={text}
              className="flex gap-3 rounded-xl border border-gray-100 bg-[#f7f7f7] p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-xs font-bold text-white">
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-[#555]">{text}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-8 py-6">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(USERNAME_GUIDE_KEY, "true");
              onDismiss();
            }}
            className="w-full rounded-full bg-[#3665f3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2f56cc]"
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
