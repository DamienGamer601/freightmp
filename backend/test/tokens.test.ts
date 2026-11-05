import { describe, it, expect } from "vitest";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/auth/tokens";

describe("hashToken", () => {
  it("produit un SHA-256 hexadécimal déterministe", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("diffère pour des entrées différentes", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("jetons d'accès", () => {
  it("signe et vérifie un jeton d'accès", () => {
    const token = signAccessToken({ sub: "user-1", role: "ADMIN" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("rejette un jeton falsifié", () => {
    const token = signAccessToken({ sub: "user-1", role: "DRIVER" });
    expect(() => verifyAccessToken(`${token}x`)).toThrow();
  });
});

describe("jetons de rafraîchissement", () => {
  it("signe et vérifie un jeton de rafraîchissement", () => {
    const token = signRefreshToken({
      sub: "user-1",
      jti: "jti-1",
      type: "refresh",
    });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBe("jti-1");
    expect(payload.type).toBe("refresh");
  });

  it("rejette un jeton d'accès utilisé comme refresh", () => {
    const accessToken = signAccessToken({ sub: "user-1", role: "DRIVER" });
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
