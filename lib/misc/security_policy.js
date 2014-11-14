"use strict";
/**
 * @module opcua.miscellaneous
 */
var Enum = require("enum");

var SecurityPolicy = new Enum({
    None:          "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128:      "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic128Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
    Basic192:      "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256:      "http://opcfoundation.org/UA/SecurityPolicy#Basic256",
    Basic256Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256:"http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
});

SecurityPolicy.fromURI = function(uri) {
    var a = uri.split("#");
    return this[a[1]];
};

SecurityPolicy.toURI = function(value) {

    var securityPolicy = SecurityPolicy.get(value);
    return securityPolicy.value;
};

exports.SecurityPolicy =  SecurityPolicy;