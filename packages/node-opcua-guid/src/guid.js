"use strict";

var regexGUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/;

/**
 * @method isValidGuid
 *
 * A valid Guid
 *   XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX
 * @param guid {String}
 * @return {Boolean} return true if the string is a valid GUID.
 */
exports.isValidGuid = function (guid) {
    return regexGUID.test(guid);
};

//                             1         2         3
//                   012345678901234567890123456789012345
exports.emptyGuid = "00000000-0000-0000-0000-000000000000";
