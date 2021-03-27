import { wrapper } from "text-wrapper";
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { EnumDefinition, ReferenceDescription, StructureDefinition, _enumerationDataChangeTrigger } from "node-opcua-types";
import { LineFile, lowerFirstLetter } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import {
    convertNodeIdToDataTypeAsync,
    getBrowseName,
    getChildren,
    getIsAbstract,
    getDefinition,
    getDescription,
    getFolderElements,
    getModellingRule,
    getNodeClass,
    getSubtypeNodeId,
    getTypeDefinition
} from "./utils";

import { Cache, constructCache, makeTypeName } from "./cache";

export async function convertDataTypeToTypescript(session: IBasicSession, dataTypeId: NodeId) {
    const definition = await getDefinition(session, dataTypeId);
    const browseName = await getBrowseName(session, dataTypeId);

    const interfaceName = `UA${browseName.name!.toString()}`;
    const f = new LineFile();
    if (definition && definition instanceof StructureDefinition) {
        f.write(`interface ${interfaceName} {`);
        for (const field of definition.fields || []) {
        }
        f.write(`}`);
    }
}

async function getCorrepondingJavascriptType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    cache: Cache
): Promise<{ dataType: DataType; jtype: string }> {
    const dataType = await convertNodeIdToDataTypeAsync(session, dataTypeNodeId);

    switch (dataType) {
        case DataType.Null:
            return { dataType, jtype: "undefined" };
        case DataType.Boolean:
            return { dataType, jtype: "boolean" };
        case DataType.Byte:
            return { dataType, jtype: cache.referenceBasicType("Byte")};
        case DataType.ByteString:
            return { dataType, jtype: "Buffer" };
        case DataType.DataValue:
            return { dataType, jtype: cache.referenceBasicType("DataValue") };
        case DataType.DateTime:
            return { dataType, jtype: "Date" };
        case DataType.DiagnosticInfo:
            return { dataType, jtype: cache.referenceBasicType("DiagnosticInfo") };
        case DataType.Double:
            return { dataType, jtype: "number" };
        case DataType.ExtensionObject:
            return { dataType, jtype: await cache.referenceExtensionObject(session, dataTypeNodeId) };
        case DataType.Float:
            return { dataType, jtype: "number" };
        case DataType.Guid:
            return { dataType, jtype: cache.referenceBasicType("GUID") };
        case DataType.Int16:
            return { dataType, jtype: cache.referenceBasicType("Int16") };
        case DataType.Int32:
            return { dataType, jtype: cache.referenceBasicType("Int32") };
        case DataType.UInt16:
            return { dataType, jtype: cache.referenceBasicType("UInt16") };
        case DataType.UInt32:
            return { dataType, jtype: cache.referenceBasicType("UInt32") };
        case DataType.UInt64:
            return { dataType, jtype: cache.referenceBasicType("UInt64") };
        case DataType.Int64:
            return { dataType, jtype: cache.referenceBasicType("Int64")  };
        case DataType.LocalizedText:
            return { dataType, jtype: cache.referenceBasicType("LocalizedText") };
        case DataType.NodeId:
            return { dataType, jtype: cache.referenceBasicType("NodeId") };
        case DataType.ExpandedNodeId:
            return { dataType, jtype: cache.referenceBasicType("ExpandedNodeId") };
        case DataType.QualifiedName:
            return { dataType, jtype: cache.referenceBasicType("QualifiedName") };
        case DataType.SByte:
            return { dataType, jtype: cache.referenceBasicType("SByte")  };
        case DataType.StatusCode:
            return { dataType, jtype: cache.referenceBasicType("StatusCode") };
        case DataType.String:
            return { dataType, jtype: cache.referenceBasicType("UAString")  };
        case DataType.UInt16:
            return { dataType, jtype: cache.referenceBasicType("UInt16")  };
        case DataType.UInt32:
            return { dataType, jtype:  cache.referenceBasicType("UInt32")};
        case DataType.UInt64:
            return { dataType, jtype:  cache.referenceBasicType("UInt64") };
        case DataType.Variant:
            return { dataType, jtype: cache.referenceBasicType("Variant") };
        case DataType.XmlElement:
            return { dataType, jtype:  cache.referenceBasicType("UAString") };
        default:
            throw new Error("Unsupported " + dataType + " " + DataType[dataType]);
    }
}

