/**
 * Finding the right release set for a command: the bundled set, the registry, or both.
 */
import { inferRelease } from "./commands.js";
import { compareVersions, isVersion, type ReleaseMatrix, type ReleaseSet } from "./index.js";
import type { PackageManifest } from "./manifest.js";
import { fetchLatestSet, fetchReleaseSet, type RegistryClient } from "./registry.js";

export interface ResolveOptions {
    /** never touch the registry: the bundled set is all there is */
    offline?: boolean;
    /** how many registry versions `inferOnline` may read before giving up */
    maxLookups?: number;
}

/** the set of a named release, from the matrix if loaded, from the registry otherwise */
export async function resolveRelease(
    release: string,
    matrix: ReleaseMatrix,
    client: RegistryClient,
    options: ResolveOptions = {}
): Promise<ReleaseSet> {
    const loaded = matrix.get(release);
    if (loaded) return loaded;
    if (options.offline) {
        throw new Error(
            `release ${release} is not the bundled one (${matrix.latest().release}) and --offline forbids reading the registry`
        );
    }
    const set = await fetchReleaseSet(client, release);
    if (!set) {
        throw new Error(
            `release ${release} is not published as node-opcua-versions@${release}: the matrix starts with the release that introduced the tool; earlier releases are only in the repository's git tags`
        );
    }
    return matrix.add(set);
}

/**
 * the newest published release when it is newer than the bundled one, `undefined`
 * otherwise (or offline, or when the registry cannot be reached)
 *
 * `bump` targets the release of the copy it runs from, so that `npx node-opcua-versions@X`
 * lands on X; this is how a copy that is not the newest tells its user.
 */
export async function newerReleaseAvailable(
    matrix: ReleaseMatrix,
    client: RegistryClient,
    options: ResolveOptions = {}
): Promise<string | undefined> {
    if (options.offline) return undefined;
    try {
        const latest = await fetchLatestSet(client);
        return compareVersions(latest.release, matrix.latest().release) > 0 ? latest.release : undefined;
    } catch {
        return undefined;
    }
}

/** the newest release: from the registry, or the bundled set when offline or unreachable */
export async function resolveLatest(
    matrix: ReleaseMatrix,
    client: RegistryClient,
    options: ResolveOptions = {},
    warn: (message: string) => void = () => {}
): Promise<ReleaseSet> {
    if (options.offline) return matrix.latest();
    try {
        return matrix.add(await fetchLatestSet(client));
    } catch (err) {
        warn(`${(err as Error).message}; using the bundled set (release ${matrix.latest().release})`);
        return matrix.latest();
    }
}

/**
 * which release is this manifest on?
 *
 * Tries the sets already loaded first. Then, unless offline, walks the published
 * versions newest first, reading each set until one agrees with the manifest's exact
 * `node-opcua` pin (or, without that pin, with any managed pin), bounded by `maxLookups`.
 * `null` when nothing fits.
 */
export async function resolveManifestRelease(
    json: PackageManifest,
    matrix: ReleaseMatrix,
    client: RegistryClient,
    options: ResolveOptions = {}
): Promise<string | null> {
    const local = inferRelease(json, matrix);
    if (local && local.outliers.length === 0) return local.release;
    if (options.offline) return local?.release ?? null;

    const pinned = collectPins(json);
    if (pinned.length === 0) return null;
    const umbrella = pinned.find((p) => p.name === "node-opcua");

    // the release named like the umbrella's version is the first candidate: with the
    // release-name invariant it exists whenever node-opcua was bumped in that release
    if (umbrella) {
        const direct = matrix.get(umbrella.version) ?? (await fetchReleaseSet(client, umbrella.version));
        if (direct) {
            matrix.add(direct);
            const inferred = inferRelease(json, matrix);
            if (inferred?.release === direct.release && inferred.outliers.length === 0) return direct.release;
        }
    }

    const budget = options.maxLookups ?? 12;
    let lookups = 0;
    for (const version of await client.versions()) {
        if (lookups >= budget) break;
        if (matrix.get(version)) continue;
        lookups++;
        const set = await fetchReleaseSet(client, version);
        if (!set) continue;
        matrix.add(set);
        const fits = pinned.every((p) => matrix.versionOf(p.name, version) === p.version);
        if (fits) return version;
    }
    return local?.release ?? null;
}

function collectPins(json: PackageManifest): { name: string; version: string }[] {
    const pins: { name: string; version: string }[] = [];
    for (const field of ["dependencies", "devDependencies"] as const) {
        for (const [name, specifier] of Object.entries(json[field] ?? {})) {
            if (/^node-opcua(-|$)/.test(name) && isVersion(specifier)) pins.push({ name, version: specifier });
        }
    }
    return pins;
}
