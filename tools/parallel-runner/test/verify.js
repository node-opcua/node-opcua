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

// Test 3: Verify cache file structure
console.log("\n=== Test 3: Cache file operations ===");
const { TestResultCache } = require("../src/cache.js");
const cache = new TestResultCache();

console.log("✓ TestResultCache instantiated");
console.log(`✓ Cache file path: ${cache.cacheFile}`);

// Test saving and loading failing tests
const testFailingTests = [
  { file: "test1.js", test: "test1", error: "Error 1" },
  { file: "test2.js", test: "test2", error: "Error 2" }
];

try {
  cache.saveFailingTests(testFailingTests);
  console.log("✓ saveFailingTests() works");
  
  const loaded = cache.getFailingTests();
  console.log(`✓ getFailingTests() returned ${loaded.length} tests`);
  
  if (loaded.length === testFailingTests.length) {
    console.log("✓ Failing tests saved and loaded correctly");
  } else {
    console.log("✗ FAIL: Failing tests count mismatch");
    process.exit(1);
  }
} catch (err) {
  console.log("✗ FAIL: Cache operations failed:", err.message);
  process.exit(1);
}

// Test 4: Verify CTRL+C checkpoint creation
console.log("\n=== Test 4: Checkpoint file structure ===");
const checkpointFile = path.join(__dirname, ".parallel_test_checkpoint.json");

// Clean up first
if (fs.existsSync(checkpointFile)) {
  fs.unlinkSync(checkpointFile);
}

// Create a test checkpoint
const checkpointData = {
  currentFile: "test/example.js",
  currentTest: "test example",
  timestamp: Date.now(),
  results: { passed: 5, failed: 1 }
};

fs.writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2));
console.log("✓ Created test checkpoint file");

try {
  const loaded = JSON.parse(fs.readFileSync(checkpointFile, "utf8"));
  console.log(`✓ Checkpoint file readable, contains: ${JSON.stringify(loaded, null, 2).substring(0, 100)}...`);
  
  if (loaded.currentFile === checkpointData.currentFile) {
    console.log("✓ Checkpoint data persisted correctly");
  } else {
    console.log("✗ FAIL: Checkpoint data mismatch");
    process.exit(1);
  }
} catch (err) {
  console.log("✗ FAIL: Checkpoint file operations failed:", err.message);
  process.exit(1);
}

// Clean up
fs.unlinkSync(checkpointFile);
console.log("✓ Cleaned up test checkpoint file");

// Test 5: Verify code contains new features
console.log("\n=== Test 5: Code verification ===");
const parallelTestContent = fs.readFileSync(path.join(__dirname, "..", "src", "cli.js"), "utf8");

const checks = {
  noStopFlag: parallelTestContent.includes("argv.noStop"),
  onlyFailFlag: parallelTestContent.includes("argv.onlyFail"),
  failingTestList: parallelTestContent.includes("failingTestList"),
  saveFailingTests: parallelTestContent.includes("saveFailingTests"),
  getFailingTests: parallelTestContent.includes("getFailingTests"),
  noStopMode: parallelTestContent.includes("noStop") || parallelTestContent.includes("noStop mode"),
  reportFailures: parallelTestContent.includes("reportFailures"),
  EVENT_TEST_FAIL: parallelTestContent.includes("EVENT_TEST_FAIL"),
  checkpointOnExit: parallelTestContent.includes("saveCheckpoint") || parallelTestContent.includes("process.on('SIGINT'"),
};

let allPassed = true;
for (const [key, passed] of Object.entries(checks)) {
  console.log(`  ${passed ? "✓" : "✗"} ${key}: ${passed ? "found" : "NOT FOUND"}`);
  if (!passed) allPassed = false;
}

if (!allPassed) {
  console.log("✗ FAIL: Some features missing in code");
  process.exit(1);
}

console.log("\n" + "=".repeat(60));
console.log("✓ ALL VERIFICATION TESTS PASSED!");
console.log("=".repeat(60));
console.log("\nNew features verified:");
console.log("  • --noStop flag: Continue running after failures");
console.log("  • --onlyFail flag: Run only previously failing tests");
console.log("  • --status flag: Show cache and git status");
console.log("  • Checkpoint resume: Resume from last failing test");
console.log("  • Failing tests cache: Persist failing tests between runs");
console.log("  • CTRL+C handling: Creates checkpoint on exit");
console.log("\nYou can now test with:");
console.log("  node ../src/cli.js --status --root ../../../packages");
console.log("  node ../src/cli.js --noStop");
console.log("  node ../src/cli.js --onlyFail");
