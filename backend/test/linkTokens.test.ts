import { describe, it, expect } from "vitest";
import { signLinkToken, verifyLinkToken } from "../src/auth/linkTokens";

describe("jetons de liaison", () => {
  it("signe et vérifie un jeton Steam", () => {
    const token = signLinkToken("user-1", "steam");
    const payload = verifyLinkToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.provider).toBe("steam");
    expect(payload.purpose).toBe("link");
  });

  it("signe et vérifie un jeton Discord", () => {
    const payload = verifyLinkToken(signLinkToken("user-2", "discord"));
    expect(payload.sub).toBe("user-2");
    expect(payload.provider).toBe("discord");
  });

  it("rejette un jeton falsifié", () => {
    const token = signLinkToken("user-1", "steam");
    expect(() => verifyLinkToken(`${token}x`)).toThrow();
  });

  it("rejette un jeton d'accès classique", () => {
    expect(() => verifyLinkToken("not-a-jwt")).toThrow();
  });
});
