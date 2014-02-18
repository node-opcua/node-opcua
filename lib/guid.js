var assert = require('better-assert');


var regexGUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{8}/;

function is_guid(value) {
    return regexGUID.test(value);
}

exports.is_guid = is_guid;

exports.isValidGUID = function (guid) {
    assert(guid.length == 36);
    return is_guid(guid);
};
