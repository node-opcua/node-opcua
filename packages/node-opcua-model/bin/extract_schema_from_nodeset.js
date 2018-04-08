"use strict";
const address_space = require("node-opcua-address-space");
var nodesets = require("node-opcua-nodesets");
const parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;

const _ = require("underscore");
const PseudoSession = require("../lib/pseudo_session").PseudoSession;

function parse_xml(nodeset_files, callback) {

    const addressSpace = new address_space.AddressSpace();

    address_space.generate_address_space(addressSpace, nodeset_files, function (err) {
        const pseudoSession = new PseudoSession(addressSpace);
        parse_opcua_common(pseudoSession, callback);
    });

}

const path = require("path");

var nodesets = [
    nodesets.standard_nodeset_file,
    nodesets.di_nodeset_filename,
    nodesets.adi_nodeset_filename,
    path.join(__dirname,"../../../modeling/my_data_type.xml")
];

parse_xml(nodesets, function () {
    console.log("done");
});
