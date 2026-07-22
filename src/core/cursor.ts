// Stage cursor — HUD reticle in combat, select pointer on chrome.
// Only meaningful on fine-pointer desktops; touch leaves the OS cursor alone.

import { assetUrl } from "./assetUrl";
import { desktopPlayable } from "./platform";

export type CursorKind = "aim" | "select" | "auto";

const CSS: Record<CursorKind, string> = {
  aim: `url('${assetUrl('cursors/aim.png')}') 15 15, crosshair`,
  select: `url('${assetUrl('cursors/select.png')}') 15 15, pointer`,
  auto: "",
};

let current: CursorKind | null = null;

/** Apply a cursor to #stage. No-ops when the kind is unchanged. */
export function setStageCursor(kind: CursorKind): void {
  if (!desktopPlayable()) {
    kind = "auto";
  }
  if (kind === current) return;
  current = kind;
  const stage = document.getElementById("stage");
  if (stage) stage.style.cursor = CSS[kind];
}
