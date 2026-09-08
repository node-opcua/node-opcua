#!/usr/bin/env node
/**
 * node-opcua-versions: bump, expand and check the node-opcua-* dependencies of a
 * package.json, or of every package.json of a workspace, against the release matrix.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { applyChanges, applyExpand, auditScripts, type PeerRequirement, planBump, planCheck, planExpand } from "./commands.js";
import { bundledSet, ReleaseMatrix, type ReleaseSet } from "./index.js";
import { type ManifestFile, readManifest, writeManifest } from "./manifest.js";
import { DEFAULT_REGISTRY, type RegistryClient, readPeerRequirements, registryClient } from "./registry.js";
import { newerReleaseAvailable, resolveLatest, resolveManifestRelease, resolveRelease } from "./resolve.js";
import { discoverAllManifests, discoverWorkspaceManifests, installRoots } from "./workspaces.js";

interface CommonOptions {
    package: string;
    workspaces?: boolean;
    all?: boolean;
    offline?: boolean;
    registry: string;
}

interface Context {
    common: CommonOptions;
    matrix: ReleaseMatrix;
    client: RegistryClient;
    /** the manifests to work on: one, or the root and every package of the workspace */
    manifests: ManifestFile[];
    /** the folder the manifests were found under; where a root install runs */
    rootDir: string;
}

function context(): Context {
    const common = program.opts<CommonOptions>();
    const target = path.resolve(common.package);
    const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
    const files = common.all
        ? discoverAllManifests(dir)
        : common.workspaces
          ? discoverWorkspaceManifests(dir)
          : [fs.statSync(target).isDirectory() ? path.join(target, "package.json") : target];
    return {
        common,
        matrix: new ReleaseMatrix([bundledSet()]),
        client: registryClient(common.registry),
        manifests: files.map(readManifest),
        rootDir: dir
    };
}

/** warn about scripts that would undo the tool's work; returns how many were found */
function warnAboutScripts(manifest: ManifestFile): number {
    const warnings = auditScripts(manifest.json);
    for (const w of warnings) console.log(`  ! script "${w.script}" ${w.reason} (${w.command}): ${w.fix}`);
    return warnings.length;
}

function heading(manifest: ManifestFile, context: Context): void {
    if (context.manifests.length > 1) console.log(`\n== ${path.relative(process.cwd(), manifest.path) || "package.json"}`);
}

/**
 * one install per lockfile owner among the written manifests, outermost first: the
 * workspace root for the packages it manages, and each independent package (its own
 * lockfile, possibly another package manager) for itself
 */
function runInstalls(written: ManifestFile[], rootDir: string): void {
    for (const { dir, command } of installRoots(
        written.map((m) => m.path),
        rootDir
    )) {
        console.log(`
$ ${command}   (in ${path.relative(process.cwd(), dir) || "."})`);
        execSync(command, { cwd: dir, stdio: "inherit" });
    }
}

const program = new Command();
program
    .name("node-opcua-versions")
    .description("keep the node-opcua-* dependencies of a package.json, or of a whole workspace, on one coherent release")
    .option("-p, --package <path>", "the package.json (or its folder) to work on", ".")
    .option("-w, --workspaces", "work on the root and every package of the workspace found at --package")
    .option(
        "-a, --all",
        "work on every package.json under --package, workspace member or not (node_modules and build folders excluded)"
    )
    .option("--offline", "never touch the registry: only the release bundled with this copy is known")
    .option("--registry <url>", "registry that publishes node-opcua-versions", DEFAULT_REGISTRY);

