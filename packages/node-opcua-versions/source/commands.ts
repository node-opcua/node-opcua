/**
 * The three operations of the CLI as pure functions over an in-memory manifest and a
 * release matrix, so they can be tested without a registry, a file system or a network.
 */
import { compareVersions, isVersion, type ReleaseMatrix, type ReleaseSet, satisfiesRange, versionInSet } from "./index.js";
import { type DependencyField, dependencyFields, type PackageManifest } from "./manifest.js";

// ---------------------------------------------------------------------------------------
// inferring the release a manifest is on
// ---------------------------------------------------------------------------------------

export interface InferredRelease {
    release: string;
    /** the dependency the release was inferred from */
    evidence: { field: DependencyField; name: string; version: string };
    /** managed dependencies whose version does not belong to that release */
    outliers: { field: DependencyField; name: string; version: string }[];
}

/** every managed dependency of the manifest, with its specifier */
export function managedDependencies(
    json: PackageManifest,
    matrix: ReleaseMatrix,
    fields: DependencyField[] = ["dependencies", "devDependencies"]
): { field: DependencyField; name: string; specifier: string }[] {
    const result: { field: DependencyField; name: string; specifier: string }[] = [];
    for (const field of fields) {
        const deps = json[field];
        if (!deps) continue;
        for (const [name, specifier] of Object.entries(deps)) {
            if (matrix.manages(name)) result.push({ field, name, specifier });
        }
    }
    return result;
}

/**
 * which release is this manifest on?
 *
 * The `node-opcua` umbrella decides when it is pinned. Otherwise the newest release that
 * agrees with the largest number of pinned managed dependencies wins. `null` when the
 * manifest has no managed dependency, or when its pins fit no release the matrix knows.
 */
export function inferRelease(json: PackageManifest, matrix: ReleaseMatrix): InferredRelease | null {
    const pinned = managedDependencies(json, matrix).filter((d) => isVersion(d.specifier));
    if (pinned.length === 0) return null;

    const pick = (candidate: { field: DependencyField; name: string; specifier: string }, release: string): InferredRelease => {
        const outliers = pinned
            .filter((d) => matrix.versionOf(d.name, release) !== d.specifier)
            .map((d) => ({ field: d.field, name: d.name, version: d.specifier }));
        return { release, evidence: { field: candidate.field, name: candidate.name, version: candidate.specifier }, outliers };
    };

    // The umbrella decides. Its version names a release when it was bumped in that
    // release, and belongs to every later release that did not bump it: the release
    // named by the version wins when it is known, the newest release that carries the
    // version otherwise. A pinned umbrella the matrix has never seen means the manifest
    // is on a release the matrix does not know, and no vote may pretend otherwise.
    const umbrella = pinned.find((d) => d.name === "node-opcua");
    if (umbrella) {
        const candidates = matrix.releasesOf("node-opcua", umbrella.specifier);
        if (candidates.length === 0) return null;
        const named = candidates.includes(umbrella.specifier) ? umbrella.specifier : candidates[0];
        return pick(umbrella, named);
    }

    // vote: for each pinned dependency, every release it belongs to gets one vote
    const votes = new Map<string, number>();
    for (const d of pinned) {
        for (const release of matrix.releasesOf(d.name, d.specifier)) {
            votes.set(release, (votes.get(release) ?? 0) + 1);
        }
    }
    if (votes.size === 0) return null;
    const [best] = [...votes.entries()].sort((a, b) => b[1] - a[1] || compareVersions(b[0], a[0]));
    const witness = pinned.find((d) => matrix.versionOf(d.name, best[0]) === d.specifier) ?? pinned[0];
    return pick(witness, best[0]);
}

// ---------------------------------------------------------------------------------------
// bump
// ---------------------------------------------------------------------------------------

/** `workspace:*`, `link:../x`, `file:../x`, `portal:../x`: a sibling of the workspace, never a version to compare */
export function isWorkspaceLink(specifier: string): boolean {
    return /^(workspace|link|file|portal):/.test(specifier) || specifier === "*";
}

export interface Change {
    field: DependencyField;
    name: string;
    from: string;
    to: string;
}

export interface BumpPlan {
    release: string;
    changes: Change[];
    /** managed dependencies the release does not carry (a package that no longer exists) */
    unknown: { field: DependencyField; name: string }[];
}

/**
 * plan moving every managed dependency of the manifest to the versions of `set`
 *
 * Only `dependencies` and `devDependencies` are rewritten by default: a `peerDependencies`
 * range is a statement about what hosts are accepted and is left alone unless asked.
 */