async function getTypescriptType(session: IBasicSession, nodeId: NodeId, cache: Cache) {
    const nodeClass = await getNodeClass(session, nodeId);
    const definition = await getDefinition(session, nodeId);
    let comment = "" + nodeId.toString(); // typeDef.browseName.toString();

    switch (nodeClass) {
        case NodeClass.Method:
            cache.referenceUA("UAMethod");
            return {
                childClass: nodeClass,
                childType: "UAMethod",
                suffix: "",
                comment
            };
        case NodeClass.Object: {
            const typeDef = await getTypeDefinition(session, nodeId);
            const tName = makeTypeName(nodeClass, definition, typeDef.browseName, true, cache);
            const childBase=  makeTypeName(nodeClass,definition, typeDef.browseName, true, cache);
            //  const tName = makeTypescriptTypeName(nodeClass, typeDef.browseName, _cache);
            comment += "  " + typeDef.browseName.toString() + " (" + tName + ")";
            return {
                childClass: nodeClass,
                childBase,
                childType: tName,
                suffix: "",
                comment
            };
        }
        case NodeClass.Variable: {
            const typeDef = await getTypeDefinition(session, nodeId);
            const childBase=  makeTypeName(nodeClass,definition, typeDef.browseName, true, cache);
            const tName = makeTypeName(nodeClass,definition, typeDef.browseName, true, cache);
            comment += "  " + typeDef.browseName.toString() + " (" + tName + ")";

            const dataTypeNodeId = await session.read({ nodeId, attributeId: AttributeIds.DataType });
            const { dataType, jtype } = await getCorrepondingJavascriptType(session, dataTypeNodeId.value.value as NodeId, cache);
            // _cache.referenceUA("UAVariableT");
            cache.referenceBasicType("DataType");
            const variableTypeT = tName;
            return {
                childClass: nodeClass,
                childBase,
                childType: `${variableTypeT}`,
                suffix: `<${jtype}, DataType.${DataType[dataType]}>`,
                comment
            };
        }
    }
    throw new Error("Invalid");
}

