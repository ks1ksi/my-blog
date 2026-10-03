const pendingCopies = new WeakSet<HTMLButtonElement>();
const resetTimers = new WeakMap<HTMLButtonElement, number>();

export function enhanceCodeBlocks() {
  for (const codeBlock of document.querySelectorAll<HTMLElement>(
    "article pre:not([data-copy-ready])",
  )) {
    const wrapper = document.createElement("div");
    wrapper.className = "copy-code-wrapper";
    codeBlock.dataset.copyReady = "true";
    codeBlock.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-code";
    copyButton.setAttribute("aria-label", "코드 복사");
    copyButton.textContent = "복사";
    codeBlock.appendChild(copyButton);

    const status = document.createElement("span");
    status.className = "copy-code-status sr-only";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    wrapper.appendChild(status);
  }
}

export async function copyCode(copyButton: HTMLButtonElement) {
  const codeBlock = copyButton.closest("pre");
  if (!codeBlock || pendingCopies.has(copyButton)) return;

  pendingCopies.add(copyButton);
  window.clearTimeout(resetTimers.get(copyButton));
  const status = codeBlock.parentElement?.querySelector(".copy-code-status");
  if (status) status.textContent = "";
  const clone = codeBlock.cloneNode(true) as HTMLElement;
  clone.querySelector(".copy-code")?.remove();

  try {
    await navigator.clipboard.writeText((clone.textContent ?? "").trimEnd());
    if (!copyButton.isConnected) return;
    copyButton.textContent = "복사됨";
    copyButton.setAttribute("aria-label", "코드 복사됨");
    if (status) status.textContent = "코드를 복사했습니다";
    resetTimers.set(
      copyButton,
      window.setTimeout(() => {
        if (copyButton.isConnected) {
          copyButton.textContent = "복사";
          copyButton.setAttribute("aria-label", "코드 복사");
        }
        resetTimers.delete(copyButton);
      }, 2000),
    );
  } catch {
    if (!copyButton.isConnected) return;
    copyButton.textContent = "복사 실패 · 다시 시도";
    copyButton.setAttribute("aria-label", "코드 복사 실패. 다시 시도");
    if (status) {
      status.textContent =
        "복사하지 못했습니다. 다시 시도하거나 코드를 직접 선택해 복사하세요";
    }
  } finally {
    pendingCopies.delete(copyButton);
  }
}
