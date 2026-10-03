import { afterEach, describe, expect, it, vi } from "vitest";
import { createRetryableLoader } from "./retryable-loader";

afterEach(() => vi.useRealTimers());

describe("retryable module loading", () => {
  it("deduplicates concurrent and successful loads", async () => {
    const load = vi.fn().mockResolvedValue("ready");
    const ensure = createRetryableLoader(load);
    const first = ensure();
    expect(ensure()).toBe(first);
    expect(await first).toBe("ready");
    expect(await ensure()).toBe("ready");
    expect(load).toHaveBeenCalledOnce();
  });

  it("resets a rejected import so a later open can retry", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("ready");
    const ensure = createRetryableLoader(load);
    await expect(ensure()).rejects.toThrow("offline");
    expect(await ensure()).toBe("ready");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("times out a stalled import and ignores its late resolution after retry", async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue("new");
    const ensure = createRetryableLoader(load, 100);
    const first = ensure();
    const rejected = expect(first).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(await ensure()).toBe("new");
    finish("old");
    expect(await ensure()).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
