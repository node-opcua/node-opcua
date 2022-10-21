import { findLastKey } from "lodash";
import { AttributeIds, BrowseDirection, NodeClassMask } from "node-opcua-data-model";
import { coerceNodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";


async function serverImplementsDataTypeDefinition(session: IBasicSession): Promise<boolean> {
    // check if server provides DataTypeDefinition => in this case this is the prefered route, 
    // as we go along, more and more servers will implement this.
    const browseResult = await session.browse({
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.DataType,
        nodeId: resolveNodeId(DataType.ExtensionObject),
        referenceTypeId: "HasSubtype",
        resultMask: 63
    });
    if (!(browseResult && browseResult.references && browseResult.references.length > 0))
        return false;

    // DataType Structure from namespace 0 are not interesting and will not provide DataTypeDefinition attribute anyway
    // on some servers.
    browseResult.references = browseResult.references.filter((a, index) => a.nodeId.namespace !== 0);
    if (browseResult.references.length === 0)
        return false;

    let nodesToRead = browseResult.references.map((r) => ({
        nodeId: r.nodeId,
        attributeId: AttributeIds.DataTypeDefinition
    }));

    const nodesToRead2 = nodesToRead.map((r) => ({ nodeId: r.nodeId, attributeId: AttributeIds.IsAbstract }));
    const abstractFlags: boolean[] = (await session.read(nodesToRead2)).map((d) => d.value.value);

    // also remove the abstract dataStructure => they don't provide valid DataTypeDefinition
    nodesToRead = nodesToRead.filter((_nodesToRead, index) => !abstractFlags[index]);
    if (nodesToRead.length === 0)
        return false;

    const dataValues = await session.read(nodesToRead);

    // for (let i = 0; i < dataValues.length; i++) {
    //     console.log(i, " | ", nodesToRead[i].nodeId.toString().padEnd(40), browseResult.references[i].browseName.toString().padEnd(50), dataValues[i].statusCode.toString());
    // }

    const countOK = dataValues.reduce((prev, a) => prev + (a.statusCode === StatusCodes.Good ? 1 : 0), 0);
    if (countOK === dataValues.length) {
        return true;
        // await populateDataTypeManager104(session, dataTypeManager);
        // return;
    }

    return false;
}

export async function populateDataTypeManager(session: IBasicSession, dataTypeManager: ExtraDataTypeManager, force: boolean): Promise<void> {
    const force104 = await serverImplementsDataTypeDefinition(session);
    if (force104) {
        console.log("xxxxxxx! using 1.04");
        await populateDataTypeManager104(session, dataTypeManager);
        return;        
    }
    // old way for 1.03 and early 1.04 prototype
    await populateDataTypeManager103(session, dataTypeManager);
    // new way for 1.04 and later
    if (force) {
        await populateDataTypeManager104(session, dataTypeManager);
    }
}
