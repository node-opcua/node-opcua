var assert = require('better-assert');


var regexGUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{8}/;

/**
 * @method isValidGuid
 *
 * A valid Guid
 *   XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX
 * @param guid
 * @returns {*}
 */
exports.isValidGuid = function (guid) {
    return regexGUID.test(guid);
};

//                   12345678-0123-5678-0123-56789012
exports.emptyGuid = "00000000-0000-0000-0000-00000000";
