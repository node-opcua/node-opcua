"use strict";

const { describeWithLeakDetector } = require("./src/resource_leak_detector");
const { takeMemorySnapshot, checkForMemoryLeak } = require("./src/mem_leak_detector");

module.exports = {
    describeWithLeakDetector,
    takeMemorySnapshot,
    checkForMemoryLeak
};