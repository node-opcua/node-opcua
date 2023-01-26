import { findLastKey } from "lodash";
import { AttributeIds, BrowseDirection, NodeClassMask } from "node-opcua-data-model";
import { coerceNodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, browseAll } from "node-opcua-pseudo-session";
import { DataTypeIds } from "node-opcua-constants";

import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { ReferenceDescription } from "node-opcua-types";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";

async function serverImplementsDataTypeDefinition(session: IBasicSession): Promise<boolean> {
    // check if server provides DataTypeDefinition => in this case this is the prefered route,
    // as we go along, more and more servers will implement this.
    const browseResult = await browseAll(session, {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        nodeId: resolveNodeId(DataType.ExtensionObject),
        referenceTypeId: "HasSubtype",
        resultMask: 63
    });
    const browseResult2 = await browseAll(session, {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        nodeId: resolveNodeId(DataTypeIds.Union),
        referenceTypeId: "HasSubtype",
        resultMask: 63
    });

    let references: ReferenceDescription[] = [];
    if (browseResult && browseResult.references) references = references.concat(browseResult.references);
    if (browseResult2 && browseResult2.references) references = references.concat(browseResult2.references);

    if (references.length === 0) return false;

    // DataType Structure from namespace 0 are not interesting and will not provide DataTypeDefinition attribute anyway
    // on some servers.
    references = references.filter((a, index) => a.nodeId.namespace !== 0);
    if (references.length === 0) return false;

    let nodesToRead = references.map((r) => ({
        nodeId: r.nodeId,
        attributeId: AttributeIds.DataTypeDefinition
    }));

    const nodesToRead2 = nodesToRead.map((r) => ({ nodeId: r.nodeId, attributeId: AttributeIds.IsAbstract }));
    const abstractFlags: boolean[] = (await session.read(nodesToRead2)).map((d) => d.value.value);

    // also remove the abstract dataStructure => they don't provide valid DataTypeDefinition
    nodesToRead = nodesToRead.filter((_nodesToRead, index) => !abstractFlags[index]);
    if (nodesToRead.length === 0) return false;

    const dataValues = await session.read(nodesToRead);

    // for (let i = 0; i < dataValues.length; i++) {
    //     console.log(i, " | ", nodesToRead[i].nodeId.toString().padEnd(40), references[i].browseName.toString().padEnd(50), dataValues[i].statusCode.toString());
    // }

    const countOK = dataValues.reduce((prev, a) => prev + (a.statusCode.isGood() ? 1 : 0), 0);
    if (countOK === dataValues.length) {
        return true;
        // await populateDataTypeManager104(session, dataTypeManager);
        // return;
    }

    return false;
}

export async function populateDataTypeManager(
    session: IBasicSession,
    dataTypeManager: ExtraDataTypeManager,
): Promise<void> {
    const force104 = await serverImplementsDataTypeDefinition(session);
    if (force104) {
        // console.log("xxxxxxx! using 1.04");
        await populateDataTypeManager104(session, dataTypeManager);
        return;
    }
    // old way for 1.03 and early 1.04 prototype
    await populateDataTypeManager103(session, dataTypeManager);
    await populateDataTypeManager104(session, dataTypeManager);
}
