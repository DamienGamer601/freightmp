import { describe, it, expect } from "vitest";
import { parseCookies } from "../src/lib/cookies";

describe("parseCookies", () => {
  it("retourne un objet vide sans en-tête", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });

  it("parse un cookie simple", () => {
    expect(parseCookies("fmp_access=abc123")).toEqual({ fmp_access: "abc123" });
  });

  it("parse plusieurs cookies", () => {
    expect(parseCookies("a=1; b=2; c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("décode les valeurs encodées", () => {
    expect(parseCookies("token=hello%20world")).toEqual({ token: "hello world" });
  });

  it("ignore les segments sans '='", () => {
    expect(parseCookies("invalid; a=1")).toEqual({ a: "1" });
  });

  it("ignore les clés vides", () => {
    expect(parseCookies("=value; a=1")).toEqual({ a: "1" });
  });

  it("conserve une valeur non décodable telle quelle", () => {
    expect(parseCookies("bad=%E0%A4%A")).toEqual({ bad: "%E0%A4%A" });
  });
});
