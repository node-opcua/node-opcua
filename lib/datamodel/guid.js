var assert = require('better-assert');


var regexGUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/;

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

//                             1         2         3
//                   012345678901234567890123456789012345
exports.emptyGuid = "00000000-0000-0000-0000-000000000000";
