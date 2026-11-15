#!/usr/bin/env node
/**
 * Verification script for parallel_test.js new features
 * Tests --noStop, --onlyFail, checkpoint resume, and cache
 */

const fs = require("fs");
const path = require("path");

// Test 1: Verify help includes new flags
console.log("\n=== Test 1: Help includes new flags ===");
const { execSync } = require("child_process");
try {
  const help = execSync("node ../src/cli.js --help --root ../../../packages", { 
    cwd: __dirname,
    encoding: "utf8",
    timeout: 5000 
  });
  
  const hasNoStop = help.includes("--noStop");
  const hasOnlyFail = help.includes("--onlyFail");
  const hasStatus = help.includes("--status");
  
  console.log(`✓ --noStop flag present: ${hasNoStop ? "YES" : "NO"}`);
  console.log(`✓ --onlyFail flag present: ${hasOnlyFail ? "YES" : "NO"}`);
  console.log(`✓ --status flag present: ${hasStatus ? "YES" : "NO"}`);
  
  if (!hasNoStop || !hasOnlyFail || !hasStatus) {
    console.log("✗ FAIL: Missing flags in help");
    process.exit(1);
  }
} catch (err) {
  console.log("✗ FAIL: Could not get help:", err.message);
  process.exit(1);
}

// Test 2: Verify status output
console.log("\n=== Test 2: Status output ===");
try {
  const status = execSync("node ../src/cli.js --status --root ../../../packages", { 
    cwd: __dirname,
    encoding: "utf8",
    timeout: 5000 
  });
  
  const hasCacheSection = status.includes("Cache Status") || status.includes("CACHE");
  const hasGitSection = status.includes("Git Status") || status.includes("GIT");
  const hasCheckpoint = status.includes("Checkpoint");
  
  console.log(`✓ Cache status section: ${hasCacheSection ? "YES" : "NO"}`);
  console.log(`✓ Git status section: ${hasGitSection ? "YES" : "NO"}`);
  console.log(`✓ Checkpoint info: ${hasCheckpoint ? "YES" : "NO"}`);
  
  if (!hasCacheSection || !hasGitSection || !hasCheckpoint) {
    console.log("✗ FAIL: Missing sections in status");
    process.exit(1);
  }
} catch (err) {
  console.log("✗ FAIL: Could not get status:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Behaviour tests on throwaway fixtures (in os.tmpdir(), nothing written here).
// Each one pins a bug that used to report green, or skip tests, wrongly.
// ---------------------------------------------------------------------------
const os = require("os");
const { spawnSync } = require("child_process");
const CLI = path.join(__dirname, "..", "src", "cli.js");

let failures = 0;
function check(name, cond, detail) {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n      ${detail || ""}`}`);
  if (!cond) failures++;
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "parallel-runner-verify-"));
  const packages = path.join(root, "packages");
  const pkg = (name, deps = {}) => {
    fs.mkdirSync(path.join(packages, name, "test"), { recursive: true });
    fs.mkdirSync(path.join(packages, name, "source"), { recursive: true });
    fs.writeFileSync(path.join(packages, name, "package.json"), JSON.stringify({ name, dependencies: deps }));
    fs.writeFileSync(path.join(packages, name, "source", "index.js"), "module.exports = 1;\n");
  };
  const spec = (name, file, body) => fs.writeFileSync(path.join(packages, name, "test", file), body);
  fs.mkdirSync(packages, { recursive: true });
  fs.writeFileSync(path.join(packages, ".gitignore"), ".para*.json\n");
  return { root, packages, pkg, spec };
}

function run(packages, args = [], env = {}) {
  const r = spawnSync(process.execPath, [CLI, "--root", packages, ...args], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, FORCE_CI: "1", CPU: "2", ...env }
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const ran = (out.match(/Actually run:\s+(\d+)/g) || []).pop();
  return { code: r.status, out, ran: ran ? Number(ran.replace(/\D+/g, "")) : NaN };
}

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

const OK = 'describe("ok", () => { it("passes", () => {}); });\n';

console.log("\n=== Test 3: failures are never reported as success ===");
{
  const { packages, pkg, spec } = makeRepo();
  pkg("a");
  spec("a", "test_syntax.js", 'describe("broken", () => { it("x", () => {});\n');
  let r = run(packages);
  check("unloadable test file -> exit 1", r.code === 1, `exit=${r.code}`);
  check("unloadable test file reported", /could not be loaded/.test(r.out), r.out.slice(-400));

  fs.rmSync(path.join(packages, "a", "test", "test_syntax.js"));
  spec("a", "test_ok.js", OK);
  spec("a", "test_fail.js", 'describe("f", () => { it("fails", () => { throw new Error("boom"); }); });\n');
  r = run(packages, ["--reset", "--noStop"]);
  check("--noStop with a failure -> exit 1", r.code === 1, `exit=${r.code}`);
  check("--noStop prints the summary once", (r.out.match(/TEST RUN SUMMARY/g) || []).length === 1);

  fs.rmSync(path.join(packages, "a", "test", "test_fail.js"));
  spec("a", "test_hook.js", 'describe("h", () => { before(() => { throw new Error("hook boom"); }); it("never", () => {}); });\n');
  r = run(packages, ["--reset", "--noStop"]);
  check("failing before() hook -> exit 1", r.code === 1, `exit=${r.code}`);
  check("failing before() hook: both files counted", r.ran === 2, `Actually run=${r.ran}`);

  fs.rmSync(path.join(packages, "a", "test", "test_hook.js"));
  spec("a", "test_exit.js", 'describe("e", () => { it("exits", () => { process.exit(0); }); });\n');
  r = run(packages, ["--reset", "--noStop"]);
  check("worker dying mid-file -> exit 1", r.code === 1, `exit=${r.code}`);
  check("worker dying mid-file: other file still ran", r.ran === 2, `Actually run=${r.ran}`);

  fs.rmSync(path.join(packages, "a", "test", "test_exit.js"));
  spec("a", "test_pending.js", 'describe("p", () => { it.skip("later", () => {}); });\n');
  r = run(packages, ["--reset"]);
  check("all green -> exit 0", r.code === 0, `exit=${r.code}\n${r.out.slice(-400)}`);
  check("pending test is shown", /○ later/.test(r.out));
}

