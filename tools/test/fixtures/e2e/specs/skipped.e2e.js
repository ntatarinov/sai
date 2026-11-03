import { test } from "node:test";

test("skipped one passing test", () => {});

test("skipped one test with the skip option", { skip: true }, () => {});
