import { test } from "node:test";

test("fail one test that throws", () => {
  throw new Error("fixture failure");
});
