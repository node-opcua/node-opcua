import {
    populateDataTypeManager,
    ExtraDataTypeManager
} from "node-opcua-client-dynamic-extension-object";

import * as  chalk from "chalk";
import { IBasicSession } from "node-opcua-pseudo-session";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { resolveNodeId } from "node-opcua-nodeid";
const doDebug = false;

async function parse_opcua_common(session: IBasicSession) {
    const dataTypeManager = new ExtraDataTypeManager();

    const namespaceArrayDataValue = await session.read({
        nodeId: resolveNodeId("Server_NamespaceArray"),
        attributeId: 13,
    });
    const namespaceArray = namespaceArrayDataValue.value.value;

    console.log("Namespace Array = ", namespaceArray.join("\n                   "));
    dataTypeManager.setNamespaceArray(namespaceArray);

    for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
        const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
        dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
    }
     await populateDataTypeManager(session, dataTypeManager);
}

exports.parse_opcua_common = parse_opcua_common;