export function planBump(
    json: PackageManifest,
    set: ReleaseSet,
    matrix: ReleaseMatrix,
    fields: DependencyField[] = ["dependencies", "devDependencies"]
): BumpPlan {
    const changes: Change[] = [];
    const unknown: { field: DependencyField; name: string }[] = [];
    for (const { field, name, specifier } of managedDependencies(json, matrix, fields)) {
        const target = versionInSet(set, name);
        // a peer dependency of a library stays a range: its floor moves, its operator stays
        const to = target !== undefined && field === "peerDependencies" ? rewritePeerSpecifier(specifier, target) : target;
        if (!to) {
            unknown.push({ field, name });
            continue;
        }
        if (specifier !== to) changes.push({ field, name, from: specifier, to });
    }
    return { release: set.release, changes, unknown };
}

/** apply a plan to the manifest (in place) */
export function applyChanges(json: PackageManifest, changes: Change[]): void {
    for (const change of changes) {
        const deps = json[change.field];
        if (deps) deps[change.name] = change.to;
    }
}

// ---------------------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------------------

export interface CheckReport {
    /** the release the manifest was checked against, `null` when none could be inferred */
    release: string | null;
    ok: boolean;
    /**
     * the manifest pins managed packages, but to versions that belong to no release this
     * matrix knows: it is on a newer release than the running copy of the tool, or on
     * versions that were never released together
     */
    unrecognised: boolean;
    /** exact pins that do not belong to the release */
    mismatches: { field: DependencyField; name: string; actual: string; expected: string }[];
    /** managed dependencies written as a range instead of an exact version */
    ranges: { field: DependencyField; name: string; specifier: string }[];
    /** node-opcua-* dependencies the matrix has never seen (a package unknown to every release) */
    unmanaged: { field: DependencyField; name: string; specifier: string }[];
}

/**
 * is every managed dependency of the manifest an exact pin belonging to one release?
 *
 * `release` forces the release to check against; otherwise it is inferred.
 */
export function planCheck(json: PackageManifest, matrix: ReleaseMatrix, release?: string): CheckReport {
    const fields: DependencyField[] = ["dependencies", "devDependencies"];
    const unmanaged: CheckReport["unmanaged"] = [];
    for (const field of fields) {
        for (const [name, specifier] of Object.entries(json[field] ?? {})) {
            if (isWorkspaceLink(specifier)) continue; // a sibling of the workspace, not a version
            if (/^node-opcua(-|$)/.test(name) && !matrix.manages(name)) unmanaged.push({ field, name, specifier });
        }
    }
    const managed = managedDependencies(json, matrix, fields).filter((d) => !isWorkspaceLink(d.specifier));
    const ranges = managed.filter((d) => !isVersion(d.specifier));
    const target = release ?? inferRelease(json, matrix)?.release ?? null;
    const mismatches: CheckReport["mismatches"] = [];
    if (target) {
        const set = matrix.get(target);
        if (!set) throw new Error(`unknown release: ${target}`);
        for (const d of managed) {
            if (!isVersion(d.specifier)) continue;
            const expected = versionInSet(set, d.name);
            if (expected && expected !== d.specifier) {
                mismatches.push({ field: d.field, name: d.name, actual: d.specifier, expected });
            }
        }
    }
    // Pinned managed dependencies that belong to no release this matrix knows: the
    // manifest is on a release newer than the running copy, or on versions that never
    // were a release. Either way "no mismatch found" would be a false pass.
    const unrecognised = target === null && managed.some((d) => isVersion(d.specifier));
    return {
        release: target,
        ok: mismatches.length === 0 && ranges.length === 0 && !unrecognised,
        unrecognised,
        mismatches,
        ranges,
        unmanaged
    };
}

// ---------------------------------------------------------------------------------------
// expand
// ---------------------------------------------------------------------------------------

/** one peer dependency requirement, as read from a dependency's manifest */
export interface PeerRequirement {
    /** `name@version` of the package that declares the peer */
    requiredBy: string;
    name: string;
    range: string;
}

export interface ExpandPlan {
    release: string;
    /** managed peers the manifest does not declare yet, at the release's version */
    additions: { name: string; version: string; requiredBy: string[] }[];
    /** peers whose range excludes the release's version: the dependency does not support this release */
    conflicts: { name: string; version: string; range: string; requiredBy: string }[];
    /** peers already declared, at a version that belongs to the release */
    satisfied: { name: string; version: string }[];
    /** peers the matrix does not manage (left to the user) */
    unmanaged: PeerRequirement[];
}

