import { describe, expect, it } from "vitest";
import { gridMove, menuKeyTarget } from "../src/lib/navigation";

describe("menu keys", () => {
  it("wraps with the arrow keys and jumps with Home and End", () => {
    expect(menuKeyTarget(-1, 4, "ArrowDown")).toBe(0);
    expect(menuKeyTarget(3, 4, "ArrowDown")).toBe(0);
    expect(menuKeyTarget(0, 4, "ArrowUp")).toBe(3);
    expect(menuKeyTarget(-1, 4, "ArrowUp")).toBe(3);
    expect(menuKeyTarget(2, 4, "Home")).toBe(0);
    expect(menuKeyTarget(0, 4, "End")).toBe(3);
  });
  it("ignores other keys and empty menus", () => {
    expect(menuKeyTarget(1, 4, "Enter")).toBeUndefined();
    expect(menuKeyTarget(-1, 0, "ArrowDown")).toBeUndefined();
  });
});

describe("grid keys", () => {
  it("moves by one across and by a row up and down, staying inside the grid", () => {
    expect(gridMove(1, 7, 3, "ArrowRight")).toBe(2);
    expect(gridMove(1, 7, 3, "ArrowLeft")).toBe(0);
    expect(gridMove(0, 7, 3, "ArrowLeft")).toBe(0);
    expect(gridMove(1, 7, 3, "ArrowDown")).toBe(4);
    expect(gridMove(5, 7, 3, "ArrowDown")).toBe(6);
    expect(gridMove(4, 7, 3, "ArrowUp")).toBe(1);
    expect(gridMove(3, 7, 3, "Home")).toBe(0);
    expect(gridMove(3, 7, 3, "End")).toBe(6);
  });
  it("ignores other keys", () => {
    expect(gridMove(0, 7, 3, "Enter")).toBeUndefined();
  });
});
