# llvm-itanium-demangle

LLVM's Itanium C++ demangler compiled to WebAssembly, with a structured AST for
local analysis. Supports mangled symbols and bare type encodings returned by
`type_info::name()`. Includes prebuilt WASM and TypeScript declarations for Node,
browsers and module workers. No runtime dependencies or installation scripts.

```sh
npm install llvm-itanium-demangle
```

```js
import { createDemangler } from "llvm-itanium-demangle";

const demangler = await createDemangler();
const symbol = demangler.demangle("_Z1fi");
// symbol.ast.nodes[symbol.ast.root].kind === "FunctionEncoding"
// The return type is null when the ABI does not encode it.

const type = demangler.demangleType("N4demo6WidgetE");
// Root: NestedName, with references to NameType nodes "demo" and "Widget".

const display = demangler.demangleWithText("_Z1fi");
// { ...symbol, text: "f(int)" }
const typeDisplay = demangler.demangleTypeWithText("N4demo6WidgetE");
// { ...type, text: "demo::Widget" }
```

## API and AST

`createDemangler({ wasmBinary?, wasmURL? }?)` returns a promise for an isolated instance.
Its four synchronous methods are:

- `demangle(name)`: LLVM's full mangled-name grammar, including bare types and extensions.
- `demangleType(name)`: bare type grammar only; rejects symbol encodings such as `_Z1fv`.
- `demangleWithText(name)`: symbol AST and LLVM's native presentation from one parse.
- `demangleTypeWithText(name)`: bare type AST and presentation from one parse.

Analysis methods never call the presentation formatter. Their result is either
`{ status: "success", consumed, ast: { root, nodes }, warnings: [] }`, or
`{ status: "invalid" | "limit" | "error", consumed: 0, ast: null, warnings: [...] }`.
Formatted methods add `text: string` on success and `text: null` on failure.

`consumed` counts UTF-8 bytes. Inputs must be well-formed Unicode with no ASCII
control characters, DEL or embedded NUL. Encoded source-name lengths count bytes,
not JavaScript UTF-16 code units: `demangleWithText("_Z2Ãâ‚¬v").text === "Ãâ‚¬()"`.
LLVM requires complete input consumption. Unsupported suffixes are invalid;
supported clone suffixes are preserved as `DotSuffix` AST nodes.

AST references are numeric indexes into `nodes`; null represents an absent child.
Shared substitutions and resolved forward template references retain their identity.
Serialization traverses the graph iteratively and preserves every semantic field of
all 89 pinned LLVM node kinds. TypeScript provides a discriminated `AstNode` union;
`dist/ast-schema.json` describes the fields. Node precedence is preserved; printing
recursion guards and derived rendering caches are omitted. LLVM fields named `Kind`
are exposed as `nodeKind` to avoid colliding with the node discriminator.

Integer literal digits, offsets, counts and floating-point bit encodings remain
strings where LLVM stores strings. Native `size_t` fields are decimal strings;
32-bit integer fields are numbers. No conversion through lossy JavaScript numbers
or parsing of demangled display text is used. LLVM sometimes stores literal type
suffixes (for example `"ull"`) rather than a separate type node.

The WASM target uses 128-bit `long double`, so long-double literals follow that LLVM
target's 32-hex-digit encoding. An x87 80-bit encoding is rejected. ASTs and text are
detached from WASM memory and remain usable after subsequent calls.

LLVM also rejects GNU transactional clone names (`_ZGTt...`) and the `DF32x`/`DF64x`
extended floating-point type encodings found in current libstdc++ exports. These
return `invalid` with diagnostics; the package does not guess their ASTs or text.

## Browser and offline use

Node loads the neighboring WASM file from disk. Browsers fetch it from the module's
neighboring URL. Both accept explicit bytes for fully offline use. With Vite:

```js
import { createDemangler } from "llvm-itanium-demangle";
import wasmURL from "llvm-itanium-demangle/llvm-itanium-demangle.wasm?url";
const demangler = await createDemangler({ wasmURL });
```

Serve the WASM with `Content-Type: application/wasm`. A tested CSP is
`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'`.
No external services, eval, runtime compilation tools or network analysis are involved.
Initialization failures reject the promise. Parse failures return diagnostics; fatal
WASM traps quarantine the instance, with a warning to create a fresh demangler.

