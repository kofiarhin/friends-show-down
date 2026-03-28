const { generateId } = require("./generateId");

describe("generateId", () => {
  it("returns a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("returns a 6-character ID by default", () => {
    expect(generateId()).toHaveLength(6);
  });

  it("generates unique values across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBeGreaterThan(90);
  });
});
