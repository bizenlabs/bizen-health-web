"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  CameraIcon,
  ArrowUpTrayIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import { Avatar } from "@/components/catalyst/avatar";
import { Button } from "@/components/catalyst/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "@/components/catalyst/dialog";

const MAX_DIM = 512;
const JPEG_QUALITY = 0.85;
const OUTPUT_MIME = "image/jpeg";

type Props = {
  /** Hidden file input name picked up by the form's FormData. */
  name?: string;
};

/**
 * Photo capture for the patient registration form. Three entry points: file
 * picker (with mobile camera shortcut via {@code capture="user"}), in-page
 * webcam modal, and drag-and-drop. Captured/uploaded images are center-
 * cropped to square and resized to {@code MAX_DIM} as JPEG so the wire
 * payload stays small.
 *
 * The selected {@link Blob} is mirrored onto a hidden {@code <input
 * type="file">} via a {@link DataTransfer} shim — that's how the parent form
 * picks it up as part of its FormData without any onSubmit hijack.
 */
export function PhotoInput({ name = "photo" }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  // Sync the hidden file input so the form submission carries the photo.
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    if (blob) {
      dt.items.add(new File([blob], "photo.jpg", { type: blob.type }));
    }
    input.files = dt.files;
  }, [blob]);

  // Preview URL derived from the blob. Revoke on change/unmount via cleanup
  // tied to the URL itself — keeps state out of useEffect so the
  // set-state-in-effect rule is satisfied.
  const previewUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Use a JPEG or PNG image.");
      return;
    }
    try {
      const out = await resizeToSquareJpeg(file);
      setBlob(out);
    } catch {
      setError("Couldn’t read that image. Try a different file.");
    }
  }, []);

  const onPickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset so re-picking the same file fires change again.
    e.target.value = "";
  };

  return (
    <div>
      {/* Hidden form-field input — its `files` are driven from blob state. */}
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {/* Hidden picker input (separate so its `value` reset doesn't fight with the form input). */}
      <input
        ref={pickerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="sr-only"
        onChange={onPickerChange}
      />

      <DropZone onFile={handleFile}>
        {blob && previewUrl ? (
          <div className="flex items-center gap-4">
            <Avatar
              square
              src={previewUrl}
              alt="Patient photo preview"
              className="size-24"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                outline
                onClick={() => pickerInputRef.current?.click()}
              >
                <ArrowUpTrayIcon />
                Replace
              </Button>
              <Button type="button" outline onClick={() => setWebcamOpen(true)}>
                <CameraIcon />
                Retake
              </Button>
              <Button
                type="button"
                outline
                onClick={() => {
                  setBlob(null);
                  setError(null);
                }}
              >
                <TrashIcon />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              outline
              onClick={() => pickerInputRef.current?.click()}
            >
              <ArrowUpTrayIcon />
              Upload
            </Button>
            <Button type="button" outline onClick={() => setWebcamOpen(true)}>
              <CameraIcon />
              Take photo
            </Button>
            <span className="text-xs text-zinc-500">
              JPEG or PNG, up to 1MB. Drag a file here to upload.
            </span>
          </div>
        )}
      </DropZone>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {webcamOpen ? (
        <WebcamDialog
          onClose={() => setWebcamOpen(false)}
          onCapture={(captured) => {
            setBlob(captured);
            setWebcamOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DropZone({
  onFile,
  children,
}: {
  onFile: (file: File) => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={
        over
          ? "rounded-xl border-2 border-dashed border-zinc-500 bg-zinc-50 p-5 transition-colors dark:border-zinc-400 dark:bg-zinc-900/40"
          : "rounded-xl border-2 border-dashed border-zinc-950/10 p-5 transition-colors dark:border-white/10"
      }
    >
      {children}
    </div>
  );
}

function WebcamDialog({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Mounts once per open (parent gates with `webcamOpen &&`), so we acquire
  // the stream once and tear down on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access denied. Allow access in your browser, or use Upload."
            : "Couldn’t access camera. Use Upload instead.";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setWorking(true);
    try {
      const canvas = cropToSquare(video, MAX_DIM);
      const blob = await canvasToJpeg(canvas);
      onCapture(blob);
    } finally {
      setWorking(false);
    }
  }, [onCapture]);

  return (
    <Dialog open onClose={onClose} size="md">
      <DialogTitle>Take a photo</DialogTitle>
      <DialogBody>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <div className="flex justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-square w-full max-w-sm rounded-xl border border-zinc-950/10 bg-zinc-100 object-cover dark:border-white/10 dark:bg-zinc-800"
            />
            {/* Aspect-square already; preview matches the captured framing. */}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button type="button" plain onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={capture} disabled={!!error || working}>
          {working ? "Capturing…" : "Capture"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- image helpers ---

async function resizeToSquareJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = cropToSquare(img, MAX_DIM);
    return await canvasToJpeg(canvas);
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

function cropToSquare(
  source: HTMLImageElement | HTMLVideoElement,
  maxDim: number,
): HTMLCanvasElement {
  const sw = "videoWidth" in source ? source.videoWidth : source.naturalWidth;
  const sh =
    "videoHeight" in source ? source.videoHeight : source.naturalHeight;
  const side = Math.min(sw, sh);
  const sx = Math.floor((sw - side) / 2);
  const sy = Math.floor((sh - side) / 2);
  const out = Math.min(side, maxDim);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, sx, sy, side, side, 0, 0, out, out);
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      OUTPUT_MIME,
      JPEG_QUALITY,
    );
  });
}
