import type { APIRoute } from "astro";
import { SITE } from "@consts";
import { brandLockup, h, ogCanvas, pngResponse, renderOgPng } from "@lib/og";

const muted = "rgba(250,250,250,0.6)";

export const GET: APIRoute = async () =>
  pngResponse(
    await renderOgPng(
      ogCanvas(
        "96px 96px 80px",
        h("div", { style: { display: "flex" } }),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 36 } },
          brandLockup(132, 104),
          h(
            "div",
            { style: { display: "flex", color: muted, fontSize: 36 } },
            `${SITE.AUTHOR} · 소프트웨어 엔지니어링 기록`,
          ),
        ),
        h(
          "div",
          { style: { display: "flex", color: "#9dbbe3", fontSize: 28 } },
          new URL(SITE.URL).hostname,
        ),
      ),
    ),
  );
