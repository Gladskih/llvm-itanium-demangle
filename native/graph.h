#pragma once
#include "json.h"
#include "llvm/Demangle/ItaniumDemangle.h"
#include <unordered_map>
#include <vector>

using namespace llvm::itanium_demangle;

class Graph {
  std::vector<const Node *> nodes;
  std::unordered_map<const Node *, size_t> identifiers;
public:
  void reference(Json &out, const Node *node) {
    if (!node) { out.raw("null"); return; }
    auto entry = identifiers.find(node);
    if (entry != identifiers.end()) { out.number(entry->second); return; }
    const size_t index = nodes.size();
    identifiers.emplace(node, index);
    nodes.push_back(node);
    out.number(index);
  }
  void array(Json &out, NodeArray values) {
    if (values.size() && !values.begin()) throw InvalidAst{};
    out.raw("[");
    for (size_t index = 0; index < values.size(); ++index) {
      if (index) out.raw(",");
      reference(out, values[index]);
    }
    out.raw("]");
  }
  void write(Json &out, const Node *root);
};
