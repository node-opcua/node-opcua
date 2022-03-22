import { IAddressSpace, UADataType } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId } from "node-opcua-nodeid";
import { NodeClass, StructureDefinition } from "node-opcua-types";
import { Xml2Json } from "node-opcua-xml2json";

import { ensureDatatypeExtracted } from "./ensure_datatype_extracted";
import { makeXmlExtensionObjectReader, TypeInfo } from "./make_xml_extension_object_parser";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

function encodingNodeIdToDataTypeNode(addressSpace: IAddressSpace, encodingNodeId: NodeId): UADataType {
    const encodingNode = addressSpace.findNode(encodingNodeId)!;

    // istanbul ignore next
    if (!encodingNode) {
        throw new Error("findDataTypeNode:  Cannot find encoding NodeId" + encodingNodeId.toString());
    }
    // xx console.log("encodingNode", encodingNode.toString());
    const refs = encodingNode.findReferences("HasEncoding", false);
    const dataTypes = refs.map((ref) => addressSpace.findNode(ref.nodeId)).filter((obj: any) => obj !== null);
    // istanbul ignore next
    if (dataTypes.length !== 1) {
        throw new Error("Internal Error");
    }
    const dataTypeNode = dataTypes[0] as UADataType;
    return dataTypeNode;
}
export function decodeXmlExtensionObject(
    addressSpace: IAddressSpace,
    encodingNodeId: NodeId,
    xmlBody: string
): ExtensionObject | null {

    const definitionMap = {
        findDefinition(dataTypeNodeId: NodeId): TypeInfo {
            const dataTypeNode = addressSpace.findDataType(dataTypeNodeId);
            if (!dataTypeNode) {
                throw new Error("cannot find dataType " + dataTypeNodeId.toString());
            }
            if (dataTypeNode.nodeClass !== NodeClass.DataType) {
                throw new Error("Expecting a DataType node here");
            }
            const name =  dataTypeNode.browseName.name || "";
            // console.log("yy)=", dataTypeNode.toString());
            if (dataTypeNode.isStructure()) {
                const definition = dataTypeNode.getStructureDefinition();
                return { name, definition };
    
            } else if (dataTypeNode.isEnumeration()) {
                const definition = dataTypeNode.getEnumDefinition();
                return { name, definition };   
            } else {
                const dataType = dataTypeNode.getBasicDataType();
                return { name, definition: { dataType }}
            }
        }
    };

    const dataType = encodingNodeIdToDataTypeNode(addressSpace, encodingNodeId)!;

    //  const { name, definition } = definitionMap.findDefinition(dataType.nodeId);
    // const hasOptionalFields = definition.fields!.some((field) => field.isOptional);

    const reader = makeXmlExtensionObjectReader(dataType.nodeId, definitionMap, {});
    const parser2 = new Xml2Json(reader);
    const pojo = parser2.parseStringSync(xmlBody);

    const userDefinedExtensionObject = addressSpace.constructExtensionObject(dataType, pojo);

    // istanbul ignore next
    if (doDebug) {
        debugLog("userDefinedExtensionObject", userDefinedExtensionObject.toString());
    }
    //
    return userDefinedExtensionObject;
}

/// ------------------------ Legacy stuff ---------------------------------

// function findDataTypeNode(addressSpace: IAddressSpace, encodingNodeId: NodeId): UADataType {
//     const encodingNode = addressSpace.findNode(encodingNodeId)!;

//     // istanbul ignore next
//     if (!encodingNode) {
//         throw new Error("findDataTypeNode:  Cannot find encoding NodeId" + encodingNodeId.toString());
//     }
//     // xx console.log("encodingNode", encodingNode.toString());

//     const refs = encodingNode.findReferences("HasEncoding", false);
//     const dataTypes = refs.map((ref) => addressSpace.findNode(ref.nodeId)).filter((obj: any) => obj !== null);

//     // istanbul ignore next
//     if (dataTypes.length !== 1) {
//         throw new Error("Internal Error");
//     }

//     const dataTypeNode = dataTypes[0] as UADataType;
//     // istanbul ignore next
//     if (dataTypeNode.nodeClass !== NodeClass.DataType) {
//         throw new Error("internal error: expecting a UADataType node here");
//     }
//     return dataTypeNode;
// }

// function decodeXmlObject2(
//     addressSpace: IAddressSpace,
//     dataTypeFactory: DataTypeFactory,
//     xmlEncodingNodeId: NodeId,
//     xmlBody: string
// ): ExtensionObject | null {
//     const dataTypeNode = findDataTypeNode(addressSpace, xmlEncodingNodeId);

//     // istanbul ignore next
//     if (!dataTypeNode) {
//         debugLog(" cannot find ", xmlEncodingNodeId.toString());
//         return null;
//     }
//     const dataTypeName = dataTypeNode.browseName.name!;
//     const definitionMap = {
//         findDefinition(name: string): Definition {
//             debugLog(chalk.magentaBright("xxxxxxxxxxxxx !!!! "), name);
//             if (!name) {
//                 return { name: "", fields: [] };
//             }
//             return dataTypeFactory.getStructuredTypeSchema(name) as any as Definition;
//         }
//     };
//     const reader = makeExtensionObjectReader(dataTypeName, definitionMap, {});
//     const parser2 = new Xml2Json(reader);
//     const pojo = parser2.parseStringSync(xmlBody);
//     // at this time the bsd file containing object definition
//     // must have been found and object can be constructed
//     const userDefinedExtensionObject = addressSpace.constructExtensionObject(dataTypeNode, pojo);

//     // istanbul ignore next
//     if (doDebug) {
//         debugLog("userDefinedExtensionObject", userDefinedExtensionObject.toString());
//     }
//     //
//     return userDefinedExtensionObject;
// }

// export async function decodeXmlObject(
//     addressSpace: IAddressSpace,
//     xmlEncodingNodeId: NodeId,
//     xmlBody: string
// ): Promise<ExtensionObject | null> {
//     const dataTypeManager = await ensureDatatypeExtracted(addressSpace);
//     const dataTypeFactory = dataTypeManager.getDataTypeFactory(xmlEncodingNodeId.namespace);
//     return decodeXmlObject2(addressSpace, dataTypeFactory, xmlEncodingNodeId, xmlBody);
// }