function quotifyIfNecessary(s: string) {
    if (s.match(/(^[^a-zA-Z])|([^a-zA-Z_0-9])/)) {
        return `"${s}"`;
    }
    if (s === "nodeClass") {
        return `["$nodeClass"]`;
    }
    return s;
}
async function preDumpChildren(session: IBasicSession, padding: string, children: any[], f: LineFile, cache: Cache) {
    f = f || new LineFile();
    const sortedChildren = children.sort((a: ReferenceDescription, b: ReferenceDescription) =>
        a.browseName.toString().localeCompare(b.browseName.toString())
    );
    let counter = 0;
    for (const child of sortedChildren) {
        const modellingRule = await getModellingRule(session, child.nodeId);
        const grandChildren = await getChildren(session, child.nodeId);
        const { childClass, childBase, childType, suffix, comment } = await getTypescriptType(session, child.nodeId, cache);
        if (modellingRule !== "MandatoryPlaceholder" && modellingRule !== "OptionalPlaceholder") {
            if (grandChildren.length === 0 || "UAMethod" === childType) {
                // do nothing
            } else {

                await preDumpChildren(session, "    ", grandChildren, f, cache);

                if (childClass === NodeClass.Variable) {
                    f.write(`interface ${childType}_Extended${counter++}<T, DT extends DataType> extends ${childBase}<T, DT>  {`);
                } else {
                    f.write(`interface ${childType}_Extended${counter++}${suffix} extends ${childBase} {`);
                }
                await dumpChildren(session, padding + "  ", grandChildren, f, cache);
                f.write("}");
            }
        }
    }
}
async function dumpChildren(session: IBasicSession, padding: string, children: any[], f: LineFile, _cache: Cache) {
    f = f || new LineFile();
    const sortedChildren = children.sort((a: ReferenceDescription, b: ReferenceDescription) =>
        a.browseName.toString().localeCompare(b.browseName.toString())
    );

    let counter = 0;
    for (const child of sortedChildren) {
        const childName = lowerFirstLetter(child.browseName.name!);
        const { childType, childBase, suffix, comment } = await getTypescriptType(session, child.nodeId, _cache);
        const modellingRule = await getModellingRule(session, child.nodeId);
        const isOptional = modellingRule === "Optional";
        const description = await getDescription(session, child.nodeId);

        const grandChildren = await getChildren(session, child.nodeId);
        const grandElements = await getFolderElements(session, child.nodeId);

        f.write(`${padding}/**`);
        f.write(`${padding} * ${childName || ""}`);
        f.write(toComment(`${padding} * `, description.text || ""));
        f.write(`${padding} * ${comment}  - ${grandChildren.length} ${modellingRule}`);
        f.write(`${padding} */`);

        if (modellingRule !== "MandatoryPlaceholder" && modellingRule !== "OptionalPlaceholder") {
            if (grandChildren.length === 0 || "UAMethod" === childType) {
                f.write(`${padding}${quotifyIfNecessary(childName)}${isOptional ? "?" : ""}: ${childType}${suffix};`);
            } else {
                f.write(
                    `${padding}${quotifyIfNecessary(childName)}${
                        isOptional ? "?" : ""
                    }: ${childType}_Extended${counter++}${suffix};`
                );
                // f.write(
                //     `${padding}${quotifyIfNecessary(childName)}${isOptional ? "?" : ""}: /* ${childType} - ${
                //         grandChildren.length
                //     }  */{`
                // );
                // await dumpChildren(session, padding + "  ", grandChildren, f, _cache);
                // await dumpElements(session, padding + " ", grandElements, f, _cache);
                // f.write(`${padding}};`);
            }
        } else {
        }
    }
}

const dumpElements = dumpChildren;

function dumpUsedExport(currentType: string, namespaceIndex: number, cache: Cache, f?: LineFile): string {
    f = f || new LineFile();

    for (let imp of Object.keys(cache.imports)) {
        const symbolToImport = Object.keys(cache.imports[imp]).filter(
            (f) => f !== currentType && cache.requestedBasicTypes.hasOwnProperty(f)
        );
        if (symbolToImport.length) {
            f.write(`import { ${symbolToImport.join(", ")} } from "${imp}"`);
        }
    }

    for (let ns = 0; ns < cache.requestedSymbols.namespace.length; ns++) {
        const n = cache.namespace[ns];
        const file = n.filename;
        if (ns === namespaceIndex) {
            // include individuals stuff
            for (const symbol of Object.keys(cache.requestedSymbols.namespace[ns].symbols).filter(
                (x: string) => x !== currentType
            )) {
                f.write(`import { ${symbol} } from "./${symbol}"`);
            }
        } else {
            if (cache.requestedSymbols.namespace[ns]) {
                const typesArray = Object.keys(cache.requestedSymbols.namespace[ns].symbols).filter((x) => x !== currentType);
                //   f.write(`import { ${typesArray.join(", ")} } from "../${file}"`);

                for (const [symbol, count] of Object.entries(cache.requestedSymbols.namespace[ns].symbols)) {
                    f.write(`import { ${symbol} } from "../${file}/${symbol}"`);
                }
            }
        }
    }

    return f.toString();
}

