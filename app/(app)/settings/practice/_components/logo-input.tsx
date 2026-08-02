"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Button } from "@/components/catalyst/button";
import { deleteLogoAction, uploadLogoAction } from "../actions";

const MAX_DIM = 512;
const OUTPUT_MIME = "image/png";

export function LogoInput({
  initialHasLogo,
  className,
}: {
  initialHasLogo: boolean;
  className?: string;
}) {
  const [hasLogo, setHasLogo] = useState(initialHasLogo);
  // Bumped after every mutation so the <img> src changes and dodges the
  // proxy's 60s cache — the browser always shows the just-saved logo.
  const [bust, setBust] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pickerRef = useRef<HTMLInputElement | null>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Use a JPEG or PNG image.");
      return;
    }
    startTransition(async () => {
      try {
        const blob = await resizeLogo(file);
        const fd = new FormData();
        fd.append("file", new File([blob], "logo.png", { type: blob.type }));
        await uploadLogoAction(fd);
        setHasLogo(true);
        setBust((b) => b + 1);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn’t upload that image. Try a different file.",
        );
      }
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteLogoAction();
        setHasLogo(false);
        setBust((b) => b + 1);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn’t remove the logo.",
        );
      }
    });
  }

  return (
    <div className={className}>
      <input
        ref={pickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onPick}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div
          className={clsx(
            "flex h-20 w-40 items-center justify-center rounded-lg border border-zinc-950/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900/40",
          )}
        >
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/organization/branding/logo?b=${bust}`}
              alt="Organization logo"
              className="max-h-16 max-w-36 object-contain"
            />
          ) : (
            <span className="text-xs text-zinc-400">No logo</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            outline
            disabled={pending}
            onClick={() => pickerRef.current?.click()}
          >
            <ArrowUpTrayIcon />
            {hasLogo ? "Replace" : "Upload"}
          </Button>
          {hasLogo ? (
            <Button type="button" outline disabled={pending} onClick={onRemove}>
              <TrashIcon />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

/**
 * Scale an image down to fit within {@link MAX_DIM} on its longest side,
 * preserving aspect ratio, and re-encode as PNG so logo transparency survives.
 * Small images are re-encoded but not upscaled.
 */
async function resizeLogo(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Failed to encode image")),
        OUTPUT_MIME,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
