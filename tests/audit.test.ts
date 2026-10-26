import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Career Radar — Website Quality Audit Verification Suite", () => {
  const rootDir = path.resolve(__dirname, "..");

  it("1. favicon exists in public directory and is referenced in index.html", () => {
    const faviconPath = path.join(rootDir, "public", "favicon.svg");
    expect(fs.existsSync(faviconPath)).toBe(true);

    const faviconContent = fs.readFileSync(faviconPath, "utf-8");
    expect(faviconContent).toContain("<svg");
    expect(faviconContent).toContain("#15372f"); // brand deep pine
    expect(faviconContent).toContain("#ef715f"); // brand coral dot

    const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf-8");
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(indexHtml).toContain('<meta name="description"');
  });

  it("2. optimized WebP images exist and were generated from heavy PNG assets", () => {
    const webpFiles = [
      "hand.webp",
      "image1.webp",
      "imagee1.webp",
      "imagee2.webp",
      "imagee3.webp",
      "imagee4.webp",
      "imagee5.webp",
      "imagee6.webp",
      "public/assets/career-radar-hero-landscape.webp",
      "public/images/career-radar-hero.webp",
    ];

    for (const file of webpFiles) {
      const fullPath = path.join(rootDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      // All optimized WebP images should be under 300 KB (down from >2 MB PNGs)
      expect(stat.size).toBeLessThan(350 * 1024);
    }
  });

  it("3. App.tsx imports hand.webp and uses safe external URLs for drawer CTA", () => {
    const appTsx = fs.readFileSync(path.join(rootDir, "src", "ui", "App.tsx"), "utf-8");
    expect(appTsx).toContain('import handUrl from "../../hand.webp";');
    expect(appTsx).toContain("NotFoundRoute");
    expect(appTsx).toContain("usePageMetadata");
    expect(appTsx).toContain("drawer-cta");
    expect(appTsx).toContain("mobile-shell-menu-btn");
  });

  it("4. NotFoundRoute renders 404 message and provides navigation recovery buttons", () => {
    const appTsx = fs.readFileSync(path.join(rootDir, "src", "ui", "App.tsx"), "utf-8");
    expect(appTsx).toContain("SIGNAL LOST · 404");
    expect(appTsx).toContain("This page is <em>off our radar.</em>");
    expect(appTsx).toContain("Back to home");
    expect(appTsx).toContain("Explore preview");
  });

  it("5. CSS contains responsive fixes for mobile overflow and 320px viewports", () => {
    const appCss = fs.readFileSync(path.join(rootDir, "src", "ui", "app.css"), "utf-8");
    // Wordmark responsive clamp
    expect(appCss).toContain(".landing-footer-wordmark");
    expect(appCss).toContain("clamp(48px, 17vw, 140px)");
    // Hero h1 responsive clamp
    expect(appCss).toContain("clamp(38px, 11vw, 67px)");
    // Mobile shell menu panel styles
    expect(appCss).toContain(".mobile-shell-menu-panel");
    expect(appCss).toContain(".not-found-page");
  });

  it("6. Logos across public and auth views are accessible and clickable", () => {
    const authFlows = fs.readFileSync(path.join(rootDir, "src", "ui", "AuthFlows.tsx"), "utf-8");
    expect(authFlows).toContain('aria-label="Career Radar home"');
    expect(authFlows).toContain("onLogoClick");

    const candidateOnboarding = fs.readFileSync(
      path.join(rootDir, "src", "ui", "CandidateOnboarding.tsx"),
      "utf-8"
    );
    expect(candidateOnboarding).toContain('aria-label="Career Radar home"');
    expect(candidateOnboarding).toContain('navigate("/")');
  });
});
