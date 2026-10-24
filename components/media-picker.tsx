"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export function MediaPicker({ existingCount = 0 }: { existingCount?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function selectFiles(selected: File[], fileList?: FileList) {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = selected.map((file) => URL.createObjectURL(file));
    setPreviews(previewUrls.current);
    setFiles(selected);
    if (fileList && inputRef.current) inputRef.current.files = fileList;
  }

  return (
    <>
      <div
        className="upload-field"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = Array.from(event.dataTransfer.files);
          selectFiles(dropped, event.dataTransfer.files);
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
      {existingCount ? (
        <p className="existing-media-note">{existingCount} file{existingCount === 1 ? "" : "s"} already saved. New uploads will be added to this chapter.</p>
      ) : (
        <p className="existing-media-note">A photo is optional for now. A clearly marked placeholder will appear until one is added.</p>
      )}
    </>
  );
}
