"use strict";
const assert = require("node-opcua-assert").assert;
const path = require("path");
const address_space = require("..");

const AddressSpace = address_space.AddressSpace;
const generate_address_space = address_space.generate_address_space;


const nodeset_filename = path.join(__dirname,"test_fixtures/mini.Node.Set2.xml");
const empty_nodeset_filename = path.join(__dirname,"test_fixtures/fixture_empty_nodeset2.xml");

exports.mini_nodeset_filename = nodeset_filename;
exports.empty_nodeset_filename = empty_nodeset_filename;

exports.get_mini_address_space = function (callback) {

    const addressSpace = new AddressSpace();

    // register namespace 1 (our namespace);
    const serverNamespaceIndex = addressSpace.registerNamespace("http://MYNAMESPACE");
    assert(serverNamespaceIndex === 1);

    generate_address_space(addressSpace, nodeset_filename, function (err) {
        if( err) {
            console.log("err =",err);
        }
        callback(err, addressSpace);
    });

};
