#!/usr/bin/env node
/**
 * Maintainer tool of the node-opcua monorepo: write the release set into
 * packages/node-opcua-versions/package.json, under `nodeOpcuaRelease`: every public package with its version, and the external
 * node-opcua packages (`node-opcua-crypto`, `node-opcua-pki`) the workspace pins.
 *
 * That field is what the registry serves for every published version of this package,
 * and this package is force-bumped with every release so that its version *is* the
 * release name. Nothing else is stored: the registry is the history.
 *
 * Run by lerna through the root package's `version` lifecycle script, after every
 * manifest and lerna.json have been bumped and before the release commit. It cannot run as
 * this package's own `version` script: lerna runs those before it writes lerna.json, so the
 * release name would still be the previous one. `--stage` adds package.json to
 * git so that it lands in that commit, as `npm version` documents for `version` scripts.
 * This file is not part of the published package: a node-opcua user never needs it.
 *
 *   node tools/generate-release-set.mjs [--root <repo>] [--manifest <package.json>] [--write] [--stage] [--check]
 *
 *   (no flag)  report the release set and whether package.json is up to date; write nothing
 *   --write    rewrite the nodeOpcuaRelease field of package.json
 *   --stage    --write, then git add package.json (what the version lifecycle uses)
 *   --check    like the bare run, but exit 1 when package.json is stale (for CI)
 *   --manifest the package.json to describe (default: packages/node-opcua-versions/package.json under --root)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
    const options = { root: path.resolve(here, ".."), manifest: undefined, write: false, stage: false, check: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--root") options.root = path.resolve(argv[++i]);
        else if (arg === "--manifest") options.manifest = path.resolve(argv[++i]);
        else if (arg === "--write") options.write = true;
        else if (arg === "--stage") options.write = options.stage = true;
        else if (arg === "--check") options.check = true;
        else throw new Error(`unknown argument ${arg}`);
    }
    return options;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** the workspace folders lerna.json declares, expanded (only the `<dir>/*` form is used here) */
export function workspaceFolders(root) {
    const lerna = readJson(path.join(root, "lerna.json"));
    const folders = [];
    for (const glob of lerna.packages ?? ["packages/*"]) {
        const base = glob.replace(/\/\*$/, "");
        const dir = path.join(root, base);
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) folders.push(path.join(dir, entry.name));
        }
    }
    return { release: lerna.version, folders };
}

/** the manifests of every public package in the folders */
export function collectPackages(folders) {
    const manifests = [];
    for (const folder of folders) {
        const file = path.join(folder, "package.json");
        if (!fs.existsSync(file)) continue;
        const json = readJson(file);
        if (!json.name || json.private) continue;
        manifests.push(json);
    }
    return collectFromManifests(manifests);
}

/**
 * the release set described by a list of package manifests
 *
 * A node-opcua-* dependency that is not itself in the workspace lives in another
 * repository with its own versioning; the version the workspace pins it to is part of the
 * release. When two packages disagree the highest wins and a warning is printed, since
 * that disagreement is itself something to fix in the workspace.
 */
export function collectFromManifests(manifests) {
    const packages = {};
    for (const json of manifests) packages[json.name] = json.version;
    const external = {};
    for (const json of manifests) {
        const deps = { ...(json.dependencies ?? {}), ...(json.optionalDependencies ?? {}) };
        for (const [name, specifier] of Object.entries(deps)) {
            if (!/^node-opcua(-|$)/.test(name) || name in packages) continue;
            const version = specifier.replace(/^[\^~=v]/, "");
            if (!/^\d+\.\d+\.\d+/.test(version)) continue; // a workspace link or a range we cannot pin
            if (external[name] && external[name] !== version) {
                const kept = compareVersions(version, external[name]) > 0 ? version : external[name];
                console.error(`warning: ${name} is pinned to both ${external[name]} and ${version} (${json.name}); keeping ${kept}`);
                external[name] = kept;
            } else {
                external[name] = version;
            }
        }
    }
    return { packages: sortObject(packages), external: sortObject(external) };
}

function sortObject(object) {
    return Object.fromEntries(Object.entries(object).sort((a, b) => a[0].localeCompare(b[0])));
}

