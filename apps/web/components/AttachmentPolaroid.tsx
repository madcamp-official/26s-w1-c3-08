"use client";

import { useState } from "react";

type AttachmentPolaroidProps = {
  publicUrl: string;
  alt?: string | null;
};

export function AttachmentPolaroid({ publicUrl, alt }: AttachmentPolaroidProps) {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("portrait");

  return (
    <a
      href={publicUrl}
      target="_blank"
      rel="noreferrer"
      className={`focus-ring maeari-polaroid-frame maeari-polaroid-frame-${orientation}`}
    >
      <span className="maeari-polaroid-photo">
        <img
          src={publicUrl}
          alt={alt ?? ""}
          onLoad={(event) => {
            const image = event.currentTarget;
            setOrientation(image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait");
          }}
        />
      </span>
    </a>
  );
}
