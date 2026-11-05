import { afterEach, describe, it, expect, vi } from "vitest";
import { HttpError, http } from "../src/lib/http";

describe("HttpError", () => {
  it("expose le statut, le message et le corps", () => {
    const error = new HttpError(404, "Not found", { code: "NOT_FOUND" });
    expect(error.name).toBe("HttpError");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.body).toEqual({ code: "NOT_FOUND" });
  });
});

describe("http", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne le JSON d'une réponse 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const data = await http.get<{ ok: boolean }>("https://example.com/api");
    expect(data).toEqual({ ok: true });
  });

  it("lève une HttpError sur un statut non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );

    await expect(http.get("https://example.com/api")).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("envoie un POST JSON", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ created: true }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await http.post<{ created: boolean }>("https://example.com/api", {
      name: "test",
    });

    expect(data).toEqual({ created: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ name: "test" }));
  });
});
