#include "arena.h"
#include "json.h"
#include <cassert>
#include <cstring>
#include <limits>

using namespace std::string_view_literals;

static void testUtf8() {
  assert(utf8Length("", 0) == 0);
  assert(utf8Length("A", 1) == 0);
  assert(utf8Length("A", std::numeric_limits<size_t>::max()) == 0);
  assert(utf8Length("A", 0) == 1);
  assert(utf8Length("\xc2\xa2", 0) == 2);
  assert(utf8Length("\xe2\x82\xac", 0) == 3);
  assert(utf8Length("\xf0\x9f\x98\x8a", 0) == 4);
  assert(utf8Length("\x80", 0) == 0);
  assert(utf8Length("\xc0\xaf", 0) == 0);
  assert(utf8Length("\xe0\x80\xaf", 0) == 0);
  assert(utf8Length("\xf0\x80\x80\xaf", 0) == 0);
  assert(utf8Length("\xed\xa0\x80", 0) == 0);
  assert(utf8Length("\xf4\x90\x80\x80", 0) == 0);
  assert(utf8Length("\xf0\x9f", 0) == 0);
  assert(utf8Length("\xe2\x28\xa1", 0) == 0);
  assert(utf8Length("\xf5\x80\x80\x80", 0) == 0);
}

static void testJson() {
  Json out;
  out.string("\xf0\x9f\x98\x8a\xff\0\"\\"sv);
  assert(out.result() == "\"\xf0\x9f\x98\x8a\\u00ff\\u0000\\u0022\\u005c\"");
}

static void testArena() {
  Arena arena;
  const auto *first = arena.makeNode<size_t>(42);
  std::memset(arena.allocateNodeArray(65536), 0, 65536 * sizeof(void *));
  assert(*first == 42);
  assert(reinterpret_cast<uintptr_t>(arena.allocate(1)) % alignof(std::max_align_t) == 0);
  assert(checkedMultiply(0, std::numeric_limits<size_t>::max()) == 0);
  try { arena.allocate(std::numeric_limits<size_t>::max()); assert(false); }
  catch (const std::bad_alloc &) {}
  try { arena.allocateNodeArray(std::numeric_limits<size_t>::max()); assert(false); }
  catch (const std::bad_alloc &) {}
  arena.reset();
  assert(*arena.makeNode<size_t>(17) == 17);
}

int main() { testUtf8(); testJson(); testArena(); }
