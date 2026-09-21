import fs from "node:fs";
import path from "node:path";
import solc from "solc";
export function compile() {
  const sources = {};
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".sol")) sources[p] = { content: fs.readFileSync(p, "utf8") };
    }
  }
  walk("contracts");
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "shanghai",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
    },
  };
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import(p) {
        for (const base of ["", "node_modules/"]) {
          const file = base + p;
          if (fs.existsSync(file)) return { contents: fs.readFileSync(file, "utf8") };
        }
        return { error: `Missing ${p}` };
      },
    }),
  );
  for (const e of output.errors ?? []) console[e.severity === "error" ? "error" : "warn"](e.formattedMessage);
  if (output.errors?.some((e) => e.severity === "error")) throw new Error("Compilation failed");
  fs.mkdirSync("artifacts", { recursive: true });
  const sizes = {};
  for (const [source, cs] of Object.entries(output.contracts))
    for (const [name, c] of Object.entries(cs)) {
      fs.writeFileSync(
        `artifacts/${name}.json`,
        JSON.stringify({ source, contractName: name, ...c }, null, 2),
      );
      if (source.startsWith("contracts/") && c.evm.bytecode.object) {
        sizes[name] = c.evm.deployedBytecode.object.length / 2;
        if (sizes[name] > 24576) throw new Error(`${name} exceeds EIP-170: ${sizes[name]}`);
      }
    }
  fs.writeFileSync(
    "artifacts/build-report.json",
    JSON.stringify({ compiler: solc.version(), sizes }, null, 2),
  );
  console.log(`Compiled ${Object.keys(output.contracts).length} source units using ${solc.version()}`);
  console.log(sizes);
}
if (process.argv[1] === path.resolve("scripts/compile.mjs")) compile();
