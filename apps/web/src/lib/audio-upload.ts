import type {
  MediaUploadUrlInput,
  MediaUploadUrlResponse,
} from "@englove/shared";
import { requestSharedRefresh } from "./api";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface UploadAudioBlobParams {
  apiUrl: string;
  origin: string;
  attemptId: string;
  blob: Blob;
  attemptToken?: string;
  fetchFn?: FetchFn;
  signal?: AbortSignal;
}

function isUploadUrlResponse(value: unknown): value is MediaUploadUrlResponse {
  if (typeof value !== "object" || value === null) return false;
  return (
    "mediaId" in value &&
    typeof value.mediaId === "string" &&
    "uploadUrl" in value &&
    typeof value.uploadUrl === "string"
  );
}

/**
 * Pide la URL firmada a la API, sube el blob directo a R2 y devuelve el `mediaId`
 * del contrato compartido (SPEC-05 RF-12 y RF-13). Reintenta con refresco único ante 401 (RF-2).
 */
export async function uploadAudioBlob({
  apiUrl,
  origin,
  attemptId,
  blob,
  attemptToken,
  fetchFn = fetch,
  signal,
}: UploadAudioBlobParams): Promise<string> {
  signal?.throwIfAborted();
  const mimeType = blob.type || "audio/webm";
  const input: MediaUploadUrlInput = {
    attemptId,
    mimeType,
    sizeBytes: blob.size,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: origin,
  };
  if (attemptToken) {
    headers["x-attempt-token"] = attemptToken;
  }

  let presignedRes = await fetchFn(`${apiUrl}/api/v1/media/upload-url`, {
    signal,
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(input),
  });

  signal?.throwIfAborted();
  if (presignedRes.status === 401 && typeof window !== "undefined") {
    const refreshed = await requestSharedRefresh();
    signal?.throwIfAborted();
    if (refreshed) {
      presignedRes = await fetchFn(`${apiUrl}/api/v1/media/upload-url`, {
        signal,
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(input),
      });
    }
  }

  if (!presignedRes.ok) {
    throw new Error("UPLOAD_URL_REJECTED");
  }

  const presignedData: unknown = await presignedRes.json();
  signal?.throwIfAborted();
  if (!isUploadUrlResponse(presignedData)) {
    throw new Error("UPLOAD_URL_INVALID_RESPONSE");
  }

  const uploadRes = await fetchFn(presignedData.uploadUrl, {
    signal,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  signal?.throwIfAborted();
  if (!uploadRes.ok) {
    throw new Error("UPLOAD_FAILED");
  }

  return presignedData.mediaId;
}
