import { describe, expect, it } from "vitest";
import { supabaseOrigin } from "./env";

describe("supabaseOrigin", () => {
  it("keeps a bare project URL", () => {
    expect(supabaseOrigin("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
  it("drops a pasted REST path or trailing slash", () => {
    expect(supabaseOrigin("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(supabaseOrigin("http://127.0.0.1:54321/")).toBe("http://127.0.0.1:54321");
  });
  it("refuses a missing value", () => {
    expect(() => supabaseOrigin(undefined)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
