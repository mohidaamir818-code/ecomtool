"use client";

import { useRef, useState } from "react";
import type { ListingPhotoDraft, ListingProductSource, ListingVariantDraft } from "@/types/listing-generator";
import { ebayTextButtonClass } from "@/features/listings/lib/ebay-ui";
import { isRestrictedImageUrl } from "@/lib/listings/listing-sanitize";
import { ProxiedImage } from "./ProxiedImage";

const MAX_PHOTOS = 24;

interface EbayPhotosPanelProps {
  photos: ListingPhotoDraft[];
  product: ListingProductSource;
  variants: ListingVariantDraft[];
  removedCount?: number;
  onChange: (photos: ListingPhotoDraft[]) => void;
  userId?: string;
}

export function EbayPhotosPanel({
  photos,
  product,
  variants,
  removedCount = 0,
  onChange,
  userId,
}: EbayPhotosPanelProps) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const mainPhoto = photos[0];
  const gridPhotos = photos.slice(1);
  const variantPreview = variants.slice(0, 3);

  const unusedAliImages = product.images.filter(
    (url) => url && !photos.some((photo) => photo.url === url),
  );

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function makeMain(index: number) {
    if (index === 0) return;
    reorder(index, 0);
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
    setSelectedIndices((current) => {
      const next = new Set<number>();
      for (const i of current) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }

  function bulkDelete() {
    onChange(photos.filter((_, i) => !selectedIndices.has(i)));
    setSelectedIndices(new Set());
    setSelectMode(false);
  }

  function addPhotoUrls(urls: string[]) {
    const next = [...photosRef.current];
    for (const url of urls) {
      const trimmed = url.trim();
      if (!trimmed || next.length >= MAX_PHOTOS) break;
      if (next.some((photo) => photo.url === trimmed)) continue;
      // Allow local previews and already-hosted uploads; only block supplier-branded remote URLs.
      if (
        !trimmed.startsWith("blob:") &&
        !trimmed.startsWith("data:") &&
        isRestrictedImageUrl(trimmed)
      ) {
        continue;
      }
      next.push({ url: trimmed, selected: true });
    }
    photosRef.current = next;
    onChange(next);
  }

  function addPhoto(url: string) {
    setAddError("");
    if (isRestrictedImageUrl(url.trim())) {
      setAddError("This image contains restricted content and cannot be added.");
      return;
    }
    addPhotoUrls([url]);
    setShowAddModal(false);
  }

  function replacePhotoUrl(fromUrl: string, toUrl: string) {
    const next = photosRef.current.map((photo) =>
      photo.url === fromUrl ? { ...photo, url: toUrl, selected: true } : photo,
    );
    photosRef.current = next;
    onChange(next);
  }

  async function compressForUpload(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

    try {
      const bitmap = await createImageBitmap(file);
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    } catch {
      return file;
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setAddError("Please drop image files (JPG, PNG, or WebP).");
      return;
    }

    if (!userId) {
      setAddError("Sign in required to upload photos.");
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setAddError("You already have 24 photos.");
      return;
    }

    const selected = files.slice(0, remaining);
    const localItems = selected.map((file) => ({
      file,
      blobUrl: URL.createObjectURL(file),
    }));

    // Instant: show photos immediately, then swap to public URLs in background.
    setAddError("");
    addPhotoUrls(localItems.map((item) => item.blobUrl));
    setShowAddModal(false);
    setUploading(true);

    try {
      await Promise.all(
        localItems.map(async (item) => {
          const compressed = await compressForUpload(item.file);
          const form = new FormData();
          form.set("userId", userId);
          form.append("files", compressed);

          const response = await fetch("/api/listings/upload-photos", {
            method: "POST",
            body: form,
          });
          const data = (await response.json()) as { error?: string; urls?: string[] };

          if (!response.ok || !data.urls?.[0]) {
            throw new Error(data.error ?? "Failed to upload photos.");
          }

          replacePhotoUrl(item.blobUrl, data.urls[0]);
          URL.revokeObjectURL(item.blobUrl);
        }),
      );
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Network error while uploading photos.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggleSelectIndex(index: number) {
    setSelectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex == null) return;
    reorder(dragIndex, targetIndex);
    setDragIndex(null);
  }

  function renderTile(photo: ListingPhotoDraft, index: number, sizeClass: string) {
    const isMain = index === 0;
    const isSelected = selectedIndices.has(index);

    return (
      <div
        key={`${photo.url}-${index}`}
        draggable={!selectMode}
        onDragStart={() => setDragIndex(index)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDrop(index)}
        onDragEnd={() => setDragIndex(null)}
        className={`group relative ${sizeClass} overflow-hidden border border-[#E5E5E5] bg-[#F7F7F7] ${
          dragIndex === index ? "opacity-50" : ""
        } ${isSelected ? "ring-2 ring-[#3665F3]" : ""}`}
      >
        {selectMode ? (
          <label className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-white/90">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelectIndex(index)}
              className="h-4 w-4 rounded border-gray-300 text-[#3665F3]"
            />
          </label>
        ) : (
          <button
            type="button"
            aria-label="Drag to reorder"
            className="absolute left-1 top-1 z-10 hidden cursor-grab rounded bg-black/50 px-1 py-0.5 text-[10px] text-white group-hover:block"
            draggable
            onDragStart={(event) => {
              event.stopPropagation();
              setDragIndex(index);
            }}
          >
            ⋮⋮
          </button>
        )}

        <button type="button" onClick={() => makeMain(index)} className="block h-full w-full">
          <ProxiedImage src={photo.url} alt="" className="h-full w-full object-cover" />
        </button>

        {!selectMode ? (
          <button
            type="button"
            onClick={() => removePhoto(index)}
            className="absolute right-1 top-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
            aria-label="Remove photo"
          >
            ×
          </button>
        ) : null}

        {isMain ? (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#191919]/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            Main
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded border border-[#E5E5E5] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E5] px-4 py-3">
        <span className="text-sm font-semibold text-[#191919]">
          {photos.length}/{MAX_PHOTOS}
        </span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setShowOptions(true)} className={ebayTextButtonClass}>
            See photo options
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectMode((current) => !current);
              setSelectedIndices(new Set());
            }}
            className={ebayTextButtonClass}
          >
            {selectMode ? "Done" : "Select"}
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-semibold text-[#191919]">Product Photos</h3>
        <p className="mt-1 mb-4 text-sm text-[#707070]">
          You can add up to 24 photos. Drag and drop images or click Add.
        </p>
        {removedCount > 0 ? (
          <p className="mb-4 text-xs text-[#707070]">
            {removedCount} image{removedCount === 1 ? "" : "s"} removed (contained restricted content)
          </p>
        ) : null}

        {selectMode && selectedIndices.size > 0 ? (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-[#707070]">{selectedIndices.size} selected</span>
            <button
              type="button"
              onClick={bulkDelete}
              className="text-sm font-semibold text-[#C40000] hover:underline"
            >
              Delete selected
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full shrink-0 lg:w-[280px]">
            {mainPhoto ? (
              renderTile(mainPhoto, 0, "aspect-square w-full max-w-[280px]")
            ) : (
              <div className="flex aspect-square w-full max-w-[280px] items-center justify-center border border-dashed border-[#C5C5C5] bg-[#F7F7F7] text-sm text-[#707070]">
                No photos
              </div>
            )}

            {variantPreview.length > 0 ? (
              <div className="mt-3 flex gap-2">
                {variantPreview.map((variant) => (
                  <div key={variant.id} className="min-w-0 flex-1">
                    <div className="aspect-square overflow-hidden border border-[#E5E5E5]">
                      <ProxiedImage
                        src={variant.imageUrl}
                        alt={variant.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-1 truncate text-center text-[10px] text-[#707070]">
                      {variant.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {gridPhotos.map((photo, offset) => renderTile(photo, offset + 1, "aspect-square"))}

              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setAddError("");
                    setShowAddModal(true);
                  }}
                  className="flex aspect-square flex-col items-center justify-center border border-dashed border-[#C5C5C5] bg-[#FAFAFA] text-[#3665F3] hover:border-[#3665F3] hover:bg-[#F0F5FF] disabled:opacity-60"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="mt-1 text-xs font-semibold">{uploading ? "..." : "Add"}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void uploadFiles(event.target.files);
        }}
      />

      {showOptions ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[#191919]">Photo options</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#707070]">
              <li>The first photo is your main listing image.</li>
              <li>Click any thumbnail to set it as the main photo.</li>
              <li>Drag photos to reorder them.</li>
              <li>Drag and drop image files to add new photos.</li>
              <li>Add up to 24 photos total.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowOptions(false)}
              className="mt-4 text-sm font-semibold text-[#3665F3] hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#191919]">Add photos</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-sm text-[#707070] hover:text-[#191919]"
              >
                Close
              </button>
            </div>

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setFileDragOver(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setFileDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setFileDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setFileDragOver(false);
                if (event.dataTransfer.files?.length) {
                  void uploadFiles(event.dataTransfer.files);
                }
              }}
              className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                fileDragOver
                  ? "border-[#3665F3] bg-[#F0F5FF]"
                  : "border-[#C5C5C5] bg-[#FAFAFA] hover:border-[#3665F3]"
              }`}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <span className="text-3xl text-[#3665F3]" aria-hidden>
                ↑
              </span>
            <p className="mt-3 text-sm font-semibold text-[#191919]">
              Drag & drop photos here
            </p>
            <p className="mt-1 text-xs text-[#707070]">or click to browse · JPG, PNG, WebP · max 8MB each</p>
            {uploading ? (
              <p className="mt-2 text-xs font-medium text-[#3665F3]">Saving to server in background…</p>
            ) : null}
            </div>

            {addError ? <p className="mt-3 text-xs text-red-600">{addError}</p> : null}

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-full bg-[#3665F3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2850D4] disabled:opacity-50"
            >
              {uploading ? "Saving…" : "Choose files"}
            </button>

            {unusedAliImages.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium text-[#191919]">From product gallery</p>
                <div className="grid grid-cols-4 gap-2">
                  {unusedAliImages.map((url) => (
                    <button
                      key={url}
                      type="button"
                      disabled={uploading}
                      onClick={() => addPhoto(url)}
                      className="overflow-hidden border border-[#E5E5E5] hover:border-[#3665F3] disabled:opacity-50"
                    >
                      <ProxiedImage src={url} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
