import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../src/middleware/authorize";

function makeRes() {
  const res = {} as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  (res as unknown as { status: unknown }).status = vi.fn(() => res);
  (res as unknown as { json: unknown }).json = vi.fn(() => res);
  return res;
}

function run(user: unknown, ...roles: Parameters<typeof requireRole>) {
  const req = { user } as unknown as Request;
  const res = makeRes();
  const next = vi.fn() as unknown as NextFunction;
  requireRole(...roles)(req, res, next);
  return { res, next };
}

describe("requireRole", () => {
  it("répond 401 sans utilisateur authentifié", () => {
    const { res, next } = run(undefined, "ADMIN");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("répond 403 si le rôle ne correspond pas", () => {
    const { res, next } = run({ role: "DRIVER" }, "ADMIN");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("laisse passer si le rôle correspond", () => {
    const { res, next } = run({ role: "ADMIN" }, "ADMIN");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("accepte plusieurs rôles autorisés", () => {
    const { res, next } = run({ role: "MODERATOR" }, "ADMIN", "MODERATOR");
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
