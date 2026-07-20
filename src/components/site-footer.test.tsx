import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("renders the Natura logo and copyright text", () => {
    const html = renderToString(<SiteFooter />);
    expect(html).toContain('alt="Natura"');
    expect(html).toContain("© 2025 Natura &amp;Co");
    expect(html).toContain("Bem Estar Bem");
    expect(html).toContain("<footer");
  });
});
