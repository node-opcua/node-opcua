/**
 * Read and write a `package.json` without changing how it is written: the indentation it
 * uses, its line endings, and whether it ends with a newline. A two-line change to a
 * manifest must stay a two-line diff.
 */
import fs from "node:fs";

export type DependencyField = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

export const dependencyFields: DependencyField[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

export interface PackageManifest {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    [key: string]: unknown;
}

export interface ManifestFile {
    path: string;
    json: PackageManifest;
    indent: string;
    eol: "\n" | "\r\n";
    trailingNewline: boolean;
}

export function parseManifest(path: string, raw: string): ManifestFile {
    const json = JSON.parse(raw) as PackageManifest;
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const indentMatch = /^(\s+)"/m.exec(raw);
    const indent = indentMatch ? indentMatch[1].replace(/\r?\n/g, "") : "    ";
    const trailingNewline = /\r?\n$/.test(raw);
    return { path, json, indent, eol, trailingNewline };
}

export function readManifest(path: string): ManifestFile {
    return parseManifest(path, fs.readFileSync(path, "utf8"));
}

export function serializeManifest(manifest: ManifestFile): string {
    let text = JSON.stringify(manifest.json, null, manifest.indent);
    if (manifest.eol !== "\n") {
        text = text.replace(/\n/g, manifest.eol);
    }
    return manifest.trailingNewline ? text + manifest.eol : text;
}

export function writeManifest(manifest: ManifestFile): void {
    fs.writeFileSync(manifest.path, serializeManifest(manifest), "utf8");
}