There are no policy caps on input length, depth, work, node count, allocations or
output. Arithmetic and buffer bounds are checked against the actual address space.
WASM memory can grow up to wasm32's 4 GiB ceiling, subject to host memory. LLVM's
recursive parser/printer has a finite stack; exhaustion may trap. Applications that
need a time budget for untrusted names should use a terminable worker.

## Build and verification

Linux/WSL: Node 24+, Git, Python 3 and host Clang++ for ASan/UBSan. Emscripten is
installed by the build, or supplied through `EMSDK_ROOT` at the exact pinned commit.

```sh
npm ci
npm run build:wasm
npm run test:native
npm run test:differential
npx playwright install --with-deps chromium
npm run verify
npm run pack:verified
```

`upstream.json` pins LLVM 23.1.3 and Emscripten 4.0.23, including per-file SHA-256.
`build-info.json` records those pins, the wrapper commit and artifact hashes.
Clang generates bindings and access-only friend declarations; unrecognized fields,
base layouts and safety-patch insertion points fail closed. Generated patches check
allocation arithmetic, source-name lengths, substitution indexes and template indexes,
and make temporary output/vector allocations exception-safe. Upstream files stay intact.

Verification checks 100% JS line/branch/function coverage, focused mutations, all
29,928 upstream expected presentations, truncated inputs, ASan/UBSan malformed-name
cases, strict CSP/offline/worker browser operation and an offline tarball install.
Differential verification compiles LLVM's unmodified public demangler for the same
WASM target, independently of the wrapper's parser allocator and serialization.
Native sanitizer testing separately exercises the host build.

Update pins with `npm run upstream:update -- llvmorg-X.Y.Z`, rebuild and repeat all
gates. CI checks the exact tarball on Linux and Windows, Node 24 and 26. Tag releases
publish that tested artifact with npm Trusted Publishing and provenance. Configure:

```sh
npm trust github llvm-itanium-demangle --repo Gladskih/llvm-itanium-demangle \
  --file publish.yml --allow-publish --yes
```

For the first release, an authenticated maintainer can publish the verified tarball
with `npm publish llvm-itanium-demangle-0.1.0.tgz --ignore-scripts --access public`.

## Sources and licenses

- [Pinned Itanium parser and AST](https://github.com/llvm/llvm-project/blob/0d261d1ca552c95a8f007e061c787ac7132fbcbc/llvm/include/llvm/Demangle/ItaniumDemangle.h)
- [Pinned LLVM public demangler](https://github.com/llvm/llvm-project/blob/0d261d1ca552c95a8f007e061c787ac7132fbcbc/llvm/lib/Demangle/ItaniumDemangle.cpp)
- [Upstream expected cases](https://github.com/llvm/llvm-project/blob/0d261d1ca552c95a8f007e061c787ac7132fbcbc/libcxxabi/test/DemangleTestCases.inc)
- [Itanium C++ ABI](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)

Wrapper: MIT. LLVM/generated artifacts: Apache-2.0 WITH LLVM-exception.
Redistribute [third-party notices](THIRD_PARTY_NOTICES.md) and `licenses/`.

## Release maintenance

GitHub releases are idempotent: existing asset SHA-256 digests must match the tested
files. A matching published release is left intact; interrupted drafts receive only
missing assets before publication. Conflicting or incomplete published releases fail
without overwriting files, including when release immutability is enabled.

The upstream watcher checks the primary source library weekly. It makes only metadata
requests until a newer stable release is found; RC/nightly releases and downgrades
are rejected. Unchanged or previously attempted candidates do not start another build.
Run **Check upstream release** with `check_only: true` to inspect availability.

An update pins the release commit and fresh source hashes, reserves the next npm
compatibility line (minor for 0.x, major for 1.0+), and dispatches the normal publish
workflow on an isolated candidate branch. That workflow runs the complete existing
build/test/package gate before merging a PR, creating the version tag and publishing
the exact tested archive with npm OIDC/provenance. Source/schema or license changes
that fail CI stop publication; fix the candidate and rerun its publish workflow.
If main advances, rebase and recheck the candidate. Toolchain pins (Emscripten, Rust,
Binaryen, wasm-bindgen and build helpers) remain independent of this library watcher.

No cross-repository webhook or persistent publisher token is required. GitHub may
disable scheduled workflows in inactive public repositories; re-enable the watcher
if GitHub notifies you of inactivity. Failed candidates remain available for diagnosis.
