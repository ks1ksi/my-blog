// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyCode, enhanceCodeBlocks } from "./code-copy";

beforeEach(() => {
  document.body.innerHTML =
    "<article><pre><code>const value = 1;\n</code></pre></article>";
  enhanceCodeBlocks();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const button = () => document.querySelector<HTMLButtonElement>(".copy-code")!;

describe("code copy feedback", () => {
  it("enhances once and copies just the code, with Korean feedback", async () => {
    vi.useFakeTimers();
    enhanceCodeBlocks();
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();
    expect(document.querySelectorAll(".copy-code")).toHaveLength(1);
    await copyCode(button());
    expect(write).toHaveBeenCalledWith("const value = 1;");
    expect(button().textContent).toBe("복사됨");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button().textContent).toBe("복사");
  });

  it("reports rejection and allows a successful second attempt", async () => {
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValue();
    await copyCode(button());
    expect(button().textContent).toContain("복사 실패");
    expect(document.querySelector("[role=status]")!.textContent).toContain(
      "직접 선택",
    );
    await copyCode(button());
    expect(button().textContent).toBe("복사됨");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("ignores repeated clicks while pending and a detached completion", async () => {
    let finish!: () => void;
    const write = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const copyButton = button();
    const pending = copyCode(copyButton);
    await copyCode(copyButton);
    expect(write).toHaveBeenCalledOnce();
    document.body.innerHTML = "";
    finish();
    await pending;
    expect(copyButton.textContent).toBe("복사");
  });
});
