import { describe, it, expect, vi } from "vitest";
import { uploadAudioBlob } from "../src/lib/audio-upload";

describe("SPEC-05 RF-13 (ENG-074): subida de audio devuelve el mediaId del contrato", () => {
  it.each([400, 404, 409, 413, 422, 429, 500])("OFF-01: conserva status y code de upload-url (%i)", async (status) => {
    await expect(uploadAudioBlob({
      apiUrl: "https://api.example", origin: "https://app.example", attemptId: "att-1",
      blob: new Blob(["audio"]),
      fetchFn: async () => new Response(JSON.stringify({code: "ATTEMPT_CLOSED", message: "cerrada"}), {status}),
    })).rejects.toMatchObject({statusCode: status, code: "ATTEMPT_CLOSED"});
  });
  it("OFF-01: cancelling an old account upload prevents the subsequent PUT", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async () => {
      controller.abort();
      return new Response(
        JSON.stringify({
          mediaId: "old-media",
          uploadUrl: "https://r2.example/old",
        }),
      );
    });
    await expect(
      uploadAudioBlob({
        apiUrl: "https://api.example",
        origin: "https://app.example",
        attemptId: "old-attempt",
        blob: new Blob(["a"]),
        fetchFn: fetchMock,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("SPEC-05 RF-13: pide la URL, sube el blob por PUT y devuelve el mediaId de la API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mediaId: "media-123",
            uploadUrl: "https://r2.example/put",
            expiresAt: "2026-11-01T10:10:00.000Z",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const blob = new Blob(["abc"], { type: "audio/webm" });
    const mediaId = await uploadAudioBlob({
      apiUrl: "https://api.example",
      origin: "https://app.example",
      attemptId: "att-1",
      blob,
      fetchFn: fetchMock,
    });

    expect(mediaId).toBe("media-123");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example/api/v1/media/upload-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          attemptId: "att-1",
          mimeType: "audio/webm",
          sizeBytes: 3,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://r2.example/put",
      expect.objectContaining({ method: "PUT", body: blob }),
    );
  });

  it("SPEC-05 RF-13: si la API rechaza la URL lanza error y no sube el blob", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: "ATTEMPT_CLOSED", message: "cerrada" }),
          { status: 409 },
        ),
      );

    await expect(
      uploadAudioBlob({
        apiUrl: "https://api.example",
        origin: "https://app.example",
        attemptId: "att-1",
        blob: new Blob(["abc"], { type: "audio/webm" }),
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("SPEC-05 RF-13: si el PUT a R2 falla lanza error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mediaId: "media-1",
            uploadUrl: "https://r2.example/put",
            expiresAt: "x",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      uploadAudioBlob({
        apiUrl: "https://api.example",
        origin: "https://app.example",
        attemptId: "att-1",
        blob: new Blob(["abc"], { type: "audio/webm" }),
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow();
  });
});