program
    .command("bump")
    .description("move every node-opcua-* dependency to the versions of a release: the one this copy was published with by default")
    .option("-r, --release <version>", "the release to move to (npx node-opcua-versions@X bump is the same as --release X)")
    .option("--latest", "move to the newest published release, whatever copy of the tool runs")
    .option("--dry-run", "show the changes, write nothing")
    .option(
        "--install",
        "run the package manager's install afterwards, in every folder that owns a lockfile among the changed packages"
    )
    .option("--include-peers", "also move peerDependencies: a range keeps its operator and gets the release's version as floor")
    .action(async (opts: { release?: string; latest?: boolean; dryRun?: boolean; install?: boolean; includePeers?: boolean }) => {
        const ctx = context();
        const { common, matrix, client } = ctx;
        let set: ReleaseSet;
        if (opts.latest || opts.release === "latest") {
            set = await resolveLatest(matrix, client, common, (m) => console.error(`warning: ${m}`));
        } else if (opts.release) {
            set = await resolveRelease(opts.release, matrix, client, common);
        } else {
            // the release of the copy that runs: `npx node-opcua-versions@2.185.0 bump` lands on 2.185.0
            set = matrix.latest();
            const newer = await newerReleaseAvailable(matrix, client, common);
            if (newer) {
                console.error(
                    `note: this copy of node-opcua-versions is release ${set.release}; release ${newer} is published. Run npx node-opcua-versions@latest bump, or bump --latest, to move there.`
                );
            }
        }
        const fields = opts.includePeers
            ? (["dependencies", "devDependencies", "peerDependencies"] as const)
            : (["dependencies", "devDependencies"] as const);
        console.log(`release ${set.release}${set.date ? ` (${set.date})` : ""}`);
        const written: ManifestFile[] = [];
        for (const manifest of ctx.manifests) {
            heading(manifest, ctx);
            const plan = planBump(manifest.json, set, matrix, [...fields]);
            warnAboutScripts(manifest);
            for (const u of plan.unknown) console.log(`  ! ${u.name} is not part of release ${set.release} (${u.field})`);
            if (plan.changes.length === 0) {
                console.log("  every node-opcua-* dependency is already on this release");
                continue;
            }
            for (const c of plan.changes) console.log(`  ${c.name.padEnd(48)} ${c.from.padStart(10)}  ->  ${c.to}   (${c.field})`);
            if (opts.dryRun) continue;
            applyChanges(manifest.json, plan.changes);
            writeManifest(manifest);
            written.push(manifest);
            console.log(`  wrote ${manifest.path}`);
        }
        if (opts.install && written.length > 0) runInstalls(written, ctx.rootDir);
    });

program
    .command("expand")
    .description(
        "declare the node-opcua-* peer dependencies your dependencies (@sterfive/* first) require, at your release's versions"
    )
    .option("--dry-run", "show the additions, write nothing")
    .option("-r, --release <version>", "the release to take versions from (inferred from package.json by default)")
    .action(async (opts: { dryRun?: boolean; release?: string }) => {
        const ctx = context();
        const { common, matrix, client } = ctx;
        for (const manifest of ctx.manifests) {
            heading(manifest, ctx);
            const release = opts.release ?? (await resolveManifestRelease(manifest.json, matrix, client, common));
            if (!release) {
                console.log(
                    "  ! cannot infer the release: pin node-opcua (or another node-opcua-* package) to an exact version of a published release, or pass --release"
                );
                process.exitCode = 1;
                continue;
            }
            const set = await resolveRelease(release, matrix, client, common);
            const requirements: PeerRequirement[] = [];
            for (const field of ["dependencies", "devDependencies"] as const) {
                for (const [name, specifier] of Object.entries(manifest.json[field] ?? {})) {
                    if (matrix.manages(name) || /^(workspace|link|file|portal):/.test(specifier)) continue;
                    requirements.push(...readPeerRequirements(name, specifier));
                }
            }
            const plan = planExpand(manifest.json, set, matrix, requirements);
            console.log(`  release ${release}`);
            for (const c of plan.conflicts) {
                console.log(`  ! ${c.requiredBy} requires ${c.name} ${c.range}, but release ${release} carries ${c.version}`);
            }
            for (const a of plan.additions)
                console.log(`  + ${a.name.padEnd(48)} ${a.version}   (required by ${a.requiredBy.join(", ")})`);
            for (const s of plan.satisfied) console.log(`  = ${s.name.padEnd(48)} ${s.version}`);
            for (const u of plan.unmanaged)
                console.log(`  ? ${u.name} ${u.range} (required by ${u.requiredBy}) is not managed by the matrix`);
            if (plan.conflicts.length > 0) process.exitCode = 1;
            if (plan.additions.length === 0) {
                console.log("  nothing to add");
                continue;
            }
            if (opts.dryRun) continue;
            applyExpand(manifest.json, plan);
            writeManifest(manifest);
            console.log(`  wrote ${manifest.path}`);
        }
    });

