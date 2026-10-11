#pragma once
#include "safety.h"
#include <algorithm>
#include <memory>
#include <utility>
#include <vector>

// LLVM's parser allocates nodes and arrays with one parse lifetime. No policy caps.
class Arena {
  alignas(std::max_align_t) char initial[4096];
  std::vector<std::unique_ptr<char[]>> blocks;
  char *current = initial;
  size_t remaining = sizeof(initial);
public:
  void reset() {
    blocks.clear();
    current = initial;
    remaining = sizeof(initial);
  }
  void *allocate(size_t size) {
    constexpr size_t alignment = alignof(std::max_align_t);
    size = checkedAdd(size, alignment - 1) / alignment * alignment;
    if (size > remaining) {
      const size_t capacity = std::max(size, sizeof(initial));
      blocks.push_back(std::make_unique<char[]>(capacity));
      current = blocks.back().get();
      remaining = capacity;
    }
    char *result = current;
    current += size;
    remaining -= size;
    return result;
  }
  template <class Type, class... Parameters> Type *makeNode(Parameters &&...parameters) {
    return new (allocate(sizeof(Type))) Type(std::forward<Parameters>(parameters)...);
  }
  void *allocateNodeArray(size_t count) {
    return allocate(checkedMultiply(count, sizeof(void *)));
  }
};
