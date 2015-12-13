require("requirish")._(module);

var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var should = require("should");
var path = require("path");
var assert = require("better-assert");


exports.get_mini_address_space = function (callback) {
    var addressSpace = null;
    if (addressSpace) {
        return callback(null, addressSpace);
    }
    addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    var serverNamespaceIndex = addressSpace.registerNamespace("http://MYNAMESPACE");
    assert(serverNamespaceIndex === 1);

    var util = require("util");
    var nodeset_filename = path.join(__dirname ,"../../lib/server/mini.Node.Set2.xml");
    generate_address_space(addressSpace, nodeset_filename, function () {
        callback(null, addressSpace);
    });

};
