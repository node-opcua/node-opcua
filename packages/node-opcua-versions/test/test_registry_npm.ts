import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import should from "should";
import { isPackageName, isSpecifier, npmCommand, readPeerRequirements } from "../source/registry.js";

describe("readPeerRequirements: the entries of package.json given to npm view", () => {
    it("accepts the package names npm accepts", () => {
        for (const name of ["some-package", "@sterfive/node-opcua-pro", "JSONStream", "lodash.merge"]) {
            should(isPackageName(name)).eql(true, name);
        }
    });

    it("refuses a package name that is not one", () => {
        for (const name of ["", "-x", "--registry=http://x", "a&b", "a b", "a|b", '"a"', "a;b", "../a"]) {
            should(isPackageName(name)).eql(false, name);
        }
    });

    it("accepts versions, ranges, tags and aliases", () => {
        for (const specifier of [
            "1.0.0",
            "^1.2.0",
            "~1.2",
            ">=1 <2",
            "1.x || 2.x",
            "latest",
            "*",
            "npm:other@^1",
            "github:org/repo#v1"
        ]) {
            should(isSpecifier(specifier)).eql(true, specifier);
        }
    });

    it("refuses a specifier with a command separator, a quote or a leading dash", () => {
        for (const specifier of [
            "",
            "1.0.0 & calc",
            "1.0.0 && calc",
            "1;calc",
            '1"',
            "$(calc)",
            "`calc`",
            "1\ncalc",
            "--json",
            "-1"
        ]) {
            should(isSpecifier(specifier)).eql(false, JSON.stringify(specifier));
        }
    });

    it("runs nothing that a specifier holds, and says which entry it refused", () => {
        const marker = path.join(os.tmpdir(), `versions-marker-${process.pid}.txt`);
        fs.rmSync(marker, { force: true });
        should(() => readPeerRequirements("some-package", `1.0.0 & echo x > "${marker}" & rem`)).throw(
            /some-package: not a version/
        );
        should(fs.existsSync(marker)).eql(false);
    });

    it("refuses a package name that npm would read as an option", () => {
        should(() => readPeerRequirements("--registry=http://127.0.0.1:1", "1.0.0")).throw(/not a package name/);
    });

    it("finds an npm that runs without a shell", () => {
        const npm = npmCommand();
        const version = execFileSync(npm.file, [...npm.args, "--version"], { encoding: "utf8" }).trim();
        should(version).match(/^\d+\.\d+\.\d+/);
    });

    it("does not take another package manager's script for npm", () => {
        const saved = process.env.npm_execpath;
        try {
            process.env.npm_execpath = path.join(os.tmpdir(), "pnpm.cjs");
            should(npmCommand().args.join(" ")).not.match(/pnpm/);
        } finally {
            if (saved === undefined) delete process.env.npm_execpath;
            else process.env.npm_execpath = saved;
        }
    });
});
