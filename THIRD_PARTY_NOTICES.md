# Third-party notices

The wrapper and build scripts are MIT licensed. The WebAssembly binary and generated
AST declarations/schema contain code or information from the LLVM Project, under
Apache-2.0 WITH LLVM-exception. See `licenses/LLVM.txt` and `upstream.json` for the
exact source revision, files and SHA-256 hashes.

The build adds allocation and integer-overflow checks to the Itanium parser,
uses an exception-safe arena/output buffer, and generates access-only friends
for exporting private AST fields. These adaptations are generated in `.build/`;
checksummed upstream sources remain unchanged. `ItaniumDemangle.h` supplies the
parser/AST and `ItaniumDemangle.cpp` supplies the discriminator parser. The AST
serializer and UTF-8 JSON adapter are part of this MIT-licensed wrapper.

The binary is compiled by pinned Emscripten and links its runtime/system libraries.
Redistribute the accompanying notices:

- `licenses/emscripten-LICENSE.txt` and `licenses/emscripten-AUTHORS.txt`:
  Emscripten MIT/University of Illinois/NCSA terms and authors.
- `licenses/libcxx.txt`, `licenses/libcxxabi.txt`, `licenses/libunwind.txt`,
  `licenses/compiler-rt.txt`: LLVM runtime licenses and exceptions.
- `licenses/musl.txt`: musl and included contributors' notices.

All license files are copied from the exact pinned LLVM/Emscripten sources during
the build and checked for inclusion in the final tarball. Keep these notices when
redistributing the generated runtime or WASM asset.
