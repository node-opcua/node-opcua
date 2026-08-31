#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

// Get the path to the scan-dependencies package
const scanDepsPath = path.join(import.meta.dirname, "scan-dependencies");

// Forward all command line arguments
const args = process.argv.slice(2);

// Run the scan-dependencies tool
const child = spawn("node", [path.join(scanDepsPath, "dist", "index.js"), ...args], {
    stdio: "inherit",
    cwd: scanDepsPath
});

child.on("error", (error) => {
    console.error("Error running scan-dependencies:", error.message);
    console.log("\nMake sure to build the tool first:");
    console.log("cd tools/scan-dependencies && npm install && npm run build");
    process.exit(1);
});

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
