import { describe, it, expect, beforeEach } from "vitest";
import {
  TIMESTAMP_ZONE,
  findTimestampCollisions,
  hasTimestampCollision,
} from "@/lib/timestampZone";
import type { Layer } from "@/state/types";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";

function makeRect(id: string, x: number, y: number, w = 60, h = 30): Layer {
  return {
    id, type: "rect", x, y, width: w, height: h,
    color: 0xff8800, opacity: 1, name: id,
    hidden: false, locked: false,
    blendMode: "normal",
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

describe("Day 27 — timestamp collision detection", () => {
  beforeEach(() => {
    history._reset();
  });

  it("zone matches the documented coords (~bottom-right of 1280×720)", () => {
    expect(TIMESTAMP_ZONE.left).toBe(1218);
    expect(TIMESTAMP_ZONE.right).toBe(1268);
    expect(TIMESTAMP_ZONE.top).toBe(688);
    expect(TIMESTAMP_ZONE.bottom).toBe(710);
  });

  it("layer fully clear of zone → no collision", () => {
    const layers = [makeRect("a", 100, 100, 200, 200)];
    expect(findTimestampCollisions(layers)).toEqual([]);
    expect(hasTimestampCollision(layers)).toBe(false);
  });

  it("layer overlapping the zone is flagged", () => {
    // Bottom-right rect that ends at (1280, 720) — definitely covers
    // the badge zone.
    const colliding = makeRect("hit", 1200, 670, 80, 50);
    expect(findTimestampCollisions([colliding]).map((l) => l.id)).toEqual(["hit"]);
    expect(hasTimestampCollision([colliding])).toBe(true);
  });

  it("layer touching only the corner of the zone counts as a collision", () => {
    // Rect ends exactly at the zone's top-left corner.
    const layer = makeRect("corner", 1200, 670, 19, 19); // ends at 1219, 689 — overlaps by 1px
    expect(hasTimestampCollision([layer])).toBe(true);
  });

  it("layer just OUTSIDE the zone (right edge at zone.left) does not collide", () => {
    // ends at x=1218 == zone.left, no overlap (boundary check uses strict <).
    const layer = makeRect("edge", 1100, 670, 118, 50);
    expect(layer.x + layer.width).toBe(1218);
    expect(hasTimestampCollision([layer])).toBe(false);
  });

  it("hidden layers are skipped even if they cover the zone", () => {
    const ghost = { ...makeRect("ghost", 1200, 680, 80, 40), hidden: true };
    expect(findTimestampCollisions([ghost])).toEqual([]);
  });

  it("multiple colliding layers all return", () => {
    const layers = [
      makeRect("clear", 100, 100),
      makeRect("a", 1220, 690, 30, 15),
      makeRect("b", 1240, 695, 20, 10),
    ];
    const hits = findTimestampCollisions(layers);
    expect(hits.map((l) => l.id).sort()).toEqual(["a", "b"]);
  });

  it("integrates with docStore — adding a colliding layer flips the boolean", () => {
    expect(hasTimestampCollision(useDocStore.getState().layers)).toBe(false);
    history.addLayer(makeRect("badge-blocker", 1230, 695, 30, 15));
    expect(hasTimestampCollision(useDocStore.getState().layers)).toBe(true);
  });
});
