#!/usr/bin/env node
"use strict";

// node-opcua-pki writes a CommonJS `certificates/config.js` and then requires it. This package
// is an ES module, so that generated file would be parsed as ESM and fail with "module is not
// defined in ES module scope", leaving the store empty while `pki` still exits 0. A package.json
// in the generated folder scopes it back to CommonJS, which is what that tool expects.
const fs = require("node:fs");
const path = require("node:path");

const folder = path.join(__dirname, "..", "certificates");
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, "package.json"), '{\n    "type": "commonjs"\n}\n');
