"use client";
import { useRef, useState } from "react";

export default function AvatarPicker({
  currentAvatar,
  displayName,
  uploadLabel,
  changeLabel,
  removeLabel,
  hint,
  maxMB = 2,
}: {
  currentAvatar: string | null;
  displayName: string;
  uploadLabel: string;
  changeLabel: string;
  removeLabel: string;
  hint: string;
  maxMB?: number;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = removed ? null : preview ?? currentAvatar;
  const maxBytes = maxMB * 1024 * 1024;

  const handleFile = (file: File | null) => {
    setError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size > maxBytes) {
      setError(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — must be under ${maxMB} MB. Take a screenshot of the picture and upload the screenshot instead (it will be smaller).`);
      setPreview(null);
      return;
    }
    setRemoved(false);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden bg-brand-subtle text-brand flex items-center justify-center flex-shrink-0">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[26px] font-bold">{displayName[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="space-y-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            name="avatarFile"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary text-[13px] px-4 py-2">
              {currentAvatar || preview ? changeLabel : uploadLabel}
            </button>
            {(currentAvatar || preview) && !removed && (
              <button
                type="button"
                onClick={() => {
                  setRemoved(true);
                  setPreview(null);
                  setError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="btn-ghost text-danger"
              >
                {removeLabel}
              </button>
            )}
          </div>
          <input type="hidden" name="removeAvatar" value={removed ? "on" : ""} />
          <p className="text-[12px] text-muted">{hint}</p>
        </div>
      </div>
      {error && (
        <div className="p-3 rounded-[12px] bg-warn-subtle border border-warn/20 text-warn text-[13px] leading-relaxed">
          {error}
        </div>
      )}
    </div>
  );
}