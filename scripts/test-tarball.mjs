import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { npmCommand } from "./npm-command.mjs";

const pack = JSON.parse(await readFile("pack-result.json"))[0];
const tarball = resolve(pack.filename);
const temporary = await mkdtemp(join(tmpdir(), "llvm-itanium-demangle-"));
async function removeTemporary() {
  if (dirname(await realpath(temporary)) !== await realpath(tmpdir())) {
    throw new Error("Refusing to delete a directory outside the temporary root");
  }
  await rm(temporary, { recursive: true, force: true });
}
try {
  const [command, ...prefix] = npmCommand();
  execFileSync(command, [...prefix, "install", "--offline", "--ignore-scripts", "--no-audit",
    "--no-fund", tarball], { cwd: temporary, stdio: "pipe" });
  await writeFile(join(temporary, "smoke.mjs"), `
    import assert from "node:assert/strict";
    import { createDemangler } from "llvm-itanium-demangle";
    import { readFile } from "node:fs/promises";
    const asset = import.meta.resolve("llvm-itanium-demangle/llvm-itanium-demangle.wasm");
    const api = await createDemangler();
    const result = api.demangleType("N4demo6WidgetE");
    assert.equal(result.status, "success");
    assert.equal(result.ast.nodes[0].kind, "NestedName");
    assert.equal(api.demangle("_Z1fi").ast.nodes[0].kind, "FunctionEncoding");
    assert.equal(api.demangle("?").status, "invalid");
    assert.equal(api.demangleWithText("_Z1fi").text, "f(int)");
    const formatted = api.demangleTypeWithText("N4demo6WidgetE");
    assert.equal(formatted.text, "demo::Widget");
    assert.deepEqual(formatted.ast, result.ast);
    assert.equal(api.demangleWithText("?").text, null);
    assert.equal((await createDemangler({ wasmBinary: await readFile(new URL(asset)) }))
      .demangleType("i").status, "success");
  `);
  execFileSync(process.execPath, ["smoke.mjs"], { cwd: temporary, stdio: "pipe" });
  assert(pack.files.some(file => file.path === "dist/index.d.ts"));
  assert(pack.files.some(file => file.path === "licenses/LLVM.txt"));
} finally {
  await removeTemporary();
}
console.warn(`Installed and tested the exact tarball: ${pack.filename}`);
