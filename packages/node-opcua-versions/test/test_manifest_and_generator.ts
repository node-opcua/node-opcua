import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "should";
import { parseManifest, serializeManifest } from "../source/index.js";

describe("manifest formatting is preserved", () => {
    it("keeps two-space indentation, CRLF and the trailing newline", () => {
        const raw = '{\r\n  "name": "x",\r\n  "dependencies": {\r\n    "node-opcua": "2.179.0"\r\n  }\r\n}\r\n';
        const m = parseManifest("package.json", raw);
        m.indent.should.eql("  ");
        m.eol.should.eql("\r\n");
        m.trailingNewline.should.eql(true);
        serializeManifest(m).should.eql(raw);
        m.json.dependencies!["node-opcua"] = "2.181.1";
        serializeManifest(m).should.eql(raw.replace("2.179.0", "2.181.1"));
    });
    it("keeps tabs and the absence of a trailing newline", () => {
        const raw = '{\n\t"name": "x"\n}';
        const m = parseManifest("package.json", raw);
        m.indent.should.eql("\t");
        m.trailingNewline.should.eql(false);
        serializeManifest(m).should.eql(raw);
    });
});

describe("tools/generate-release-set.mjs (maintainer tool, not shipped)", function () {
    this.timeout(60000);
    const script = path.join(import.meta.dirname, "..", "..", "..", "tools", "generate-release-set.mjs");
    let root: string;
    let outDir: string;

    const write = (file: string, json: unknown) => {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(json, null, 4)}\n`);
    };
    const manifest = () => JSON.parse(fs.readFileSync(path.join(outDir, "package.json"), "utf8"));
    const run = (args: string[]) =>
        execFileSync(process.execPath, [script, "--root", root, "--manifest", path.join(outDir, "package.json"), ...args], {
            cwd: outDir,
            encoding: "utf8"
        });

    beforeEach(() => {
        // a plain folder, deliberately not a git repository: the workspace, not a tag, describes the release
        root = fs.mkdtempSync(path.join(os.tmpdir(), "nov-root-"));
        write(path.join(root, "lerna.json"), { packages: ["packages/*", "packages_extra/*"], version: "2.181.1" });
        write(path.join(root, "packages", "a", "package.json"), {
            name: "node-opcua",
            version: "2.181.1",
            dependencies: { "node-opcua-debug": "2.181.0", "node-opcua-crypto": "5.10.1", semver: "^7.0.0" }
        });
        write(path.join(root, "packages", "b", "package.json"), {
            name: "node-opcua-debug",
            version: "2.181.0",
            dependencies: { "node-opcua-pki": "6.22.0", "node-opcua-example": "workspace:*" }
        });
        write(path.join(root, "packages", "c", "package.json"), { name: "secret", version: "1.0.0", private: true });
        write(path.join(root, "packages_extra", "d", "package.json"), { name: "node-opcua-example", version: "2.170.0" });
        // the manifest the tool describes: a private copy of the package's, at the release's version
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), "nov-pkg-"));
        write(path.join(outDir, "package.json"), { name: "node-opcua-versions", version: "2.181.1" });
    });

    it("does not write without --write: it reports, and --check turns a stale field into a failure", () => {
        const before = fs.readFileSync(path.join(outDir, "package.json"), "utf8");
        (() => run([])).should.not.throw(); // stale, but a bare run only reports (exit 0)
        fs.readFileSync(path.join(outDir, "package.json"), "utf8").should.eql(before);
        (() => run(["--check"])).should.throw(/does not describe release/);
    });

    it("writes the public packages of the workspace and the external pins into the manifest field", () => {
        run(["--write"]).should.match(/release 2\.181\.1: 4 packages/);
        const set = manifest().nodeOpcuaRelease;
        set.release.should.eql("2.181.1");
        set.date.should.match(/^\d{4}-\d{2}-\d{2}$/);
        // the private "secret" package is skipped; node-opcua-versions itself is always in the set
        set.packages.should.eql({
            "node-opcua": "2.181.1",
            "node-opcua-debug": "2.181.0",
            "node-opcua-example": "2.170.0",
            "node-opcua-versions": "2.181.1"
        });
        // external node-opcua packages the workspace pins; a workspace link is not a pin
        set.external.should.eql({ "node-opcua-crypto": "5.10.1", "node-opcua-pki": "6.22.0" });
        // the rest of the manifest is untouched
        manifest().name.should.eql("node-opcua-versions");
    });

    it("--check passes after generation and fails once the workspace moved on", () => {
        run(["--write"]);
        run([]).should.match(/describes release 2\.181\.1/);
        run(["--check"]).should.match(/describes release 2\.181\.1/);
        write(path.join(root, "packages", "b", "package.json"), { name: "node-opcua-debug", version: "2.181.1" });
        (() => run(["--check"])).should.throw(/does not describe release/);
    });

    it("refuses to describe a release the package is not versioned as", () => {
        write(path.join(outDir, "package.json"), { name: "node-opcua-versions", version: "2.180.0" });
        (() => run(["--write"])).should.throw(/must equal the release name/);
    });

    it("fails clearly when the workspace has no public package", () => {
        fs.rmSync(path.join(root, "packages"), { recursive: true });
        fs.rmSync(path.join(root, "packages_extra"), { recursive: true });
        (() => run(["--write"])).should.throw(/no public package/);
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(outDir, { recursive: true, force: true });
    });
});