console.log("\n=== Test 4: cache never hides a failure or a code change ===");
{
  const { root, packages, pkg, spec } = makeRepo();
  pkg("utils");
  pkg("client", { utils: "*" });
  pkg("other");
  spec("utils", "test_utils.js", OK);
  spec("client", "test_client.js", OK);
  spec("other", "test_other.js", OK);
  spec("other", "test_passfail.js", 'describe("pf", () => { it("first", () => {}); it("second", () => { throw new Error("x"); }); });\n');

  let r = run(packages, ["--reset"]);
  check("pass-then-fail file -> exit 1", r.code === 1, `exit=${r.code}`);
  r = run(packages, []);
  check("pass-then-fail file is re-run, not cached", /test_passfail\.js/.test(r.out) && r.code === 1, r.out.slice(-400));

  fs.rmSync(path.join(packages, "other", "test", "test_passfail.js"));
  run(packages, []);
  r = run(packages, []);
  check("unchanged green suite is fully cached", r.ran === 0, `Actually run=${r.ran}`);

  fs.appendFileSync(path.join(packages, "utils", "source", "index.js"), "// edit\n");
  r = run(packages, []);
  const ranFiles = (r.out.match(/test_[a-z]+\.js/g) || []).filter((v, i, a) => a.indexOf(v) === i).sort();
  check(
    "source edit re-runs the package and its dependents only",
    JSON.stringify(ranFiles) === JSON.stringify(["test_client.js", "test_utils.js"]),
    `ran: ${ranFiles.join(", ")}`
  );

  r = run(packages, ["-t", "passes"]);
  check("--testFilter does not skip cached files", r.ran === 3, `Actually run=${r.ran}`);
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("\n=== Test 5: git-aware selection ===");
if (git(os.tmpdir(), "--version").status !== 0) {
  console.log("  - git not available, skipped");
} else {
  const { root, packages, pkg, spec } = makeRepo();
  pkg("node-opcua", { "node-opcua-client": "*" });
  pkg("node-opcua-client");
  pkg("node-opcua-client-crawler");
  pkg("node-opcua-utils");
  for (const p of ["node-opcua", "node-opcua-client", "node-opcua-client-crawler", "node-opcua-utils"]) {
    spec(p, `test_${p.replace(/-/g, "_")}.js`, OK);
  }
  git(root, "init", "-q", ".");
  git(root, "add", "-A");
  git(root, "-c", "user.email=v@v", "-c", "user.name=v", "commit", "-qm", "init");
  fs.appendFileSync(path.join(packages, "node-opcua-client", "source", "index.js"), "// edit\n");

  let r = run(packages, ["--reset", "--gitAware"]);
  const ranFiles = (r.out.match(/test_node_opcua[a-z_]*\.js/g) || []).filter((v, i, a) => a.indexOf(v) === i).sort();
  check(
    "package dir prefix does not leak (node-opcua vs node-opcua-*)",
    JSON.stringify(ranFiles) === JSON.stringify(["test_node_opcua.js", "test_node_opcua_client.js"]),
    `ran: ${ranFiles.join(", ")}`
  );

  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
  r = run(packages, ["--reset", "--gitAware"]);
  check("lockfile change runs everything", r.ran === 4, `Actually run=${r.ran}`);
  fs.rmSync(path.join(root, "pnpm-lock.yaml"));

  // --since <ref>: branch commits count, commits that only landed on <ref> do not
  const G = (...a) => git(root, "-c", "user.email=v@v", "-c", "user.name=v", ...a);
  git(root, "checkout", "-q", "--", ".");
  git(root, "branch", "-q", "-M", "master");
  G("switch", "-q", "-c", "feat");
  fs.appendFileSync(path.join(packages, "node-opcua-client-crawler", "source", "index.js"), "// feat\n");
  G("commit", "-qam", "feat");
  G("switch", "-q", "master");
  fs.appendFileSync(path.join(packages, "node-opcua-utils", "source", "index.js"), "// upstream\n");
  G("commit", "-qam", "upstream");
  G("switch", "-q", "feat");
  r = run(packages, ["--reset", "-g", "--since", "master"]);
  const sinceFiles = (r.out.match(/test_node_opcua[a-z_]*\.js/g) || []).filter((v, i, a) => a.indexOf(v) === i).sort();
  check(
    "-g --since master: branch commit selected, master-only commit ignored",
    JSON.stringify(sinceFiles) === JSON.stringify(["test_node_opcua_client_crawler.js"]),
    `ran: ${sinceFiles.join(", ")}`
  );
  r = run(packages, ["--since", "no-such-ref"]);
  check("--since with an unknown ref exits 2", r.code === 2, `exit=${r.code}`);
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("\n" + "=".repeat(60));
if (failures > 0) {
  console.log(`✗ ${failures} VERIFICATION CHECK(S) FAILED`);
  console.log("=".repeat(60));
  process.exit(1);
}
console.log("✓ ALL VERIFICATION TESTS PASSED!");
console.log("=".repeat(60));
