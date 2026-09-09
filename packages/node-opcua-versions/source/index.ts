/**
 * @module node-opcua-versions
 *
 * The release matrix of node-opcua.
 *
 * A node-opcua release is a *set* of package versions, not a single number: only the
 * packages that changed are bumped and republished, so `node-opcua@2.181.1` legitimately
 * depends on `node-opcua-debug@2.181.0`. This module knows the exact version of every
 * public package of the monorepo, and of the external node-opcua packages the release
 * pins, for its own release, and reads any other release from the registry, where each
 * published version of this package carries the set of the release it was published with.
 */
import fs from "node:fs";
import path from "node:path";

/** the packages of one release, by name */
export interface ReleaseSet {
    /** the release name, i.e. the version of `node-opcua-versions` published with it */
    release: string;
    /** the day the release was tagged, ISO `YYYY-MM-DD` */
    date?: string;
    /** every public package of the monorepo at that release, name -> exact version */
    packages: Record<string, string>;
    /**
     * node-opcua packages that live outside the monorepo and follow their own versioning
     * (`node-opcua-crypto`, `node-opcua-pki`), at the exact version the release pins them to
     */
    external: Record<string, string>;
}

/** the version of `name` in a set: a monorepo package, or an external one the release pins */
export function versionInSet(set: ReleaseSet, name: string): string | undefined {
    return set.packages[name] ?? set.external[name];
}

/**
 * compare two `x.y.z[-pre]` versions; negative when `a < b`, positive when `a > b`
 *
 * A release version never carries build metadata, and a prerelease sorts before the
 * release it precedes, which is all the ordering the matrix needs.
 */
export function compareVersions(a: string, b: string): number {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (pa.numbers[i] !== pb.numbers[i]) {
            return pa.numbers[i] - pb.numbers[i];
        }
    }
    if (pa.prerelease === pb.prerelease) return 0;
    if (pa.prerelease === "") return 1;
    if (pb.prerelease === "") return -1;
    return pa.prerelease < pb.prerelease ? -1 : 1;
}

export function parseVersion(version: string): { numbers: number[]; prerelease: string } {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
    if (!m) {
        throw new Error(`not a version: "${version}"`);
    }
    return { numbers: [Number(m[1]), Number(m[2]), Number(m[3])], prerelease: m[4] ?? "" };
}

