"use client";

import Image from "next/image";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasValidMediaSignature } from "@/lib/media-validation";
import type { UploadedMediaInput } from "@/lib/types";

export interface MediaPickerHandle {
  upload(memoryId: string): Promise<UploadedMediaInput[]>;
}

interface MediaPickerProps {
  existingCount?: number;
  onUploadingChange?: (uploading: boolean) => void;
}

const mediaExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const maxFileSize = 15 * 1024 * 1024;
const maxTotalSize = 50 * 1024 * 1024;

export const MediaPicker = forwardRef<MediaPickerHandle, MediaPickerProps>(function MediaPicker(
  { existingCount = 0, onUploadingChange },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function selectFiles(selected: File[], fileList?: FileList) {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = selected.map((file) => URL.createObjectURL(file));
    setPreviews(previewUrls.current);
    setFiles(selected);
    setUploadError("");
    if (fileList && inputRef.current) inputRef.current.files = fileList;
  }

  useImperativeHandle(ref, () => ({
    async upload(memoryId) {
      if (existingCount + files.length > 8) {
        throw new Error("A memory can contain up to eight media files.");
      }
      if (files.some((file) => file.size > maxFileSize || file.size <= 0)) {
        throw new Error("Each file must be between 1 byte and 15 MB.");
      }
      if (files.reduce((total, file) => total + file.size, 0) > maxTotalSize) {
        throw new Error("The combined upload must be 50 MB or smaller.");
      }

      const selectedTypes = files.map((file) => mediaExtensions[file.type]);
      if (selectedTypes.some((extension) => !extension)) {
        throw new Error("Use JPG, PNG, WebP, GIF, MP4, or WebM files.");
      }

      onUploadingChange?.(true);
      setUploadError("");
      const supabase = createSupabaseBrowserClient();
      const uploadedPaths: string[] = [];
      try {
        const uploads: UploadedMediaInput[] = [];
        for (const [index, file] of files.entries()) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!hasValidMediaSignature(file.type, bytes)) {
            throw new Error(`${file.name || "A file"} does not match its declared media type.`);
          }

          const objectPath = `${memoryId}/${crypto.randomUUID()}.${selectedTypes[index]}`;
          const { error } = await supabase.storage.from("memories").upload(objectPath, file, {
            contentType: file.type,
            upsert: false,
          });
          if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
          uploadedPaths.push(objectPath);
          uploads.push({ objectPath, mimeType: file.type, size: file.size });
        }
        return uploads;
      } catch (error) {
        if (uploadedPaths.length) {
          const { error: cleanupError } = await supabase.storage.from("memories").remove(uploadedPaths);
          if (cleanupError) {
            throw new AggregateError(
              [error, new Error(`Upload cleanup failed: ${cleanupError.message}`)],
              "Media upload failed and cleanup was incomplete.",
            );
          }
        }
        const message = error instanceof Error ? error.message : "Media upload failed.";
        setUploadError(message);
        throw error;
      } finally {
        onUploadingChange?.(false);
      }
    },
  }), [existingCount, files, onUploadingChange]);

  return (
    <>
      <div
        className="upload-field"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          selectFiles(Array.from(event.dataTransfer.files), event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          name="media"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          multiple
          onChange={(event) => selectFiles(Array.from(event.currentTarget.files ?? []))}
          aria-label="Choose photos or videos"
        />
        <span className="upload-icon" aria-hidden="true">＋</span>
        <span className="upload-instructions">
          <strong>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose or drop photos and videos"}</strong>
          <small>JPG, PNG, WebP, GIF, MP4 or WebM · up to 15 MB each</small>
        </span>
        <button className="upload-browse" type="button" onClick={() => inputRef.current?.click()}>Browse</button>
      </div>
      {previews.length ? (
        <div className="upload-previews" aria-label="Selected media previews">
          {files.map((file, index) => (
            <figure key={`${file.name}-${file.lastModified}`}>
              {file.type.startsWith("video/") ? (
                <video controls muted preload="metadata" src={previews[index]} aria-label={`Preview of ${file.name}`} />
              ) : (
                <Image src={previews[index]} alt={`Preview of ${file.name}`} width={110} height={90} unoptimized />
              )}
              <figcaption>{file.name}</figcaption>
            </figure>
          ))}
          <button
            type="button"
            className="table-action danger-action"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              selectFiles([]);
            }}
          >
            Clear selected files
          </button>
        </div>
      ) : null}
      {uploadError ? <p className="form-error" role="alert">{uploadError}</p> : null}
      {existingCount ? (
        <p className="existing-media-note">{existingCount} file{existingCount === 1 ? "" : "s"} already saved. New uploads will be added to this chapter.</p>
      ) : (
        <p className="existing-media-note">A photo is optional for now. A clearly marked placeholder will appear until one is added.</p>
      )}
    </>
  );
});
