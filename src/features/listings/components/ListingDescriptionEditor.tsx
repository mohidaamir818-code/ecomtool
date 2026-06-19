"use client";

interface ListingDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

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

export function ListingDescriptionEditor({ value, onChange }: ListingDescriptionEditorProps) {
  return (
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

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm text-[#374151] outline-none focus:border-brand"
        placeholder="HTML description..."
      />

      <div
        className="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-gray-50 p-4 text-[#374151]"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
