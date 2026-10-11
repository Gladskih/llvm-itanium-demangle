import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function upstreamCases() {
  const source = await readFile(new URL(
    "../.build/llvm/libcxxabi/test/DemangleTestCases.inc", import.meta.url), "utf8");
  const entries = [...source.replace(/^\s*\/\/.*$/gm, "").matchAll(
    /\{\s*((?:"(?:[^"\\]|\\.)*"\s*)+),\s*((?:"(?:[^"\\]|\\.)*"\s*)+)\}/g)]
    .map(match => match.slice(1).map(value => [...value.matchAll(/"(?:[^"\\]|\\.)*"/g)]
      .map(token => JSON.parse(token[0])).join("")));
  assert(entries.length > 29000, "Upstream corpus unexpectedly small");
  return entries;
}

export async function invalidCases() {
  const source = await readFile(new URL(
    "../.build/llvm/libcxxabi/test/test_demangle.pass.cpp", import.meta.url), "utf8");
  const section = source.match(/const char\* invalid_cases\[\] = \{([\s\S]*?)\n};/);
  assert(section, "Unrecognized upstream invalid cases");
  return [...section[1].matchAll(/"(?:[^"\\]|\\.)*"/g)]
    .map(match => JSON.parse(match[0].replace(/\\x([0-9A-Fa-f]{2})/g, "\\u00$1")
      .replace(/\\0/g, "\\u0000")));
}
