import { describe, it, expect } from "vitest";
import {
  buildSteamLoginUrl,
  extractSteamIdFromClaimedId,
} from "../src/auth/steam";

describe("buildSteamLoginUrl", () => {
  it("pointe vers l'endpoint OpenID de Steam", () => {
    const url = buildSteamLoginUrl("http://localhost:4000/api/v1/auth/steam/callback");
    expect(url).toContain("https://steamcommunity.com/openid/login");
  });

  it("utilise le mode checkid_setup", () => {
    const url = buildSteamLoginUrl("http://localhost:4000/api/v1/auth/steam/callback");
    expect(url).toContain("openid.mode=checkid_setup");
  });

  it("encode l'URL de retour", () => {
    const url = buildSteamLoginUrl("http://localhost:4000/api/v1/auth/steam/callback");
    expect(url).toContain(
      encodeURIComponent("http://localhost:4000/api/v1/auth/steam/callback"),
    );
  });
});

describe("extractSteamIdFromClaimedId", () => {
  it("extrait un SteamID64 valide", () => {
    expect(
      extractSteamIdFromClaimedId("https://steamcommunity.com/openid/id/76561198000000000"),
    ).toBe("76561198000000000");
  });

  it("rejette un claimed_id sans SteamID64", () => {
    expect(() => extractSteamIdFromClaimedId("https://example.com/foo")).toThrow();
  });

  it("rejette une valeur non-chaîne", () => {
    expect(() => extractSteamIdFromClaimedId(42)).toThrow();
  });
});
