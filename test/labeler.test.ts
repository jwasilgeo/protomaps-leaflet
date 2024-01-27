import assert from "assert";
import { test } from "node:test";
import Point from "@mapbox/point-geometry";
import { Index, covering } from "../src/labeler";

test("covering", async () => {
  const result = covering(3, 1024, {
    minX: 256,
    minY: 256 * 2,
    maxX: 256 + 1,
    maxY: 256 * 2 + 1,
  });
  assert.deepEqual(result, [{ display: "1:2:3", key: "0:0:1" }]);
});

test("covering with antimeridian crossing", async () => {
  const result = covering(3, 1024, {
    minX: 2000,
    minY: 256 * 2,
    maxX: 2050,
    maxY: 256 * 2 + 1,
  });
  assert.deepEqual(result, [
    { display: "7:2:3", key: "1:0:1" },
    { display: "0:2:3", key: "0:0:1" },
  ]);
});

test("inserting label into index", async () => {
  const index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  const result = index.searchBbox(
    { minX: 90, maxX: 110, minY: 90, maxY: 110 },
    Infinity,
  );
  assert.equal(result.size, 1);
});

test("inserting label with antimeridian wrapping", async () => {
  let index = new Index(1024);
  index.insert(
    {
      anchor: new Point(1000, 100),
      bboxes: [{ minX: 1000, minY: 100, maxX: 1050, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  let result = index.searchBbox(
    { minX: 0, maxX: 100, minY: 90, maxY: 110 },
    Infinity,
  );
  assert.equal(result.size, 1);

  index = new Index(1024);
  index.insert(
    {
      anchor: new Point(-100, 100),
      bboxes: [{ minX: -100, minY: 100, maxX: 100, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  result = index.searchBbox(
    { minX: 1000, maxX: 1024, minY: 90, maxY: 110 },
    Infinity,
  );
  assert.equal(result.size, 1);
});

test("label with multiple bboxes", async () => {
  const index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [
        { minX: 100, minY: 100, maxX: 110, maxY: 200 },
        { minX: 110, minY: 100, maxX: 120, maxY: 200 },
      ],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  const result = index.searchBbox(
    { minX: 90, maxX: 130, minY: 90, maxY: 110 },
    Infinity,
  );
  assert.equal(result.size, 1);
});

test("label order", async () => {
  const index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    2,
    "abcd",
  );
  let result = index.searchBbox(
    { minX: 90, maxX: 110, minY: 90, maxY: 110 },
    1,
  );
  assert.equal(result.size, 0);
  result = index.searchBbox({ minX: 90, maxX: 110, minY: 90, maxY: 110 }, 3);
  assert.equal(result.size, 1);
});

test("pruning", async () => {
  const index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  assert.equal(index.tree.all().length, 1);
  assert.equal(index.has("abcd"), true);
  index.pruneKey("abcd");
  assert.equal(index.current.size, 0);
  assert.equal(index.tree.all().length, 0);
});

test("tile prefixes", async () => {
  const index = new Index(1024);
  assert.equal(index.hasPrefix("my_key"), false);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "my_key:123",
  );
  assert.equal(index.hasPrefix("my_key"), true);
});

test("remove an individual label", async () => {
  const index = new Index(1024);
  index.insert(
    {
      anchor: new Point(100, 100),
      bboxes: [{ minX: 100, minY: 100, maxX: 200, maxY: 200 }],
      draw: (c) => {},
    },
    1,
    "abcd",
  );
  assert.equal(index.tree.all().length, 1);
  assert.equal(index.current.get("abcd").size, 1);
  const theLabel = index.tree.all()[0].indexedLabel;
  index.removeLabel(theLabel);
  assert.equal(index.current.size, 1);
  assert.equal(index.current.get("abcd").size, 0);
  assert.equal(index.tree.all().length, 0);
});

test("basic label deduplication", async () => {
  const index = new Index(1024);
  const label1 = {
    anchor: new Point(100, 100),
    bboxes: [{ minX: 100, minY: 100, maxX: 110, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };
  index.insert(label1, 1, "abcd");

  const repeatedLabel = {
    anchor: new Point(200, 100),
    bboxes: [{ minX: 200, minY: 100, maxX: 210, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };

  assert.equal(index.deduplicationCollides(repeatedLabel), false);

  const toocloseLabel = {
    anchor: new Point(199, 100),
    bboxes: [{ minX: 199, minY: 100, maxX: 210, maxY: 110 }],
    draw: (c) => {},
    deduplicationKey: "Mulholland Dr.",
    deduplicationDistance: 100,
  };

  assert.equal(index.deduplicationCollides(toocloseLabel), true);
});
