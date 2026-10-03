const LOAD_TIMEOUT_MS = 15_000;

type LoadState = "idle" | "loading" | "loaded" | "error";

export class GiscusComments extends HTMLElement {
  private state: LoadState = "idle";
  private generation = 0;
  private script: HTMLScriptElement | null = null;
  private observer: MutationObserver | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    this.querySelector("details")?.addEventListener("toggle", this.load);
    this.querySelector(".comments-retry")?.addEventListener(
      "click",
      this.retry,
    );
    this.load();
  }

  disconnectedCallback() {
    this.querySelector("details")?.removeEventListener("toggle", this.load);
    this.querySelector(".comments-retry")?.removeEventListener(
      "click",
      this.retry,
    );
    this.reset();
  }

  private reset() {
    this.generation += 1;
    this.observer?.disconnect();
    this.observer = null;
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
    this.script?.remove();
    this.script = null;
    this.querySelector(".giscus")?.replaceChildren();
    this.state = "idle";
  }

  private setStatus(text: string, failed = false) {
    const status = this.querySelector<HTMLElement>(".comments-status");
    const retry = this.querySelector<HTMLButtonElement>(".comments-retry");
    if (status) status.textContent = text;
    if (retry) retry.hidden = !failed;
    this.setAttribute("aria-busy", String(this.state === "loading"));
  }

  private retry = () => {
    if (this.state !== "error") return;
    this.load();
  };

  private load = () => {
    if (
      !this.isConnected ||
      !this.querySelector<HTMLDetailsElement>("details")?.open
    )
      return;
    if (this.state === "loading" || this.state === "loaded") return;
    const source =
      this.querySelector("template")?.content.querySelector("script");
    const mount = this.querySelector(".giscus");
    if (!source || !mount) return;

    this.reset();
    const generation = this.generation;
    this.state = "loading";
    this.setStatus("댓글을 불러오는 중…");
    const isCurrent = () => this.isConnected && this.generation === generation;
    const finish = (failed: boolean) => {
      if (!isCurrent() || this.state !== "loading") return;
      if (this.timeout !== null) clearTimeout(this.timeout);
      this.timeout = null;
      this.observer?.disconnect();
      this.observer = null;
      this.state = failed ? "error" : "loaded";
      if (failed) {
        this.script?.remove();
        this.script = null;
        mount.replaceChildren();
      }
      this.setStatus(
        failed
          ? "댓글을 불러오지 못했습니다. 다시 시도하거나 GitHub에서 확인해 주세요."
          : "",
        failed,
      );
    };

    const watchFrame = () => {
      const frame = mount.querySelector<HTMLIFrameElement>("iframe");
      if (!frame || frame.dataset.loadBound === "true") return;
      frame.dataset.loadBound = "true";
      frame.addEventListener("load", () => finish(false), { once: true });
      frame.addEventListener("error", () => finish(true), { once: true });
    };
    this.observer = new MutationObserver(watchFrame);
    this.observer.observe(mount, { childList: true, subtree: true });
    this.timeout = setTimeout(() => finish(true), LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    for (const { name, value } of source.attributes) {
      script.setAttribute(name, value);
    }
    script.dataset.theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    script.addEventListener("load", watchFrame, { once: true });
    script.addEventListener("error", () => finish(true), { once: true });
    this.script = script;
    this.append(script);
  };
}

export function registerGiscusComments() {
  if (!customElements.get("giscus-comments")) {
    customElements.define("giscus-comments", GiscusComments);
  }
}
