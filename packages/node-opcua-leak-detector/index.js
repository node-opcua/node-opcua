"use strict";
module.exports = {
    describeWithLeakDetector: require("./src/resource_leak_detector").describeWithLeakDetector,
    takeMemorySnapshot: require("./src/mem_leak_detector").takeMemorySnapshot,
    checkForMemoryLeak: require("./src/mem_leak_detector").checkForMemoryLeak
};