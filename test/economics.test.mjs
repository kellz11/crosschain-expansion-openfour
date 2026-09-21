import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../scripts/simulate/economics.mjs";
test("deterministic multi-parameter integer economics sweep", () => {
  const r = simulate();
  assert(r.accepted > 1000);
  assert(r.rejected > 0);
  assert(r.transitions > 100000);
});
