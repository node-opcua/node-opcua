"use strict"
const crypto = require("crypto");
const assert = require("node-opcua-assert").assert;
function makeApplicationUrn(hostname, suffix) {

    // beware : Openssl doesn't support urn with length greater than 64 !!
    //          sometimes hostname length could be too long ...
    // application urn length must not exceed 64 car. to comply with openssl
    // see cryptoCA
    let hostname_hash = hostname;
    if (hostname_hash.length + 7 + suffix.length >=64 ) {
        // we need to reduce the applicationUrn side => let's take
        // a portion of the hostname hash.
        hostname_hash = crypto.createHash('md5').update(hostname).digest('hex').substr(0, 16);
    }

    const applicationUrn = "urn:" + hostname_hash + ":" + suffix;
    assert(applicationUrn.length <= 64);
    return applicationUrn;
}
exports.makeApplicationUrn = makeApplicationUrn;