/**
 * plan adding every managed peer dependency demanded by the manifest's dependencies, at
 * the versions of `set`
 */
export function planExpand(
    json: PackageManifest,
    set: ReleaseSet,
    matrix: ReleaseMatrix,
    requirements: PeerRequirement[]
): ExpandPlan {
    const declared: Record<string, string> = {};
    for (const field of dependencyFields) {
        for (const [name, specifier] of Object.entries(json[field] ?? {})) declared[name] = specifier;
    }
    const additions = new Map<string, { name: string; version: string; requiredBy: string[] }>();
    const conflicts: ExpandPlan["conflicts"] = [];
    const satisfied = new Map<string, { name: string; version: string }>();
    const unmanaged: PeerRequirement[] = [];

    for (const requirement of requirements) {
        if (!matrix.manages(requirement.name)) {
            unmanaged.push(requirement);
            continue;
        }
        const version = versionInSet(set, requirement.name);
        if (!version) {
            unmanaged.push(requirement);
            continue;
        }
        if (!satisfiesRange(version, requirement.range)) {
            conflicts.push({ name: requirement.name, version, range: requirement.range, requiredBy: requirement.requiredBy });
            continue;
        }
        if (declared[requirement.name] !== undefined) {
            satisfied.set(requirement.name, { name: requirement.name, version: declared[requirement.name] });
            continue;
        }
        const existing = additions.get(requirement.name);
        if (existing) {
            existing.requiredBy.push(requirement.requiredBy);
        } else {
            additions.set(requirement.name, { name: requirement.name, version, requiredBy: [requirement.requiredBy] });
        }
    }
    return {
        release: set.release,
        additions: [...additions.values()].sort((a, b) => a.name.localeCompare(b.name)),
        conflicts,
        satisfied: [...satisfied.values()],
        unmanaged
    };
}

/** apply an expand plan: the additions go to `dependencies`, sorted by name */
export function applyExpand(json: PackageManifest, plan: ExpandPlan): void {
    if (plan.additions.length === 0) return;
    const deps = { ...(json.dependencies ?? {}) };
    for (const addition of plan.additions) deps[addition.name] = addition.version;
    json.dependencies = Object.fromEntries(Object.entries(deps).sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * the peer specifier of a library, moved to `version` without changing its shape
 *
 * `>=2.170.0` becomes `>=2.181.1`, `^2.170.0` becomes `^2.181.1`, an exact version becomes
 * the exact new version; `*`, `x` and anything the tool does not understand are returned
 * untouched, since a wildcard already accepts the release and a complex range is the
 * author's decision.
 */
export function rewritePeerSpecifier(specifier: string, version: string): string {
    const m = /^(>=|\^|~)?\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.exec(specifier.trim());
    if (!m) return specifier;
    return `${m[1] ?? ""}${version}`;
}

// ---------------------------------------------------------------------------------------
// scripts that would undo the tool's work
// ---------------------------------------------------------------------------------------

export interface ScriptWarning {
    script: string;
    command: string;
    reason: string;
    fix: string;
}

/**
 * does an `npm-check-updates` invocation leave the node-opcua family alone?
 *
 * `ncu -u` moves every dependency to its latest, which for the node-opcua family is what
 * `bump` does with knowledge of the release sets; run without `-x "node-opcua*"` it
 * competes with the tool and, during a publish window, assembles a half-published set.
 */
export function auditScripts(json: PackageManifest): ScriptWarning[] {
    const warnings: ScriptWarning[] = [];
    for (const [script, command] of Object.entries((json.scripts as Record<string, string> | undefined) ?? {})) {
        if (!/\b(ncu|npm-check-updates)\b/.test(command)) continue;
        const excludes = /(?:^|\s)(?:-x|--reject)(?:=|\s+)["']?([^"'\s]+)/g;
        let excluded = false;
        for (let m = excludes.exec(command); m; m = excludes.exec(command)) {
            if (/node-opcua/.test(m[1])) excluded = true;
        }
        if (excluded) continue;
        const filters = /(?:^|\s)(?:-f|--filter)(?:=|\s+)["']?([^"'\s]+)/.exec(command);
        if (filters && !/node-opcua/.test(filters[1])) continue; // a filter that never touches the family
        warnings.push({
            script,
            command,
            reason: "runs npm-check-updates on the node-opcua family",
            fix: 'add -x "node-opcua*" to that script and let `node-opcua-versions bump` move the family'
        });
    }
    return warnings;
}
