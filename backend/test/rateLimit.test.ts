import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { rateLimiter } from "../src/middleware/rateLimit";

function makeRes() {
  const res = {} as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  (res as unknown as { status: unknown }).status = vi.fn(() => res);
  (res as unknown as { json: unknown }).json = vi.fn(() => res);
  return res;
}

function hit(ip: string) {
  const req = { ip } as unknown as Request;
  const res = makeRes();
  const next = vi.fn() as unknown as NextFunction;
  rateLimiter(req, res, next);
  return { res, next };
}

describe("rateLimiter", () => {
  it("autorise les premières requêtes", () => {
    const { next } = hit("10.0.0.1");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("bloque au-delà de 120 requêtes sur la fenêtre", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 120; i += 1) {
      const { next } = hit(ip);
      expect(next).toHaveBeenCalledTimes(1);
    }

    const { res, next } = hit(ip);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it("compte les IP séparément", () => {
    for (let i = 0; i < 120; i += 1) {
      hit("10.0.0.3");
    }
    const { next } = hit("10.0.0.4");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
