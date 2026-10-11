import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemangler } from "../dist/node.js";

const api = await createDemangler();
function find(result, kind) {
  assert.equal(result.status, "success", JSON.stringify(result.warnings));
  const node = result.ast.nodes.find(node => node.kind === kind);
  assert(node, kind);
  return node;
}

// Itanium ABI 5.1 and pinned LLVM ItaniumDemangle.h; expectations are independent.
test("preserves scoped RTTI types and their exact consumption", () => {
  const result = api.demangleType("N4demo6WidgetE");
  assert.deepEqual(result.ast.nodes[0], {
    kind: "NestedName", precedence: "Primary", qual: 1, name: 2,
  });
  assert.equal(result.ast.nodes[1].name, "demo");
  assert.equal(result.ast.nodes[2].name, "Widget");
  assert.equal(result.consumed, 14);
});

test("exports function parameters, qualifiers and absent encoded return types", () => {
  const result = api.demangle("_ZNK4demo6Widget3runEi");
  const root = find(result, "FunctionEncoding");
  assert.deepEqual(root.cvQuals, ["QualConst"]);
  assert.equal(root.refQual, "FrefQualNone");
  assert.equal(root.ret, null);
  assert.equal(result.ast.nodes[root.params[0]].name, "int");
});

test("retains lossless integer literals and nested template arguments", () => {
  const result = api.demangle("_Z1fILy18446744073709551615EEvv");
  assert.equal(find(result, "IntegerLiteral").value, "18446744073709551615");
  // LLVM stores the literal suffix, rather than a second type node, for builtin integers.
  assert.equal(find(result, "IntegerLiteral").type, "ull");
  assert.equal(find(result, "TemplateArgs").params.length, 1);
});

test("retains special names and shared substitution references", () => {
  assert.equal(find(api.demangle("_ZTVN4demo6WidgetE"), "SpecialName").special, "vtable for ");
  const result = api.demangle("_Z1fP1AS0_");
  const root = find(result, "FunctionEncoding");
  assert.equal(root.params[0], root.params[1]);
  assert.equal(find(result, "PointerType").pointee, 3);
});

test("preserves resolved forward template references as graph edges", () => {
  const result = api.demangle("_ZN1AcvPT_IiEEv");
  const reference = find(result, "ForwardTemplateReference");
  assert.equal(reference.index, "0");
  assert.equal(result.ast.nodes[reference.ref].name, "int");
  assert(!Object.hasOwn(reference, "printing"));
});

for (const input of ["", "_Z", "_ZN4demo6Widget", "hello", "_Z1fv!", "4294967297A",
  "_Z1fP1ASZZZZZZZZZZZZZZZZZZZZ_", "_Z1fILi1", "i!",
  // Unmodified pinned LLVM also rejects these real GNU libstdc++ encodings.
  "_ZGTtNKSt11logic_error4whatEv", "_ZTIDF32x", "_ZTIDF64x"]) {
  test("rejects malformed or truncated input " + JSON.stringify(input), () => {
    const result = api.demangle(input);
    assert.equal(result.status, "invalid");
    assert.equal(result.ast, null);
    assert.equal(result.consumed, 0);
    assert(result.warnings.length > 0);
    assert.equal(api.demangle("_Z1fv").status, "success");
  });
}

test("type mode rejects symbols and trailing bytes", () => {
  assert.equal(api.demangleType("_Z1fv").status, "invalid");
  assert.equal(api.demangleType("i!").status, "invalid");
  assert.equal(find(api.demangleType("PKi"), "QualType").quals[0], "QualConst");
});

test("does not impose parser depth or input length policy caps", () => {
  assert.equal(api.demangleType("P".repeat(300) + "i").ast.nodes.length, 301);
  const name = "L".repeat(2 * 1024 * 1024);
  const result = api.demangleType(String(name.length) + name);
  assert.equal(find(result, "NameType").name, name);
  assert.equal(result.consumed, name.length + String(name.length).length);
});

test("supports wide template argument lists and detached instances", async () => {
  const result = api.demangleType("4WideI" + "i".repeat(40000) + "E");
  assert.equal(find(result, "TemplateArgs").params.length, 40000);
  api.demangleType("i");
  assert.equal(find(result, "TemplateArgs").params.length, 40000);
  assert.equal((await createDemangler()).demangleType("i").status, "success");
});
