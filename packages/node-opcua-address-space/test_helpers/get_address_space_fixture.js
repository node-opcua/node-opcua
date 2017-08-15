"use strict";
var path = require("path");
var fs = require("fs");

function getAddressSpaceFixture(pathname) {
    var filename =  path.join(__dirname,"./test_fixtures",pathname);
    if (!fs.existsSync(filename)) {
        throw new Error(" cannot find fixture with name " + pathname);
    }
    return filename;
}
exports.getAddressSpaceFixture = getAddressSpaceFixture;
