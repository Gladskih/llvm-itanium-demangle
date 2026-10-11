export interface Ast {
  root: NodeId;
  nodes: AstNode[];
}
export type DemangleResult = {
  status: "success";
  consumed: number;
  ast: Ast;
  warnings: string[];
} | {
  status: "invalid" | "limit" | "error";
  consumed: number;
  ast: null;
  warnings: string[];
};
/** Adds LLVM's native presentation, preserving success/failure discrimination. */
export type DemangleWithTextResult =
  | (Extract<DemangleResult, { ast: Ast }> & { text: string })
  | (Extract<DemangleResult, { ast: null }> & { text: null });

/** Local WASM loading configuration. Supply bytes for fully offline operation. */
export interface WasmSource {
  wasmBinary?: Uint8Array;
  /** Local file path or file URL in Node; same-origin URL in browsers. */
  wasmURL?: string | URL;
}
export interface Demangler {
  demangle(symbol: string): DemangleResult;
  /** Parse a bare Itanium type encoding, as stored by type_info::name(). */
  demangleType(name: string): DemangleResult;
  /** Return the AST and LLVM's native presentation from one parse. */
  demangleWithText(symbol: string): DemangleWithTextResult;
  /** Return the bare type AST and its native presentation from one parse. */
  demangleTypeWithText(name: string): DemangleWithTextResult;
}
export function createDemangler(source?: WasmSource): Promise<Demangler>;
