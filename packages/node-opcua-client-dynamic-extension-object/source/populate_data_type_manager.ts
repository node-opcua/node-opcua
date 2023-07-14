import { AttributeIds, BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession, browseAll } from "node-opcua-pseudo-session";
import { DataTypeIds, ObjectIds, ObjectTypeIds, VariableTypeIds } from "node-opcua-constants";
import { DataType } from "node-opcua-variant";
import { ReferenceDescription } from "node-opcua-types";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";

/**
 * @private
 */
export async function serverImplementsDataTypeDefinition(session: IBasicSession): Promise<boolean> {
    // One way to figure out is to check if the server provides DataTypeDefinition node
    // ( see OPCUA 1.04 part 6 -)
    // This is the preferred route, as we go along, more and more servers will implement this.
    const browseResult1 = await browseAll(session, {
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true,
        nodeClassMask: NodeClassMask.Variable,
        nodeId: resolveNodeId(ObjectIds.OPCBinarySchema_TypeSystem),
        resultMask: ResultMask.TypeDefinition
    });

    let count103DataType = 0;
    for (const ref of browseResult1.references || []) {
        const td = ref.typeDefinition;
        if (!(td.namespace === 0 && td.value === VariableTypeIds.DataTypeDictionaryType)) continue;
        // we have a type definition,
        // let check if there is a deprecated property
        const p = await session.translateBrowsePath(makeBrowsePath(ref.nodeId, "/Deprecated"));
        if (!p.statusCode.isGood() || !p.targets || p.targets.length === 0) {
            // the dataTypeDictionaryType is not exposing a Deprecated property
            count103DataType++;
            continue;
        }
        const deprecatedNodeId = p.targets[0].targetId;
        // we have a deprecated property => this is a 1.03 server or 1.04
        // => we need to check if the server provides DataTypeDefinition
        const dataValue = await session.read({ nodeId: deprecatedNodeId, attributeId: AttributeIds.Value });
        if (dataValue.statusCode.isGood() && dataValue.value.value === false) {
            // this is a 1.03 server
            count103DataType++;
            continue;
        }
    }
    if (count103DataType >= 1) {
        // some namespace are old , we cannot assume that all namespace are 1.04
        return false;
    }

    // check if server provides DataTypeDefinition => in this case this is the preferred route,
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

    const countOK = dataValues.reduce((prev, a) => prev + (a.statusCode.isGood() ? 1 : 0), 0);
    if (countOK === dataValues.length) {
        return true;
        // await populateDataTypeManager104(session, dataTypeManager);
        // return;
    }

    return false;
}

export async function populateDataTypeManager(session: IBasicSession, dataTypeManager: ExtraDataTypeManager): Promise<void> {
    const force104 = await serverImplementsDataTypeDefinition(session);
    if (force104) {
        await populateDataTypeManager104(session, dataTypeManager);
        return;
    }
    // old way for 1.03 and early 1.04 prototype
    await populateDataTypeManager103(session, dataTypeManager);
    await populateDataTypeManager104(session, dataTypeManager);
}
