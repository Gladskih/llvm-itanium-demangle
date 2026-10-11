// Independent LLVM entry point: unmodified parser/allocator/printer, same WASM target ABI.
#include "llvm/Demangle/Demangle.h"
#include <cstdlib>
#include <iostream>
#include <string>
#include <string_view>

static std::string result;
static std::string hex(std::string_view bytes) {
  const char digits[] = "0123456789abcdef";
  std::string text;
  for (unsigned char byte : bytes) {
    text += digits[byte >> 4];
    text += digits[byte & 15];
  }
  return text.empty() ? "-" : text;
}

extern "C" const char *oracle(const char *name, size_t length) {
  char *text = llvm::itaniumDemangle(std::string_view(name, length));
  result = text ? "success " + std::to_string(length) + " " + hex(text) : "invalid 0 -";
  std::free(text);
  return result.c_str();
}
extern "C" size_t oracle_size() { return result.size(); }

#ifndef __EMSCRIPTEN__
int main() {
  std::string input;
  while (std::getline(std::cin, input)) std::cout << oracle(input.data(), input.size()) << "\n";
}
#endif
