import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, `Unrecognized upstream code: ${before}`);
  return source.replace(before, after);
}

function prepareVector(source) {
  source = replaceOnce(source, "size_t S = size();",
    "size_t S = size();\n    const size_t Bytes = checkedMultiply(NewCap, sizeof(T));");
  source = replaceOnce(source, "std::malloc(NewCap * sizeof(T))", "std::malloc(Bytes)");
  source = replaceOnce(source,
    `First = static_cast<T *>(std::realloc(First, NewCap * sizeof(T)));
      if (First == nullptr)
        std::abort();`,
    `auto *Replacement = static_cast<T *>(std::realloc(First, Bytes));
      if (Replacement == nullptr) throw std::bad_alloc{};
      First = Replacement;`);
  source = replaceOnce(source, "std::abort();", "throw std::bad_alloc{};");
  return replaceOnce(source, "reserve(size() * 2);", "reserve(checkedMultiply(size(), 2));");
}

function prepareUtility(source) {
  source = replaceOnce(source, "size_t Need = N + CurrentPosition;",
    "size_t Need = checkedAdd(N, CurrentPosition);");
  source = replaceOnce(source, "Need += 1024 - 32;", "Need = checkedAdd(Need, 1024 - 32);");
  source = replaceOnce(source, "BufferCapacity *= 2;",
    "if (BufferCapacity <= std::numeric_limits<size_t>::max() / 2) BufferCapacity *= 2;");
  source = replaceOnce(source,
    `Buffer = static_cast<char *>(std::realloc(Buffer, BufferCapacity));
      if (Buffer == nullptr)
        std::abort();`,
    `char *Replacement = static_cast<char *>(std::realloc(Buffer, BufferCapacity));
      if (Replacement == nullptr) throw std::bad_alloc{};
      Buffer = Replacement;`);
  return `#include "safety.h"\n${source}`;
}

function prepareIndices(source) {
  // ItaniumDemangle.h: lengths use base 10 and substitution sequence IDs use base 36.
  source = replaceOnce(source, "*Out *= 10;",
    `if (*Out > (std::numeric_limits<size_t>::max() - (look() - '0')) / 10)
      return true;
    *Out *= 10;`);
  source = replaceOnce(source, "Id *= 36;\n      Id += static_cast<size_t>(look() - '0');",
    `if (Id > (std::numeric_limits<size_t>::max() - (look() - '0')) / 36) return true;
      Id = Id * 36 + static_cast<size_t>(look() - '0');`);
  source = replaceOnce(source, "Id *= 36;\n      Id += static_cast<size_t>(look() - 'A') + 10;",
    `if (Id > (std::numeric_limits<size_t>::max() - (look() - 'A') - 10) / 36) return true;
      Id = Id * 36 + static_cast<size_t>(look() - 'A') + 10;`);
  assert.equal(source.split("++Index;").length, 3);
  source = source.replaceAll("++Index;",
    "if (Index == std::numeric_limits<size_t>::max()) return nullptr;\n  ++Index;");
  return replaceOnce(source, "++Level;",
    "if (Level == std::numeric_limits<size_t>::max()) return nullptr;\n    ++Level;");
}

await mkdir(".build/guarded/llvm", { recursive: true });
await cp(".build/llvm/llvm/include/llvm/Demangle", ".build/guarded/llvm/Demangle",
  { recursive: true });
await writeFile(".build/guarded/llvm/Demangle/ItaniumDemangle.h", "#include \"safety.h\"\n" +
  prepareIndices(prepareVector(await readFile("artifacts/ItaniumDemangle.h", "utf8"))));
await writeFile(".build/guarded/llvm/Demangle/Utility.h", prepareUtility(await readFile(
  ".build/llvm/llvm/include/llvm/Demangle/Utility.h", "utf8")));
const implementation = await readFile(".build/llvm/llvm/lib/Demangle/ItaniumDemangle.cpp", "utf8");
const discriminator = implementation.match(
  /const char \*itanium_demangle::parse_discriminator[\s\S]*?\n}\n/);
assert(discriminator, "Unrecognized upstream discriminator implementation");
await writeFile(".build/discriminator.cpp", "#include \"llvm/Demangle/ItaniumDemangle.h\"\n" +
  "using namespace llvm;\n" + discriminator[0]);
console.warn("Prepared LLVM allocation overflow checks and exception-safe buffers.");
