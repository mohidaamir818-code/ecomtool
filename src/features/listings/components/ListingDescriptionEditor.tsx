"use client";

import { useState } from "react";

interface ListingDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

type DescriptionTab = "preview" | "editor";

function wrapSelection(before: string, after: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  if (!selectedText) return;

  const wrapped = document.createElement("span");
  wrapped.innerHTML = `${before}${selectedText}${after}`;
  range.deleteContents();
  range.insertNode(wrapped);
}

const previewClassName = [
  "min-h-[280px] rounded-lg border border-[#E5E5E5] bg-white p-5",
  "text-[15px] leading-relaxed text-[#191919]",
  "[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-snug [&_h2]:text-[#191919]",
  "[&_h2:first-child]:mt-0",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_strong]:font-bold [&_strong]:text-[#191919]",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2",
  "[&_li]:mb-1 [&_li]:leading-relaxed",
  "[&_em]:italic",
].join(" ");

export function ListingDescriptionEditor({ value, onChange }: ListingDescriptionEditorProps) {
  const [tab, setTab] = useState<DescriptionTab>("preview");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-1">
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            tab === "preview"
              ? "bg-white text-[#3665F3] shadow-sm"
              : "text-[#707070] hover:text-[#191919]"
          }`}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => setTab("editor")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            tab === "editor"
              ? "bg-white text-[#3665F3] shadow-sm"
              : "text-[#707070] hover:text-[#191919]"
          }`}
        >
          Editor
        </button>
      </div>

      {tab === "preview" ? (
        <div>
          {value.trim() ? (
            <div className={previewClassName} dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <div className={`${previewClassName} text-[#707070]`}>
              No description yet. Switch to Editor to add content.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Bold", action: () => wrapSelection("<strong>", "</strong>") },
              { label: "Italic", action: () => wrapSelection("<em>", "</em>") },
              { label: "Heading", action: () => wrapSelection("<h2>", "</h2>") },
              { label: "List", action: () => wrapSelection("<ul><li>", "</li></ul>") },
            ].map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={tool.action}
                className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-[#374151] hover:bg-gray-50"
              >
                {tool.label}
              </button>
            ))}
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-[#707070]">
            HTML Editor
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm text-[#374151] outline-none focus:border-brand"
              placeholder="HTML description..."
            />
          </label>
        </div>
      )}
    </div>
  );
}
