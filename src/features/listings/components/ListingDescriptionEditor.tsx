"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface ListingDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

type DescriptionTab = "preview" | "editor";

const QUILL_MODULES = {
  toolbar: [
    ["bold", "italic"],
    [{ header: 2 }],
    [{ list: "bullet" }],
    [{ list: "ordered" }],
  ],
};

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

const quillEditorClassName = [
  "listing-description-quill rounded-lg border border-[#E5E5E5] bg-white overflow-hidden",
  "[&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-[#E5E5E5] [&_.ql-toolbar]:bg-[#F7F7F7]",
  "[&_.ql-container]:border-0 [&_.ql-container]:min-h-[240px] [&_.ql-editor]:min-h-[240px]",
  "[&_.ql-editor]:text-[15px] [&_.ql-editor]:leading-relaxed [&_.ql-editor]:text-[#191919]",
  "[&_.ql-editor_h2]:text-xl [&_.ql-editor_h2]:font-bold",
].join(" ");

export function ListingDescriptionEditor({ value, onChange }: ListingDescriptionEditorProps) {
  const [tab, setTab] = useState<DescriptionTab>("preview");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      ) : mounted ? (
        <div className={quillEditorClassName}>
          <ReactQuill
            value={value}
            onChange={onChange}
            modules={QUILL_MODULES}
            theme="snow"
            placeholder="Write your listing description..."
          />
        </div>
      ) : (
        <div className={`${previewClassName} text-[#707070]`}>Loading editor...</div>
      )}
    </div>
  );
}
