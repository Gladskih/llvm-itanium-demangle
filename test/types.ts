import { createDemangler, type AstNode, type DemangleResult,
  type DemangleWithTextResult } from "llvm-itanium-demangle";

const api = await createDemangler();
const result: DemangleResult = api.demangleType("N4demo6WidgetE");
if (result.ast) {
  const node: AstNode = result.ast.nodes[result.ast.root]!;
  if (node.kind === "NameType") {
    const tag: string = node.name;
    void tag;
  }
  if (node.kind === "IntegerLiteral") {
    const magnitude: bigint = BigInt(node.value);
    void magnitude;
  }
  // @ts-expect-error The discriminated union must reject nonexistent fields.
  void node.nonexistent;
}
// @ts-expect-error Symbol API accepts strings.
api.demangle(1);

const formatted: DemangleWithTextResult = api.demangleWithText("_Z1fi");
if (formatted.ast) {
  const text: string = formatted.text;
  const node: AstNode = formatted.ast.nodes[formatted.ast.root]!;
  void [text, node];
} else {
  const text: null = formatted.text;
  const ast: null = formatted.ast;
  void [text, ast];
}
const type = api.demangleTypeWithText("i");
if (type.ast) {
  const text: string = type.text;
  void text;
}
// @ts-expect-error Analysis-only results do not carry presentation text.
void result.text;
// @ts-expect-error Formatted methods have no boolean formatting flag.
api.demangleWithText("_Z1fi", true);
