"use client";
import { useRef, useState } from "react";

export default function AvatarPicker({
  currentAvatar,
  displayName,
}: {
  currentAvatar: string | null;
  displayName: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = removed ? null : preview ?? currentAvatar;

  return (
    <div className="flex items-center gap-4">
      <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden bg-brand-subtle text-brand flex items-center justify-center flex-shrink-0">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Profile picture" className="w-full h-full object-cover" />
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
          onChange={e => {
            const f = e.target.files?.[0];
            if (!f) {
              setPreview(null);
              return;
            }
            setRemoved(false);
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(f);
          }}
        />
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary text-[13px] px-4 py-2">
            {currentAvatar || preview ? "Change picture" : "Upload picture"}
          </button>
          {(currentAvatar || preview) && !removed && (
            <button
              type="button"
              onClick={() => {
                setRemoved(true);
                setPreview(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="btn-ghost text-danger"
            >
              Remove
            </button>
          )}
        </div>
        <input type="hidden" name="removeAvatar" value={removed ? "on" : ""} />
        <p className="text-[12px] text-muted">JPG or PNG, under 500 KB.</p>
      </div>
    </div>
  );
}
