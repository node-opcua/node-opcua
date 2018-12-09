"use strict";
const path = require("path");
exports.getFixture = function(relativeName) {
    return path.join(__dirname,relativeName);
};