export function isVersion(value: string): boolean {
    try {
        parseVersion(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * does `version` satisfy `range`?
 *
 * Supports what a `peerDependencies` entry of the node-opcua ecosystem uses: exact
 * versions, `^`, `~`, `>=`, `>`, `<=`, `<`, `=`, `*`, `x` and `||` alternatives with
 * space-separated conjunctions. Anything else throws rather than guessing.
 */
export function satisfiesRange(version: string, range: string): boolean {
    const v = parseVersion(version);
    const alternatives = range.split("||").map((s) => s.trim());
    return alternatives.some((alternative) => {
        if (alternative === "" || alternative === "*" || alternative === "x") return true;
        const comparators = alternative.split(/\s+/).filter((c) => c.length > 0);
        return comparators.every((comparator) => satisfiesComparator(v, comparator));
    });
}

function satisfiesComparator(v: { numbers: number[]; prerelease: string }, comparator: string): boolean {
    const m = /^(>=|<=|>|<|=|\^|~)?\s*v?(.+)$/.exec(comparator);
    if (!m) throw new Error(`unsupported range: "${comparator}"`);
    const operator = m[1] ?? "";
    const target = m[2];
    if (target === "*" || target === "x") return true;
    // fill a partial version such as "2" or "2.181" with zeros
    const parts = target.split(".");
    while (parts.length < 3) parts.push("0");
    const t = parseVersion(parts.join("."));
    const cmp = compareVersions(versionToString(v), versionToString(t));
    switch (operator) {
        case "":
        case "=":
            return cmp === 0;
        case ">":
            return cmp > 0;
        case ">=":
            return cmp >= 0;
        case "<":
            return cmp < 0;
        case "<=":
            return cmp <= 0;
        case "^": {
            if (cmp < 0) return false;
            // same major, unless major is 0: then same minor
            if (t.numbers[0] !== 0) return v.numbers[0] === t.numbers[0];
            if (t.numbers[1] !== 0) return v.numbers[0] === 0 && v.numbers[1] === t.numbers[1];
            return v.numbers[0] === 0 && v.numbers[1] === 0 && v.numbers[2] === t.numbers[2];
        }
        case "~":
            return cmp >= 0 && v.numbers[0] === t.numbers[0] && v.numbers[1] === t.numbers[1];
        default:
            throw new Error(`unsupported operator: "${operator}"`);
    }
}

function versionToString(v: { numbers: number[]; prerelease: string }): string {
    return v.numbers.join(".") + (v.prerelease ? `-${v.prerelease}` : "");
}

/**
 * a collection of release sets: the bundled one, plus whatever has been read from the
 * registry during a run
 */
export class ReleaseMatrix {
    private readonly sets = new Map<string, ReleaseSet>();

    constructor(sets: ReleaseSet[] = []) {
        for (const set of sets) this.add(set);
    }

    /** remember a set; a release already known is left untouched, since a release never changes */
    public add(set: ReleaseSet): ReleaseSet {
        const known = this.sets.get(set.release);
        if (known) return known;
        const copy: ReleaseSet = { ...set, packages: { ...set.packages }, external: { ...(set.external ?? {}) } };
        this.sets.set(set.release, copy);
        return copy;
    }

    /** the release names known so far, newest first */
    public releases(): string[] {
        return [...this.sets.keys()].sort((a, b) => compareVersions(b, a));
    }

    /** the newest release known so far */
    public latest(): ReleaseSet {
        const [newest] = this.releases();
        if (!newest) throw new Error("the release matrix is empty");
        return this.get(newest) as ReleaseSet;
    }

    /** the set of a release, or `undefined` when it has not been loaded */
    public get(release: string): ReleaseSet | undefined {
        const set = this.sets.get(release);
        return set && { ...set, packages: { ...set.packages }, external: { ...set.external } };
    }

    /** the version of `name` in `release`, or `undefined` when the release or the package is unknown */
    public versionOf(name: string, release: string): string | undefined {
        const set = this.sets.get(release);
        return set && versionInSet(set, name);
    }

    /** every package name seen in any loaded release, monorepo and external alike */
    public packageNames(): string[] {
        const names = new Set<string>();
        for (const set of this.sets.values()) {
            for (const name of Object.keys(set.packages)) names.add(name);
            for (const name of Object.keys(set.external)) names.add(name);
        }
        return [...names].sort();
    }

    /**
     * is `name` a package the matrix manages? A public package of the monorepo, or an
     * external node-opcua package (`node-opcua-crypto`, `node-opcua-pki`) that releases pin
     */
    public manages(name: string): boolean {
        return this.packageNames().includes(name);
    }

    /**
     * the loaded releases in which `name` was at `version`, newest first
     *
     * Because unchanged packages keep their version across releases, one version usually
     * belongs to several consecutive releases.
     */
    public releasesOf(name: string, version: string): string[] {
        return this.releases().filter((release) => this.versionOf(name, release) === version);
    }
}

// The one place this module learns where it sits on disk. `import.meta.dirname`
// cannot be used while this package emits CommonJS (TS1470), so the ESM migration
// has this single line to change rather than several scattered uses.
const here = __dirname;

/** the path of this package's own manifest, which carries the set of its own release */
export function bundledManifestFile(): string {
    return path.join(here, "..", "package.json");
}

/**
 * the set bundled with this copy of the package: the release it was published with
 *
 * Read from the `nodeOpcuaRelease` field of `package.json`, the same field the registry
 * serves for every published version.
 */
export function bundledSet(manifestFile: string = bundledManifestFile()): ReleaseSet {
    const json = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as { version: string; nodeOpcuaRelease?: ReleaseSet };
    const set = json.nodeOpcuaRelease;
    if (!set?.packages || Object.keys(set.packages).length === 0) {
        throw new Error(`${manifestFile} carries no release set; maintainers: run tools/generate-release-set.mjs --write`);
    }
    return { ...set, external: set.external ?? {} };
}

export * from "./commands.js";
export * from "./manifest.js";
export * from "./registry.js";
