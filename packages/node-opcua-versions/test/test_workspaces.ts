import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "should";
import {
    discoverAllManifests,
    discoverWorkspaceManifests,
    installRootFor,
    installRoots,
    pnpmPackagesList,
    workspacePatterns
} from "../source/workspaces.js";

describe("pnpmPackagesList", () => {
    it("reads the packages list, with quotes, comments and other keys around it", () => {
        const yaml = [
            "# a glob rather than a hand-maintained list",
            "packages:",
            "  - packages/*",
            "  - 'experiment'",
            '  - "!**/test/**"',
            "allowBuilds:",
            "  esbuild: true",
            "overrides:",
            "  - not-a-package"
        ].join("\n");
        pnpmPackagesList(yaml).should.eql(["packages/*", "experiment", "!**/test/**"]);
    });
});

describe("discoverWorkspaceManifests", () => {
    let root: string;
    const write = (file: string, content: string) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    };
    const rel = (files: string[]) => files.map((f) => path.relative(root, f).replace(/\\/g, "/"));

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "nov-ws-"));
        write(path.join(root, "package.json"), '{ "name": "root", "private": true }');
        write(path.join(root, "packages", "a", "package.json"), '{ "name": "a" }');
        write(path.join(root, "packages", "b", "package.json"), '{ "name": "b" }');
        write(path.join(root, "packages", "b", "node_modules", "x", "package.json"), '{ "name": "x" }');
        write(path.join(root, "packages", "no-manifest", "README.md"), "");
        write(path.join(root, "experiment", "package.json"), '{ "name": "experiment" }');
        write(path.join(root, "packages", "a", "test", "package.json"), '{ "name": "a-test" }');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it("uses pnpm-workspace.yaml first, root manifest first in the result, exclusions honoured", () => {
        write(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n  - experiment\n  - '!**/test/**'\n");
        write(path.join(root, "lerna.json"), '{ "packages": ["nowhere/*"] }');
        rel(discoverWorkspaceManifests(root)).should.eql([
            "package.json",
            "experiment/package.json",
            "packages/a/package.json",
            "packages/b/package.json"
        ]);
    });
    it("falls back to package.json workspaces, in both shapes", () => {
        write(path.join(root, "package.json"), '{ "name": "root", "workspaces": ["packages/*"] }');
        rel(discoverWorkspaceManifests(root)).should.eql(["package.json", "packages/a/package.json", "packages/b/package.json"]);
        write(path.join(root, "package.json"), '{ "name": "root", "workspaces": { "packages": ["experiment"] } }');
        rel(discoverWorkspaceManifests(root)).should.eql(["package.json", "experiment/package.json"]);
    });
    it("falls back to lerna.json, and walks <dir>/** recursively without entering node_modules", () => {
        write(path.join(root, "lerna.json"), '{ "packages": ["packages/**"] }');
        rel(discoverWorkspaceManifests(root)).should.eql([
            "package.json",
            "packages/a/package.json",
            "packages/a/test/package.json",
            "packages/b/package.json"
        ]);
    });
    it("is a single package when nothing declares a workspace", () => {
        workspacePatterns(root).should.eql([]);
        rel(discoverWorkspaceManifests(root)).should.eql(["package.json"]);
    });
});

describe("discoverAllManifests and install roots", () => {
    let root: string;
    const write = (file: string, content: string) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    };
    const rel = (p: string) => path.relative(root, p).replace(/\\/g, "/");

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "nov-all-"));
        write(path.join(root, "package.json"), "{}");
        write(path.join(root, "pnpm-lock.yaml"), "");
        write(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n  - '!packages/snap'\n");
        write(path.join(root, "packages", "a", "package.json"), "{}");
        write(path.join(root, "packages", "saas", "package.json"), "{}");
        write(path.join(root, "packages", "saas", "pnpm-lock.yaml"), "");
        write(path.join(root, "packages", "snap", "package.json"), "{}");
        write(path.join(root, "packages", "snap", "package-lock.json"), "");
        write(path.join(root, "extra", "rule-engine", "package.json"), "{}");
        write(path.join(root, "packages", "a", "node_modules", "x", "package.json"), "{}");
        write(path.join(root, "packages", "a", "dist", "package.json"), "{}");
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it("--all reaches what the workspace excludes, and never node_modules or build output", () => {
        discoverAllManifests(root)
            .map(rel)
            .should.eql([
                "package.json",
                "extra/rule-engine/package.json",
                "packages/a/package.json",
                "packages/saas/package.json",
                "packages/snap/package.json"
            ]);
        discoverWorkspaceManifests(root)
            .map(rel)
            .should.eql(["package.json", "packages/a/package.json", "packages/saas/package.json"]);
    });
    it("installs where the lockfile is: the root for managed packages, each independent package for itself", () => {
        installRootFor(path.join(root, "packages", "a", "package.json"), root).should.eql({ dir: root, command: "pnpm install" });
        installRootFor(path.join(root, "packages", "saas", "package.json"), root).should.eql({
            dir: path.join(root, "packages", "saas"),
            command: "pnpm install"
        });
        installRootFor(path.join(root, "packages", "snap", "package.json"), root).should.eql({
            dir: path.join(root, "packages", "snap"),
            command: "npm install"
        });
        // no lockfile anywhere: the packageManager field decides, npm as the last resort
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), "nov-bare-"));
        write(path.join(bare, "package.json"), '{ "packageManager": "yarn@4.5.0" }');
        write(path.join(bare, "packages", "x", "package.json"), "{}");
        installRootFor(path.join(bare, "packages", "x", "package.json"), bare).should.eql({ dir: bare, command: "yarn install" });
        write(path.join(bare, "package.json"), "{}");
        installRootFor(path.join(bare, "packages", "x", "package.json"), bare).command.should.eql("npm install");
        fs.rmSync(bare, { recursive: true, force: true });
        const roots = installRoots(discoverAllManifests(root), root);
        roots
            .map((r) => `${rel(r.dir) || "."}: ${r.command}`)
            .should.eql([".: pnpm install", "packages/saas: pnpm install", "packages/snap: npm install"]);
    });
});
