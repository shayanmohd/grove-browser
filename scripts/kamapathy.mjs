#!/usr/bin/env node
import { main } from "../skills/kamapathy/scripts/kamapathy.mjs";

process.exitCode = await main();
