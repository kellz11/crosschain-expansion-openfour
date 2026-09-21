import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
export const ceil = (a, b) => (a + b - 1n) / b;
export function simulate() {
  const U = 10n ** 18n;
  let cases = 0,
    accepted = 0,
    rejected = 0,
    transitions = 0;
  const examples = [];
  for (const deposit of [100n, 10000n, 1000000n, 1000000000n])
    for (const capUsd of [500001n, 1000000n, 100000000n])
      for (const bnbUsd of [100n, 300n, 600n, 1000n, 2000n, 5000n])
        for (const supply of [1000000n, 1000000000n])
          for (const saleBps of [1000n, 3900n, 6500n, 9000n])
            for (const depthBps of [10000n, 20000n, 32500n, 50000n]) {
              cases++;
              const D = deposit * U,
                G = (D * saleBps) / 10000n,
                V = (D * depthBps) / 10000n,
                P = (capUsd * U) / supply / bnbUsd,
                B0 = ceil(P * V, U);
              const F = (x) => ceil(B0 * x, V - x),
                T = (x) => (F(x) * (V - x)) / (B0 + F(x));
              if (V < 2n * G || T(G) > D - G || T(G) === 0n) {
                rejected++;
                continue;
              }
              accepted++;
              let sold = 0n,
                reserve = 0n,
                seed = BigInt(cases);
              for (let i = 0; i < 100; i++) {
                seed = (seed * 48271n) % 2147483647n;
                const buy = seed % 3n !== 0n;
                const bound = buy ? G - sold : sold;
                if (bound === 0n) continue;
                const a = (seed % bound) + 1n,
                  next = sold + (buy ? a : -a),
                  delta = F(next) - F(sold);
                reserve += delta;
                sold = next;
                assert(reserve >= 0n && reserve === F(sold));
                assert(T(sold) <= D - sold);
                transitions++;
              }
              reserve += F(G) - F(sold);
              assert.equal(reserve, F(G));
              assert(T(G) <= D - G);
              if (examples.length < 5)
                examples.push({
                  D: String(D),
                  G: String(G),
                  V: String(V),
                  P: String(P),
                  reserve: String(reserve),
                  lpTokens: String(T(G)),
                });
            }
  const report = {
    cases,
    accepted,
    rejected,
    transitions,
    seed: "case index; Park-Miller 48271",
    claim:
      "Exact integer path-independent reserve conservation and inventory solvency for accepted parameter grid; not oracle accuracy, market demand or DVN security",
    examples,
  };
  fs.mkdirSync("docs/reports", { recursive: true });
  fs.writeFileSync("docs/reports/economics.json", JSON.stringify(report, null, 2));
  console.log(report);
  return report;
}
if (process.argv[1] === path.resolve("scripts/simulate/economics.mjs")) simulate();
