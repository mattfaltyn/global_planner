import { afterEach, describe, expect, it, vi } from "vitest";

describe("GlobeShell dynamic loading", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_E2E = "";
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads the production globe canvas by default", async () => {
    let capturedLoader: (() => Promise<unknown>) | null = null;

    vi.doMock("next/dynamic", () => ({
      default: (loader: () => Promise<unknown>) => {
        capturedLoader = loader;
        return function MockDynamicComponent() {
          return null;
        };
      },
    }));
    vi.doMock("../../components/globe/GlobeCanvas", () => ({
      GlobeCanvas: "production-globe",
    }));
    vi.doMock("../../components/globe/TestGlobeCanvas", () => ({
      TestGlobeCanvas: "test-globe",
    }));

    const module = await import("../../components/globe/GlobeShell");

    expect(module.GlobeShell).toBeTypeOf("function");
    expect(capturedLoader).not.toBeNull();
    await expect(capturedLoader?.()).resolves.toBe("production-globe");
  });

  it("loads the test globe canvas when e2e mode is enabled", async () => {
    let capturedLoader: (() => Promise<unknown>) | null = null;
    process.env.NEXT_PUBLIC_E2E = "1";

    vi.doMock("next/dynamic", () => ({
      default: (loader: () => Promise<unknown>) => {
        capturedLoader = loader;
        return function MockDynamicComponent() {
          return null;
        };
      },
    }));
    vi.doMock("../../components/globe/GlobeCanvas", () => ({
      GlobeCanvas: "production-globe",
    }));
    vi.doMock("../../components/globe/TestGlobeCanvas", () => ({
      TestGlobeCanvas: "test-globe",
    }));

    const module = await import("../../components/globe/GlobeShell");

    expect(module.GlobeShell).toBeTypeOf("function");
    expect(capturedLoader).not.toBeNull();
    await expect(capturedLoader?.()).resolves.toBe("test-globe");
  });
});
