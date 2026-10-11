import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemangler } from "../dist/node.js";

const api = await createDemangler();
// Pinned ItaniumDemangle.h: FunctionEncoding, SpecialName, PointerType and DotSuffix.
for (const [input, text] of [["_Z1fi", "f(int)"], ["_Z1x", "x"],
  ["_ZTVN4demo6WidgetE", "vtable for demo::Widget"], ["_Z1fv.clone.1", "f() (.clone.1)"]]) {
  test("formats symbols from the same parse: " + input, () => {
    assert.deepEqual(api.demangleWithText(input), { ...api.demangle(input), text });
    assert(!Object.hasOwn(api.demangle(input), "text"));
  });
}
for (const [input, text] of [["N4demo6WidgetE", "demo::Widget"], ["1CIiE", "C<int>"],
  ["i", "int"], ["Pi", "int*"]]) {
  test("formats bare RTTI type encodings: " + input, () => {
    assert.deepEqual(api.demangleTypeWithText(input), { ...api.demangleType(input), text });
  });
}
for (const input of [null, "", "_Z", "hello", "\u00ff", "_Z1fv!"]) {
  test("formatted failures preserve diagnostics: " + JSON.stringify(input), () => {
    assert.deepEqual(api.demangleWithText(input), { ...api.demangle(input), text: null });
    assert.deepEqual(api.demangleTypeWithText(input), { ...api.demangleType(input), text: null });
    assert.equal(api.demangleWithText("_Z1fv").text, "f()");
  });
}
test("native formatting preserves braces and large detached strings", () => {
  assert.equal(api.demangleTypeWithText("8{Widget}").text, "{Widget}");
  const name = "L".repeat(2 * 1024 * 1024);
  const result = api.demangleTypeWithText(String(name.length) + name);
  assert.equal(result.text, name);
  assert.equal(api.demangleTypeWithText("i").text, "int");
  assert.equal(result.text, name);
});
