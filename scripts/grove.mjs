#!/usr/bin/env node
import { main } from "../skills/grove-browser/scripts/grove.mjs";

process.exitCode = await main();
