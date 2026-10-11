#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/fuzz-corpus.mjs
clang++ -std=c++17 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined -fno-sanitize-recover=all -I native \
  native/safety-test.cpp -o .build/safety-native
ASAN_OPTIONS=detect_leaks=1 .build/safety-native
clang++ -std=c++17 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined -fno-sanitize-recover=all \
  -I .build/guarded -I .build/llvm/llvm/include -I native -I artifacts \
  native/bridge.cpp native/fuzz-driver.cpp .build/discriminator.cpp \
  -o .build/fuzz-native
ASAN_OPTIONS=detect_leaks=1 .build/fuzz-native < .build/fuzz.txt
