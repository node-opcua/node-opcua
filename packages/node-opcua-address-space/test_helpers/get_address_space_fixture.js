"use strict";
const path = require("path");
const fs = require("fs");

function getAddressSpaceFixture(pathname) {
    const filename =  path.join(__dirname,"./test_fixtures",pathname);
    if (!fs.existsSync(filename)) {
        throw new Error(" cannot find fixture with name " + pathname);
    }
    return filename;
}
exports.getAddressSpaceFixture = getAddressSpaceFixture;
