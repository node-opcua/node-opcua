import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { hexDump, make_warningLog } from "node-opcua-debug";
import { IBasicSession } from "node-opcua-pseudo-session";
import { NodeId } from "node-opcua-nodeid";
import { ConstructorFunc } from "node-opcua-factory";
import { BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { readDataTypeDefinitionAndBuildType } from "./private/populate_data_type_manager_104";

const warningLog = make_warningLog(__filename);

async function getOrExtractConstructor(
    session: IBasicSession,
    binaryEncodingNodeId: NodeId,
    dataTypeManager: ExtraDataTypeManager
): Promise<ConstructorFunc> {
    const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);
    const Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
    if (Constructor) {
        return Constructor;
    }
    if (binaryEncodingNodeId.namespace === 0) {
        throw new Error("Internal Error");
    }
    // need to extract it
    const browseResult = await session.browse({
        nodeId: binaryEncodingNodeId,
        referenceTypeId: "HasEncoding",
        browseDirection: BrowseDirection.Inverse,
        includeSubtypes: false,
        nodeClassMask: NodeClassMask.DataType,
        resultMask: ResultMask.BrowseName
    });
    if (browseResult.statusCode !== StatusCodes.Good || browseResult.references!.length !== 1) {
        throw new Error("browse failed");
    }
    const r = browseResult.references![0];
    const dataTypeNodeId = r.nodeId;

    if (dataTypeFactory.getConstructorForDataType(dataTypeNodeId)) {
        throw new Error("Internal Error: we are not expecting this dataType to be processed already");
    }
    await readDataTypeDefinitionAndBuildType(session, dataTypeNodeId, r.browseName.name!, dataTypeFactory, {});

    return dataTypeFactory.getConstructorForDataType(dataTypeNodeId)!;
}

async function resolveDynamicExtensionObjectV(
    session: IBasicSession,
    opaque: OpaqueStructure,
    dataTypeManager: ExtraDataTypeManager
): Promise<ExtensionObject> {
    try {
        const Constructor = await getOrExtractConstructor(session, opaque.nodeId, dataTypeManager);
        const object = new Constructor();
        const stream = new BinaryStream(opaque.buffer);
        try {
            object.decode(stream);
            return object as ExtensionObject;
        } catch (err) {
            warningLog("Constructor = ", Constructor.name);
            warningLog("opaqueStructure = ", opaque?.nodeId?.toString());
            warningLog("opaqueStructure = ", "0x" + opaque?.buffer?.toString("hex"));
            warningLog(hexDump(opaque.buffer));
            warningLog("resolveDynamicExtensionObjectV err = ", err);
            // try again for debugging
            object.decode(stream);
            return opaque;
        }
    } catch (err) {
        warningLog("err", err);
        warningLog("opaqueStructure = ", opaque.nodeId.toString());
        warningLog("opaqueStructure = ", "0x" + opaque.buffer.toString("hex"));
        warningLog(hexDump(opaque.buffer));
        warningLog(dataTypeManager.toString());
        throw err;
    }
}

export async function resolveDynamicExtensionObject(
    session: IBasicSession,
    variant: Variant,
    dataTypeManager: ExtraDataTypeManager
): Promise<void> {
    if (variant.dataType !== DataType.ExtensionObject) {
        return;
    }
    if (variant.arrayType !== VariantArrayType.Scalar) {
        if (variant.value instanceof Array) {
            for (let i = 0; i < variant.value.length; i++) {
                if (variant.value[i] instanceof OpaqueStructure) {
                    variant.value[i] = await resolveDynamicExtensionObjectV(session, variant.value[i], dataTypeManager);
                }
            }
        }
        return;
    }

    if (!(variant.value instanceof OpaqueStructure)) {
        return;
    }
    variant.value = await resolveDynamicExtensionObjectV(session, variant.value, dataTypeManager);
}
