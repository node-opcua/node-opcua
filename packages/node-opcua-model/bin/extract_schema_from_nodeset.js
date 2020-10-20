"use strict";
const {
    AddressSpace,
} = require("node-opcua-address-space");
const { generateAddressSpace } = require("node-opcua-address-space/testHelpers");

const nodesets = require("node-opcua-nodesets");
const {
    parse_opcua_common
} = require("../lib/parse_server_common");

const PseudoSession = require("../lib/pseudo_session").PseudoSession;

async function parse_xml(nodeset_files) {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodeset_files);
    const pseudoSession = new PseudoSession(addressSpace);
    await parse_opcua_common(pseudoSession);
}

const path = require("path");

const g_nodesets = [
    nodesets.standard,
    nodesets.di,
    nodesets.adi,
    path.join(__dirname, "../../../modeling/my_data_type.xml")
];

(async () => {
    await parse_xml(g_nodesets);
    console.log("done");
})();

