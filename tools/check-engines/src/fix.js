/**
 * fix - write the root's Node floor into every published package.json.
 *
 * Text-based rather than parse-and-stringify, deliberately: `JSON.parse` then
 * `JSON.stringify` would reformat 113 manifests and bury a one-line change in a diff nobody
 * can review. This edits the one value, or inserts the one block, and leaves the rest of the
 * file byte-for-byte alone.
 */

import fs from "node:fs";
import { publishedPackages, rootFloor } from "./rule.js";

/** the span of the object that opens at `openBrace`, by counting braces outside strings */
function objectSpan(text, openBrace) {
    let depth = 0;
    let inString = false;
    for (let i = openBrace; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (ch === "\\") {
                i++;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
        } else if (ch === "{") {
            depth++;
        } else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return [openBrace, i + 1];
            }
        }
    }
    return null;
}

/** the indent used by the file's top-level keys, so an inserted block matches it */
function detectIndent(text) {
    const m = /\n([ \t]+)"/.exec(text);
    return m ? m[1] : "    ";
}

/**
 * Returns the new text, or null when nothing needs changing.
 */
export function setFloor(text, floor) {
    const enginesKey = /"engines"\s*:\s*\{/.exec(text);

    if (enginesKey) {
        const span = objectSpan(text, enginesKey.index + enginesKey[0].length - 1);
        if (!span) {
            return null;
        }
        const [start, end] = span;
        const block = text.slice(start, end);
        const nodeKey = /"node"\s*:\s*"([^"]*)"/.exec(block);

        if (nodeKey) {
            if (nodeKey[1] === floor) {
                return null;
            }
            const patched = block.slice(0, nodeKey.index) + `"node": "${floor}"` + block.slice(nodeKey.index + nodeKey[0].length);
            return text.slice(0, start) + patched + text.slice(end);
        }
        // an engines block with no node key: add one as its first entry
        const indent = detectIndent(text);
        const inner = block.slice(1, -1);
        const body = inner.trim() ? `\n${indent}${indent}"node": "${floor}",${inner.replace(/^\n/, "\n")}` : `\n${indent}${indent}"node": "${floor}"\n${indent}`;
        return `${text.slice(0, start)}{${body}}${text.slice(end)}`;
    }

    // no engines block at all: insert one before dependencies, else devDependencies, else last
    const indent = detectIndent(text);
    const anchor = new RegExp(`\\n${indent}"(dependencies|devDependencies|files|exports)"\\s*:`).exec(text);
    const insertion = `\n${indent}"engines": {\n${indent}${indent}"node": "${floor}"\n${indent}},`;

    if (anchor) {
        return text.slice(0, anchor.index) + insertion + text.slice(anchor.index);
    }

    // last resort: before the closing brace of the manifest
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace === -1) {
        return null;
    }
    const before = text.slice(0, lastBrace).replace(/\s*$/, "");
    const withComma = before.endsWith(",") ? before : `${before},`;
    return `${withComma}\n${indent}"engines": {\n${indent}${indent}"node": "${floor}"\n${indent}}\n${text.slice(lastBrace)}`;
}

export function applyFloor({ repoRoot = "." } = {}) {
    const floor = rootFloor(repoRoot);
    if (!floor) {
        return { changed: 0, files: [] };
    }
    const files = [];
    for (const pkg of publishedPackages(repoRoot)) {
        const text = fs.readFileSync(pkg.file, "utf8");
        const next = setFloor(text, floor);
        if (next !== null && next !== text) {
            fs.writeFileSync(pkg.file, next);
            files.push(pkg.file);
        }
    }
    return { changed: files.length, files };
}