function toComment(prefix: string, description: string) {
    var d = wrapper(description, { wrapOn: 78 });
    return d
        .split("\n")
        .map((x) => prefix + x)
        .join("\n");
}
export async function _convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ content: string; typeName: string }> {
    const browseName = await getBrowseName(session, nodeId);
    const isAbstract = await getIsAbstract(session, nodeId);
    const nodeClass = await getNodeClass(session, nodeId);
    const children = await getChildren(session, nodeId);
    const elements = await getFolderElements(session, nodeId);
    const superType = await getSubtypeNodeId(session, nodeId);
    const description = await getDescription(session, nodeId);
    const definition = await getDefinition(session, nodeId);

    const interfaceName = makeTypeName(nodeClass, definition, browseName, false, cache);
    const baseIntefaceName = makeTypeName(nodeClass,definition,  superType.browseName, true, cache);

    f = f || new LineFile();
    //  f.write(superType.toString());
    f.write(`/**`);
    if (description.text) {
        f.write(toComment(" * ", description.text || ""));
        f.write(` *`);
    }
    f.write(` * defined in namespace ${cache.namespace[nodeId.namespace].namespaceUri}`);
    f.write(` *`);
    f.write(` * nodeClass:       ${NodeClass[nodeClass]}`);
    f.write(` *`);
    f.write(` * typedDefinition: ${browseName.toString()}`);
    f.write(` *`);
    f.write(` * isAbstract:      ${isAbstract}`);

    f.write(` */`);

    if (nodeClass === NodeClass.DataType) {
        if (definition instanceof EnumDefinition) {
            f.write(`export enum ${interfaceName}  {`);
            for (const field of definition.fields!) {
                if (field.description.text) {
                    f.write(`  /**`);
                    f.write(toComment("   * ", field.description.text || ""));
                    f.write(`   */`);
                }
                f.write(`  ${quotifyIfNecessary(field.name!)} = ${field.value[1]},`);
            }
            f.write(`}`);
        } else if (definition instanceof StructureDefinition) {
            f.write(`export interface ${interfaceName} extends ${baseIntefaceName}  {`);
            for (const field of definition.fields!) {
                let fieldName = lowerFirstLetter(field.name!);
                // special case ! fieldName=

                f.write(`/** ${field.description.text}*/`);
                const { dataType, jtype } = await getCorrepondingJavascriptType(session, field.dataType, cache);
                f.write(`  ${quotifyIfNecessary(fieldName)}: ${jtype}; // ${DataType[dataType]} ${field.dataType.toString()}`);
            }
            f.write(`}`);
        } else {
            f.write(`// NO DEFINITION`);
            f.write(`export interface ${interfaceName} extends ${baseIntefaceName}  {`);
            f.write(`}`);

            // throw new Error("Invalid " + definition?.constructor.name);
        }
    } else {
        await preDumpChildren(session, "    ", children, f, cache);

        if (nodeClass === NodeClass.Variable || nodeClass === NodeClass.VariableType) {
            cache.referenceUA("DataType");
            f.write(`export interface ${interfaceName}<T,DT extends DataType> extends ${baseIntefaceName}<T,DT> {`);
        } else {
            f.write(`export interface ${interfaceName} extends ${baseIntefaceName} {`);
        }
        await dumpChildren(session, "    ", children, f, cache);
        if (elements.length) {
            f.write("///////////////////////");
            await dumpElements(session, "    ", elements, f, cache);
        }
        f.write(`}`);
    }
    return { content: f.toString(), typeName: interfaceName };
}

export async function convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache?: Cache,
    f?: LineFile
): Promise<{ content: string; folder: string; filename: string }> {
    f = new LineFile();

    cache = cache || (await constructCache(session));

    const { content, typeName } = await _convertTypeToTypescript(session, nodeId, cache);

    f.write(dumpUsedExport(typeName, nodeId.namespace, cache));
    f.write(content);

    const folder = cache.namespace[nodeId.namespace].filename;
    const filename = typeName;
    return { content: f.toString(), folder, filename };
}
