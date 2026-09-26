#!/usr/bin/env node
import { main } from "../skills/kamapathy/scripts/kamapathy.mjs";

// No top level await: a script whose work never settles must end with the
// failing code, not Node's unsettled await warning.
process.exitCode = 1;
main().then((code) => {
  process.exitCode = code;
});
