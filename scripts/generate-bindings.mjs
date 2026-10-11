// Clang supplies fields, access locations and enums; never reverse-parse printed names.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const dumps = (await readFile(process.argv[2], "utf8")).trim().split(/\n(?=\{)/)
  .map(text => JSON.parse(text));
const namespace = dumps.find(node => node.inner?.some(child => child.name === "ManglingParser"));
assert.equal(namespace?.name, "itanium_demangle");
function descendants(node) { return [node, ...(node.inner ?? []).flatMap(descendants)]; }
const records = new Map(descendants(namespace).filter(node =>
  node.kind === "CXXRecordDecl" && node.completeDefinition).map(node => [node.name, node]));
const base = records.get("Node");
assert.deepEqual(base.inner.filter(node => node.kind === "FieldDecl").map(node => node.name),
  ["K", "Precedence", "RHSComponentCache", "ArrayCache", "FunctionCache"],
  "Base fields need an explicit serialization policy");
const kinds = base.inner.find(node => node.name === "Kind").inner
  .filter(node => node.kind === "EnumConstantDecl").map(node => node.name.slice(1));
const enums = namespace.inner.filter(node => node.kind === "EnumDecl");
enums.push(base.inner.find(node => node.name === "Prec"));
const types = ["// Generated from the pinned LLVM header by Clang. Do not edit.",
  "export type NodeId = number;"];
const cpp = [];
const schema = { nodes: {}, enums: {} };

function enumValue(node) {
  if (node.kind === "ConstantExpr" && node.value !== undefined) return Number(node.value);
  return (node.inner ?? []).map(enumValue).find(value => value !== undefined);
}

function emitEnum(declaration) {
  let previous = -1;
  const members = declaration.inner.filter(node => node.kind === "EnumConstantDecl")
    .map(node => ({ name: node.name, value: previous = enumValue(node) ?? previous + 1 }));
  const name = declaration.name;
  const nativeType = name === "Prec" ? "Node::Prec" : name;
  schema.enums[name] = members;
  types.push(`export type ${name} = ${name === "Qualifiers" ? "ReadonlyArray<" : ""}` +
    members.map(member => JSON.stringify(member.name)).join(" | ") +
    `${name === "Qualifiers" ? ">" : ""};`);
  cpp.push(`[[maybe_unused]] static void writeEnum(Json &out, ${nativeType} value) {`);
  if (name === "Qualifiers") {
    cpp.push("out.raw(\"[\"); bool separator = false;");
    for (const member of members.filter(member => member.value !== 0)) {
      assert.equal(member.value & (member.value - 1), 0, "Unreviewed composite qualifier");
      cpp.push(`if (value & ${member.name}) { if (separator) out.raw(",");` +
        ` out.string("${member.name}"); separator = true; }`);
    }
    cpp.push("out.raw(\"]\");");
  } else {
    cpp.push("switch (value) {");
    members.forEach(member => cpp.push(
      `case ${nativeType}::${member.name}: out.string("${member.name}"); return;`));
    cpp.push("} throw InvalidAst{};");
  }
  cpp.push("}");
}

function property(name) {
  return name.replace(/^[A-Z]+(?=[A-Z][a-z]|$)/, prefix => prefix.toLowerCase())
    .replace(/^[A-Z]/, prefix => prefix.toLowerCase());
}

function describe(field) {
  const type = field.type.qualType.replace(/^const /, "");
  const value = `value->${field.name}`;
  if (/^(Node|ModuleName) \*$/.test(type)) {
    return { type: "NodeId | null", code: `graph.reference(out, ${value});` };
  }
  if (type === "NodeArray") return { type: "Array<NodeId | null>",
    code: `graph.array(out, ${value});` };
  if (enums.some(node => node.name === type)) return { type, code: `writeEnum(out, ${value});` };
  if (type === "std::string_view") return { type: "string", code: `out.string(${value});` };
  if (type === "bool") return { type: "boolean", code: `out.boolean(${value});` };
  if (type === "size_t") return { type: "string", code: `out.string(std::to_string(${value}));` };
  if (type === "int" || type === "unsigned int") {
    return { type: "number", code: `out.number(${value});` };
  }
  throw new Error(`Unreviewed LLVM AST field: ${field.name}: ${type}`);
}

function recordFor(kind) {
  const record = records.get(/^(Float|Double|LongDouble)Literal$/.test(kind)
    ? "FloatLiteralImpl" : kind);
  assert(record, `Unmapped LLVM NodeKind: ${kind}`);
  return record;
}

function fields(record) {
  if (record.name === "Node") return [];
  return [...record.bases.flatMap(base => {
    assert(records.has(base.type.qualType), `Unreviewed base: ${base.type.qualType}`);
    return fields(records.get(base.type.qualType));
  }), ...record.inner.filter(node => node.kind === "FieldDecl")];
}

function emitNode(kind) {
  const record = recordFor(kind);
  cpp.push(`case Node::K${kind}: {`,
    `const auto *value = static_cast<const ${kind} *>(node);`,
    `out.key("kind"); out.string("${kind}");`,
    "out.key(\"precedence\"); writeEnum(out, value->getPrecedence());");
  const properties = ["  precedence: Prec;"];
  for (const field of fields(record)) {
    // Mutable recursion guards describe presentation state, not syntax.
    if (field.mutable) {
      assert.equal(field.name, "Printing", "Unreviewed mutable AST field");
      continue;
    }
    const name = field.name === "Kind" ? "nodeKind" : property(field.name);
    const info = describe(field);
    properties.push(`  ${name}: ${info.type};`);
    cpp.push(`out.key("${name}"); ${info.code}`);
  }
  cpp.push("return; }");
  schema.nodes[kind] = properties;
  types.push(`export interface ${kind}Node {`, `  kind: "${kind}";`, ...properties, "}");
}

enums.forEach(emitEnum);
cpp.push("namespace llvm::itanium_demangle {",
  "struct AstAccess { static void write(Graph &graph, Json &out, const Node *node) {",
  "switch (node->getKind()) {");
kinds.forEach(emitNode);
cpp.push("} throw InvalidAst{}; } }; }");
types.push(`export type AstNode = ${kinds.map(kind => `${kind}Node`).join(" | ")};`);
const header = await readFile(".build/llvm/llvm/include/llvm/Demangle/ItaniumDemangle.h", "utf8");
// Access-only friends preserve layout, parser behavior and every private semantic field.
const insertions = [...new Set(kinds.map(kind => recordFor(kind).range.begin.offset))]
  .map(offset => header.indexOf("{", offset) + 1).sort((left, right) => right - left);
let accessible = header;
for (const position of insertions) {
  assert(position > 0, "Unrecognized LLVM record location");
  accessible = accessible.slice(0, position) + "\nfriend struct AstAccess;\n" +
    accessible.slice(position);
}
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/ast-fields.inc", cpp.join("\n"));
await writeFile("artifacts/ast.d.ts", `${types.join("\n")}\n`);
await writeFile("artifacts/ast-schema.json", `${JSON.stringify(schema, null, 2)}\n`);
await writeFile("artifacts/ItaniumDemangle.h", accessible);
console.warn(`Generated ${kinds.length} node kinds from Clang's LLVM AST.`);
