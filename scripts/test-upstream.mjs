import assert from "node:assert/strict";
import { createDemangler } from "../dist/node.js";
import { upstreamCases, invalidCases } from "./itanium-corpus.mjs";

const api = await createDemangler();
const kinds = new Set();
let damaged = 0;
const cases = await upstreamCases();
for (const [name, text] of cases) {
  const result = api.demangle(name);
  assert.equal(result.status, "success", `${name}: ${result.warnings}`);
  assert.equal(result.consumed, Buffer.byteLength(name));
  assert.deepEqual(api.demangleWithText(name), { ...result, text }, name);
  for (const node of result.ast.nodes) kinds.add(node.kind);
  // Each upstream name is truncated at both ends and its midpoint; short names exhaust prefixes.
  const lengths = name.length < 100 ? Array.from({ length: name.length - 1 }, (_, i) => i + 1)
    : [1, 2, Math.floor(name.length / 2), name.length - 2, name.length - 1];
  for (const length of lengths) {
    const input = name.slice(0, length);
    assert.notEqual(api.demangle(input).status, "error", input);
    assert.notEqual(api.demangleWithText(input).status, "error", input);
    damaged++;
  }
}
for (const input of await invalidCases()) {
  assert.equal(api.demangle(input).status, "invalid", input);
  assert.equal(api.demangleWithText(input).text, null, input);
}
assert(kinds.size >= 70, `Unexpected node coverage: ${[...kinds]}`);
assert.equal(api.demangle("_Z1fv").status, "success");
console.warn(`${cases.length} LLVM expected presentations, ${damaged} truncations; ` +
  `${kinds.size} node kinds.`);
