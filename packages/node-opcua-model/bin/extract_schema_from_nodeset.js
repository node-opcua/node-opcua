"use strict";
const address_space = require("node-opcua-address-space");
const nodesets = require("node-opcua-nodesets");
const parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;

const _ = require("underscore");
const PseudoSession = require("../lib/pseudo_session").PseudoSession;

async function parse_xml(nodeset_files) {
    const addressSpace = new address_space.AddressSpace();
    await address_space.generateAddressSpace(addressSpace, nodeset_files);
    const pseudoSession = new PseudoSession(addressSpace);
    await parse_opcua_common(pseudoSession);
}

const path = require("path");

const g_nodesets = [
    nodesets.standard_nodeset_file,
    nodesets.di_nodeset_filename,
    nodesets.adi_nodeset_filename,
    path.join(__dirname,"../../../modeling/my_data_type.xml")
];

(async ()=> {
    await parse_xml(g_nodesets);
    console.log("done");
})();