program
    .command("check")
    .description("verify that every node-opcua-* dependency is an exact pin belonging to one release (exit 1 otherwise)")
    .option("-r, --release <version>", "the release to check against (inferred by default)")
    .option("--fix", "rewrite ranges and off-release pins to the release's exact versions (dependencies and devDependencies)")
    .action(async (opts: { release?: string; fix?: boolean }) => {
        const ctx = context();
        const { common, matrix, client } = ctx;
        for (const manifest of ctx.manifests) {
            heading(manifest, ctx);
            const release = opts.release ?? (await resolveManifestRelease(manifest.json, matrix, client, common)) ?? undefined;
            if (release) await resolveRelease(release, matrix, client, common);
            const report = planCheck(manifest.json, matrix, release);
            if (report.release) console.log(`  release ${report.release}`);
            else if (report.unrecognised)
                console.log(
                    `  ! the node-opcua-* pins belong to no published release${common.offline ? ` (offline: only ${matrix.latest().release} is known)` : ""}; bump to a release, or pass --release`
                );
            else console.log("  no node-opcua-* pin: nothing to check");
            const scriptWarnings = warnAboutScripts(manifest);
            for (const r of report.ranges) console.log(`  ! ${r.name} is written as a range (${r.specifier}); pin it exactly`);
            for (const m of report.mismatches)
                console.log(`  ! ${m.name} is ${m.actual}, release ${report.release} carries ${m.expected}`);
            for (const u of report.unmanaged)
                console.log(`  ? ${u.name} ${u.specifier} is unknown to the release matrix (not checked)`);
            if (report.ok && scriptWarnings === 0) {
                if (report.release) console.log("  ok: every node-opcua-* dependency is an exact pin of one release");
                continue;
            }
            if (report.ok) {
                process.exitCode = 1; // the pins are fine; a script would undo them
                continue;
            }
            if (opts.fix && report.release) {
                const set = matrix.get(report.release) as NonNullable<ReturnType<ReleaseMatrix["get"]>>;
                const plan = planBump(manifest.json, set, matrix);
                applyChanges(manifest.json, plan.changes);
                writeManifest(manifest);
                for (const c of plan.changes) console.log(`  fixed ${c.name}: ${c.from} -> ${c.to} (${c.field})`);
                console.log(`  wrote ${manifest.path}`);
                continue;
            }
            process.exitCode = 1;
        }
    });

program
    .command("show [release]")
    .description("print the packages of a release (the newest by default)")
    .action(async (release?: string) => {
        const { common, matrix, client } = context();
        const set = release ? await resolveRelease(release, matrix, client, common) : await resolveLatest(matrix, client, common);
        console.log(`release ${set.release}${set.date ? ` (${set.date})` : ""}: ${Object.keys(set.packages).length} packages`);
        for (const [name, version] of Object.entries(set.packages).sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`  ${name.padEnd(56)} ${version}`);
        }
        const external = Object.entries(set.external).sort((a, b) => a[0].localeCompare(b[0]));
        if (external.length > 0) {
            console.log("external packages this release pins:");
            for (const [name, version] of external) console.log(`  ${name.padEnd(56)} ${version}`);
        }
    });

program
    .command("releases")
    .description("list the published releases, newest first (the bundled one only when offline)")
    .action(async () => {
        const { common, matrix, client } = context();
        const releases = common.offline ? matrix.releases() : await client.versions();
        for (const release of releases) console.log(`  ${release}`);
    });

// `npx node-opcua-versions@latest` with no command is a question, not a mistake: answer with the help, exit 0
program.action(() => {
    program.help();
});

program.parseAsync(process.argv).catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
});
