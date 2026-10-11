import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDemangler } from "../dist/node.js";
import createOracle from "../.build/oracle.js";

const names = JSON.parse(await readFile(".build/upstream-names.json"));
const oracle = await createOracle({ wasmBinary: await readFile(".build/oracle.wasm") });
function expectedResult(name) {
  const bytes = new TextEncoder().encode(name);
  const address = oracle._malloc(bytes.length + 1);
  assert(address > 0, "Oracle input allocation failed");
  try {
    oracle.HEAPU8.set(bytes, address);
    oracle.HEAPU8[address + bytes.length] = 0;
    const result = oracle._oracle(address, bytes.length);
    return new TextDecoder().decode(oracle.HEAPU8.subarray(result, result + oracle._oracle_size()));
  } finally {
    oracle._free(address);
  }
}
const api = await createDemangler();
for (let index = 0; index < names.length; ++index) {
  const result = api.demangle(names[index]);
  const [status, consumed, symbol] = expectedResult(names[index]).split(" ");
  assert.equal(`${result.status} ${result.consumed}`, `${status} ${consumed}`, names[index]);
  const formatted = api.demangleWithText(names[index]);
  assert.deepEqual(formatted, { ...result,
    text: result.ast ? Buffer.from(symbol === "-" ? "" : symbol, "hex").toString("utf8") : null,
  }, names[index]);
  if (!/^_/.test(names[index])) {
    assert.deepEqual(api.demangleTypeWithText(names[index]), {
      ...api.demangleType(names[index]),
      text: result.ast ? Buffer.from(symbol, "hex").toString("utf8") : null,
    }, names[index]);
  }
}
console.warn(`${names.length} WASM results and native presentations match unmodified LLVM.`);
