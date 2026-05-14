"use client";

import { useState } from "react";
import { Avatar } from "@/components/catalyst/avatar";

type Props = {
  patientId: string;
  name: string;
  className?: string;
};

/**
 * Patient profile photo via the BFF proxy, with an initials fallback when the
 * patient has no photo (proxy returns 404). Wraps Catalyst's {@link Avatar}
 * with {@code square} styling and uses a hidden probe {@code <img>} to detect
 * 404s — when the probe errors, we drop {@code src} so Catalyst's initials
 * SVG renders unobstructed.
 */
export function PatientAvatar({ patientId, name, className }: Props) {
  const [errored, setErrored] = useState(false);
  const url = `/api/patients/${patientId}/photo`;
  return (
    <>
      <Avatar
        square
        src={errored ? null : url}
        initials={initials(name)}
        alt={`Photo of ${name}`}
        className={className}
      />
      {!errored ? (
        // Hidden probe: shares the URL so the browser dedupes to a single
        // network request. onError flips state and the visible Avatar drops
        // src on the next render.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          aria-hidden="true"
          className="hidden"
          onError={() => setErrored(true)}
        />
      ) : null}
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
