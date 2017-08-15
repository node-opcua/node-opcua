"use strict";

exports.validateLocaleId = function (/*value*/) {
    // TODO : check that localeID is well-formed
    // see part 3 $8.4 page 63
    return true;
};

exports.encodeLocaleId = require("./string").encodeString;
exports.decodeLocaleId = require("./string").decodeString;
