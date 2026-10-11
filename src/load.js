import createModule from "./llvm-itanium-demangle.js";
import { createApi } from "./core.js";

export async function loadDemangler(wasmBinary) {
  return createApi(await createModule({ wasmBinary, printErr: () => {} }));
}
