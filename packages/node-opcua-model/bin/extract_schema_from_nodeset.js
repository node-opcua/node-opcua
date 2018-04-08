"use strict";
var address_space = require("node-opcua-address-space");
var nodesets = require("node-opcua-nodesets");
var parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;

var _ = require("underscore");
var PseudoSession = require("../lib/pseudo_session").PseudoSession;

function parse_xml(nodeset_files, callback) {

    var addressSpace = new address_space.AddressSpace();

    address_space.generate_address_space(addressSpace, nodeset_files, function (err) {
        var pseudoSession = new PseudoSession(addressSpace);
        parse_opcua_common(pseudoSession, callback);
    });

}

var path = require("path");

var nodesets = [
    nodesets.standard_nodeset_file,
    nodesets.di_nodeset_filename,
    nodesets.adi_nodeset_filename,
    path.join(__dirname,"../../../modeling/my_data_type.xml")
];

parse_xml(nodesets, function () {
    console.log("done");
});
