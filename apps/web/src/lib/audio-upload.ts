import type { MediaUploadUrlInput, MediaUploadUrlResponse } from '@englove/shared';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface UploadAudioBlobParams {
  apiUrl: string;
  origin: string;
  attemptId: string;
  blob: Blob;
  fetchFn?: FetchFn;
}

function isUploadUrlResponse(value: unknown): value is MediaUploadUrlResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'mediaId' in value &&
    typeof value.mediaId === 'string' &&
    'uploadUrl' in value &&
    typeof value.uploadUrl === 'string'
  );
}

/**
 * Pide la URL firmada a la API, sube el blob directo a R2 y devuelve el `mediaId`
 * del contrato compartido (SPEC-05 RF-12 y RF-13). Lanza error si algún paso falla;
 * el blob local no se toca aquí.
 */
export async function uploadAudioBlob({
  apiUrl,
  origin,
  attemptId,
  blob,
  fetchFn = fetch,
}: UploadAudioBlobParams): Promise<string> {
  const mimeType = blob.type || 'audio/webm';
  const input: MediaUploadUrlInput = { attemptId, mimeType, sizeBytes: blob.size };

  const presignedRes = await fetchFn(`${apiUrl}/api/v1/media/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!presignedRes.ok) {
    throw new Error('UPLOAD_URL_REJECTED');
  }

  const presignedData: unknown = await presignedRes.json();
  if (!isUploadUrlResponse(presignedData)) {
    throw new Error('UPLOAD_URL_INVALID_RESPONSE');
  }

  const uploadRes = await fetchFn(presignedData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!uploadRes.ok) {
    throw new Error('UPLOAD_FAILED');
  }

  return presignedData.mediaId;
}
