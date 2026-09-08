/**
 * The registry is the history of the release matrix.
 *
 * `node-opcua-versions` is published with every release, force-bumped so that its
 * version number *is* the release name, and its manifest carries the release set under
 * `nodeOpcuaRelease`. One request to `<registry>/node-opcua-versions/<release>` (a single
 * version document, about 9 KB) therefore answers "which versions belong to release X"
 * for any release ever published, and `<registry>/node-opcua-versions/latest` answers it
 * for the newest one. Nothing accumulates in the package itself.
 */
import { execFileSync } from "node:child_process";
import type { PeerRequirement } from "./commands.js";
import { compareVersions, isVersion, type ReleaseSet } from "./index.js";

export const DEFAULT_REGISTRY = "https://registry.npmjs.org";
export const PACKAGE_NAME = "node-opcua-versions";

/** how the registry is read; replaceable in tests */
export interface RegistryClient {
    /** the manifest of one published version (or of the `latest` tag) */
    versionDocument(version: string): Promise<VersionDocument | undefined>;
    /** every published version, newest first */
    versions(): Promise<string[]>;
}

export interface VersionDocument {
    version: string;
    nodeOpcuaRelease?: ReleaseSet;
}

/** an HTTP client for one registry, using the global fetch (Node.js 18+) */
export function registryClient(registry: string = DEFAULT_REGISTRY): RegistryClient {
    const base = `${registry.replace(/\/$/, "")}/${PACKAGE_NAME}`;
    return {
        async versionDocument(version) {
            const response = await fetch(`${base}/${version}`);
            if (response.status === 404) return undefined;
            if (!response.ok) throw new Error(`cannot read ${base}/${version}: HTTP ${response.status}`);
            return (await response.json()) as VersionDocument;
        },
        async versions() {
            // the abbreviated packument: what `npm install` itself reads; a few hundred bytes per version
            const response = await fetch(base, { headers: { accept: "application/vnd.npm.install-v1+json" } });
            if (!response.ok) throw new Error(`cannot read ${base}: HTTP ${response.status}`);
            const doc = (await response.json()) as { versions?: Record<string, unknown> };
            return Object.keys(doc.versions ?? {})
                .filter(isVersion)
                .sort((a, b) => compareVersions(b, a));
        }
    };
}

/** the set of a release, from the registry; `undefined` when no such release was published */
export async function fetchReleaseSet(client: RegistryClient, release: string): Promise<ReleaseSet | undefined> {
    const doc = await client.versionDocument(release);
    if (!doc) return undefined;
    if (!doc.nodeOpcuaRelease?.packages) {
        throw new Error(`${PACKAGE_NAME}@${doc.version} carries no nodeOpcuaRelease field`);
    }
    return doc.nodeOpcuaRelease;
}

/** the newest published set */
export async function fetchLatestSet(client: RegistryClient): Promise<ReleaseSet> {
    const set = await fetchReleaseSet(client, "latest");
    if (!set) throw new Error(`${PACKAGE_NAME} is not published on this registry`);
    return set;
}

/**
 * the peer dependencies of `name` at `specifier`, read with `npm view` so that scoped
 * packages on a private registry resolve exactly as they do for `npm install`
 */
export function readPeerRequirements(name: string, specifier: string): PeerRequirement[] {
    const output = npmView(`${name}@${specifier}`, ["version", "peerDependencies"]);
    if (!output) return [];
    const parsed = JSON.parse(output) as
        | { version?: string; peerDependencies?: Record<string, string> }
        | { version?: string; peerDependencies?: Record<string, string> }[];
    // npm view prints an array when the specifier matches several versions; take the newest
    const entry = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
    if (!entry?.peerDependencies) return [];
    const requiredBy = `${name}@${entry.version ?? specifier}`;
    return Object.entries(entry.peerDependencies).map(([peer, range]) => ({ requiredBy, name: peer, range }));
}

function npmView(target: string, fields: string[]): string {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    try {
        return execFileSync(npm, ["view", target, ...fields, "--json"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            shell: process.platform === "win32"
        }).trim();
    } catch (err) {
        throw new Error(`npm view ${target} failed: ${(err as Error).message}`);
    }
}
