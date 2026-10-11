import { writeFile } from "node:fs/promises";
import { upstreamCases, invalidCases } from "./itanium-corpus.mjs";

const names = (await upstreamCases()).map(([name]) => name);
const expanded = [`65536${"L".repeat(65536)}`, `${"P".repeat(300)}i`,
  `4WideI${"i".repeat(40000)}E`];
const corpus = new Set([...names, ...expanded, ...await invalidCases()]);
for (const name of names) {
  const lengths = name.length < 100 ? Array.from({ length: name.length - 1 }, (_, i) => i + 1)
    : [1, 2, Math.floor(name.length / 2), name.length - 2, name.length - 1];
  for (const length of lengths) corpus.add(name.slice(0, length));
}
let state = 0x5eed;
function random(maximum) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state % maximum;
}
for (let index = 0; index < 20000; ++index) {
  const name = names[random(names.length)];
  const position = random(name.length);
  corpus.add(name.slice(0, position) + String.fromCharCode(0x20 + random(95)) +
    name.slice(position + 1));
}
corpus.add("4294967297A");
corpus.add("_Z1fP1ASZZZZZZZZZZZZZZZZZZZZ_");
await writeFile(".build/fuzz.txt", `${[...corpus].join("\n")}\n`);
await writeFile(".build/upstream-names.json", JSON.stringify([...names, ...expanded]));
await writeFile(".build/upstream-names.txt", `${[...names, ...expanded].join("\n")}\n`);
