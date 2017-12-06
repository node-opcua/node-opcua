"use strict";
var assert = require("node-opcua-assert");
var path = require("path");
var address_space = require("..");

var AddressSpace = address_space.AddressSpace;
var generate_address_space = address_space.generate_address_space;


var nodeset_filename = path.join(__dirname,"test_fixtures/mini.Node.Set2.xml");
var empty_nodeset_filename = path.join(__dirname,"test_fixtures/fixture_empty_nodeset2.xml");

exports.mini_nodeset_filename = nodeset_filename;
exports.empty_nodeset_filename = empty_nodeset_filename;

exports.get_mini_address_space = function (callback) {

    var addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    var serverNamespaceIndex = addressSpace.registerNamespace("http://MYNAMESPACE");
    assert(serverNamespaceIndex === 1);

    generate_address_space(addressSpace, nodeset_filename, function (err) {
        if( err) {
            console.log("err =",err);
        }
        callback(err, addressSpace);
    });

};