function compareVersions(a, b) {
    const pa = a.split(/[.-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
    const pb = b.split(/[.-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if (pa[i] === pb[i]) continue;
        if (pa[i] === undefined) return 1; // "2.1.0" > "2.1.0-beta"
        if (pb[i] === undefined) return -1;
        return pa[i] < pb[i] ? -1 : 1;
    }
    return 0;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

/** does the repository have the tag of this release? */
export function hasTag(root, release) {
    try {
        execFileSync("git", ["rev-parse", "--verify", "--quiet", `refs/tags/v${release}`], { cwd: root, stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/** the packages of a release as they were committed at a git tag */
export function collectPackagesFromTag(root, tag) {
    const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const lerna = JSON.parse(git(["show", `${tag}:lerna.json`]));
    const date = git(["log", "-1", "--format=%cs", tag]).trim();
    const manifests = [];
    for (const glob of lerna.packages ?? ["packages/*"]) {
        const base = glob.replace(/\/\*$/, "");
        let listing;
        try {
            listing = git(["ls-tree", "--name-only", tag, `${base}/`]);
        } catch {
            continue;
        }
        for (const dir of listing.split("\n").filter((x) => x.length > 0)) {
            let json;
            try {
                json = JSON.parse(git(["show", `${tag}:${dir}/package.json`]));
            } catch {
                continue;
            }
            if (!json.name || json.private) continue;
            manifests.push(json);
        }
    }
    return { release: lerna.version, date, ...collectFromManifests(manifests) };
}

/** rewrite package.json's nodeOpcuaRelease field, keeping the file's formatting */
function writeManifestField(file, set) {
    const raw = fs.readFileSync(file, "utf8");
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const indent = (/^(\s+)"/m.exec(raw)?.[1] ?? "    ").replace(/\r?\n/g, "");
    const json = JSON.parse(raw);
    json.nodeOpcuaRelease = { release: set.release, date: set.date, packages: set.packages, external: set.external };
    let text = JSON.stringify(json, null, indent);
    if (eol !== "\n") text = text.replace(/\n/g, eol);
    if (/\r?\n$/.test(raw)) text += eol;
    fs.writeFileSync(file, text, "utf8");
}

function sameSet(a, b) {
    const same = (x, y) => JSON.stringify(sortObject(x ?? {})) === JSON.stringify(sortObject(y ?? {}));
    return same(a.packages, b.packages) && same(a.external, b.external);
}

export function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    const manifestFile = options.manifest ?? path.join(options.root, "packages", "node-opcua-versions", "package.json");
    const manifest = readJson(manifestFile);

    const { release, folders } = workspaceFolders(options.root);

    // The invariant every consumer relies on: the version of node-opcua-versions is the
    // release name. lerna keeps it so through --force-publish; a manual edit could not.
    if (manifest.version !== release) {
        throw new Error(
            `${manifest.name} is at ${manifest.version} but lerna.json says the release is ${release}: ` +
                "the version of node-opcua-versions must equal the release name (run version:lerna with --force-publish=node-opcua-versions)"
        );
    }

    // A release that has been tagged is described by its tag, not by the working tree:
    // between two releases the tree gains packages and pins that are not published under
    // that number. During `lerna version` the tag does not exist yet, and the freshly
    // bumped working tree is exactly what is about to be published.
    const current = hasTag(options.root, release)
        ? collectPackagesFromTag(options.root, `v${release}`)
        : { release, date: today(), ...collectPackages(folders) };
    if (Object.keys(current.packages).length === 0) {
        throw new Error(`no public package found under ${options.root}`);
    }
    // This package is marked private in the repository (so that lerna publishes it in a
    // separate, final pass) but it is published, and a project may pin it: it belongs to
    // the set like any other package of the release.
    current.packages[manifest.name] = manifest.version;
    current.packages = sortObject(current.packages);

    if (!options.write) {
        const stored = manifest.nodeOpcuaRelease;
        const upToDate = !!stored && stored.release === release && sameSet(stored, current);
        const count = Object.keys(current.packages).length;
        if (upToDate) {
            console.log(`nodeOpcuaRelease describes release ${release} (${count} packages, ${Object.keys(current.external).length} external pins)`);
            return 0;
        }
        console.error(`package.json's nodeOpcuaRelease does not describe release ${release} (${count} packages); run: node tools/generate-release-set.mjs --write`);
        return options.check ? 1 : 0;
    }

    const date = manifest.nodeOpcuaRelease?.release === release ? (manifest.nodeOpcuaRelease.date ?? current.date) : current.date;
    writeManifestField(manifestFile, { ...current, date });
    console.log(`release ${release}: ${Object.keys(current.packages).length} packages written to ${path.relative(options.root, manifestFile)}`);

    if (options.stage) {
        execFileSync("git", ["add", manifestFile], { cwd: options.root, stdio: "inherit" });
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exitCode = main();
    } catch (err) {
        console.error(err.message);
        process.exitCode = 1;
    }
}
