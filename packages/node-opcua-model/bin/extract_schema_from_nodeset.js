"use strict";
const { AddressSpace, PseudoSession } = require("node-opcua-address-space");
const { generateAddressSpace } = require("node-opcua-address-space/nodeJS");
const { nodesets } = require("node-opcua-nodesets");

const { parse_opcua_common } = require("..");

async function parse_xml(nodeset_files) {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodeset_files);

    addressSpace.rootFolder.objects.server.namespaceArray.setValueFromSource({
        dataType: "String",
        value: addressSpace.getNamespaceArray().map(n=>n.namespaceUri)
    })
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
