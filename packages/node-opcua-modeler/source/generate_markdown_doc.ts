/* eslint-disable max-statements */
import {
    BaseNode,
    INamespace,
    UADataType,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space";
import { coerceUInt32 } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { StructureField } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

import { displayNodeElement } from "./displayNodeElement";
import { TableHelper } from "./tableHelper";

interface NamespacePriv2 extends INamespace {
    nodeIterator(): IterableIterator<BaseNode>;
    _objectTypeIterator(): IterableIterator<UAObjectType>;
    _objectTypeCount(): number;
    _variableTypeIterator(): IterableIterator<UAVariableType>;
    _variableTypeCount(): number;
    _dataTypeIterator(): IterableIterator<UADataType>;
    _dataTypeCount(): number;
    _referenceTypeIterator(): IterableIterator<UAReferenceType>;
    _referenceTypeCount(): number;
    _aliasCount(): number;
}
export interface IWriter {
    // eslint-disable-next-line no-unused-vars
    writeLine(_str: string): void;
}

export class Writer implements IWriter {
    private readonly stream: string[] = [];
    constructor() {
        /* empty */
    }
    public writeLine(str: string): void {
        this.stream.push(str);
    }
    public toString(): string {
        return this.stream.join("\n");
    }
}

export interface BuildDocumentationOptions {
    node?: BaseNode;

    dumpGraphics?: (writer: IWriter, type: UAObjectType | UAVariableType) => void;
}

export async function buildDocumentationToString(namespace: INamespace, options?: BuildDocumentationOptions): Promise<string> {
    const writer = new Writer();
    await buildDocumentation(namespace, writer, options);
    return writer.toString();
}

const toDataTypeStr = (p: BaseNode): string => {
    if (p.nodeClass === NodeClass.Variable) {
        const v = p as UAVariable;
        const arr = v.valueRank == 1 ? "[]" : "";
        const brn = toDataTypeStr((p as UAVariable).dataTypeObj);
        return brn + arr;
    }
    if (p.nodeClass === NodeClass.DataType) {
        const dataType = p as UADataType;
        const brn = dataType.browseName.toString();
        return brn;
    }
    return "";
};
function dataTypeEnumerationToMarkdown(dataType: UADataType): string {
    const writer = new Writer();

    writer.writeLine("");
    if (dataType.description) {
        writer.writeLine(dataType.description.text || "");
    }

    writer.writeLine(`\nThe fields of the ${dataType.browseName.name} DataType are defined in the following table:`);

    writer.writeLine("");
    const definition = dataType.getEnumDefinition();
    writer.writeLine("\nBasic Type: " + (DataType as any)[DataType.Int32]);
    writer.writeLine("");

    const table = new TableHelper(["Name", "Value", "Description"]);
    for (const f of definition.fields || []) {
        table.push([f.name, coerceUInt32(f.value[1]), f.description.text || ""]);
    }
    writer.writeLine(table.toMarkdownTable());

    const str = dumpTypeRepresentation(dataType);
    writer.writeLine(str);

    return writer.toString();
}

function dumpTypeRepresentation(uaType: UAObjectType | UADataType | UAReferenceType): string {
    const className = NodeClass[uaType.nodeClass];
    const writer = new Writer();
    writer.writeLine("\n");
    writer.writeLine(
        `\nThe representation of the ${uaType.browseName.name} ${className} in the address space is shown in the following table:`
    );

    const table = new TableHelper(["Name", "Attribute"]);
    table.push(["NodeId", uaType.nodeId.toString()]);
    table.push(["NamespaceUri", uaType.addressSpace.getNamespaceUri(uaType.nodeId.namespace)]);
    table.push(["BrowseName", uaType.browseName.name!.toString()]);
    table.push(["NodeClass", NodeClass[uaType.nodeClass]]);
    if (uaType.nodeClass === NodeClass.ReferenceType) {
        table.push(["InverseName", (uaType as UAReferenceType).inverseName!.text]);
        // table.push(["IsSymmetric", (uaType as UAReferenceType).isSymetric ? "Yes" : "No"]);
    }
    table.push(["IsAbstract", uaType.isAbstract ? "Yes" : "No"]);
    table.push(["SubtypeOf", uaType.subtypeOfObj ? uaType.subtypeOfObj.browseName.toString() : ""]);
    writer.writeLine("");
    writer.writeLine(table.toMarkdownTable());
    writer.writeLine("");

    // forward refereces
    {
        const properties = uaType.findReferencesExAsObject("HasProperty");
        const table = new TableHelper(["Reference", "NodeClass", "BrowseName", "DataType", "TypeDefinition", "ModellingRule"]);

        if (uaType.subtypeOfObj) {
            const referenceName = "HasSubType";
            const p = uaType.subtypeOfObj!;
            const nodeClass = NodeClass[p.nodeClass];
            const browseName = p.browseName.toString();
            const dataTypeStr = toDataTypeStr(p);
            const modellingRule = p.modellingRule || "";
            const typeDefinitionName = "";
            table.push([referenceName, nodeClass, browseName, dataTypeStr, typeDefinitionName, modellingRule]);
        }
        if (properties.length > 0) {
            writer.writeLine(`\nThe reference of the ${uaType.browseName.name}  ${className}  is shown in the following table:`);
            writer.writeLine("");
            for (const p of properties) {
                const referenceName = "HasProperty";
                const nodeClass = NodeClass[p.nodeClass];
                const browseName = p.browseName.toString();
                const dataTypeStr = toDataTypeStr(p);
                const typeDefinitionName = (p as UAVariable | UAObject).typeDefinitionObj?.browseName.toString();
                const modellingRule = p.modellingRule || "";
                table.push([referenceName, nodeClass, browseName, dataTypeStr, typeDefinitionName, modellingRule]);
            }
        }
        writer.writeLine("");
        writer.writeLine(table.toMarkdownTable());
        writer.writeLine("");
    }
    return writer.toString();
}
function dataTypeStructureToMarkdown(dataType: UADataType): string {
    const addressSpace = dataType.addressSpace;
    const writer = new Writer();

    writer.writeLine("");
    if (dataType.description) {
        writer.writeLine(dataType.description.text || "");
    }

    const definition = dataType.getStructureDefinition();
    writer.writeLine("\nBasic Type: " + (DataType as any)[dataType.basicDataType]);
    writer.writeLine("");
    writer.writeLine(`The fields of the ${dataType.browseName.name} DataType are defined in the following table:`);

    const c = (f: StructureField) => {
        let dataTypeString = addressSpace.findDataType(f.dataType)!.browseName.toString();
        if (f.valueRank === 1) {
            dataTypeString += "[]";
        } else if (f.valueRank >= 2) {
            dataTypeString += "[" + f.arrayDimensions?.map((d) => "" + d).join(" ") + "]";
        }
        //       f.maxStringLength ? f.maxStringLength : "",
        //       f.arrayDimensions ? f.arrayDimensions : "",
        return dataTypeString;
    };
    const table = new TableHelper(["Name", "Type", "Description"]);
    table.push([dataType.browseName.name, "Structure"]);
    for (const f of definition.fields || []) {
        table.push(["   " + f.name, c(f), (f.description.text || "").replace(/\n/g, "<br>")]);
    }
    writer.writeLine(table.toMarkdownTable());

    const str = dumpTypeRepresentation(dataType);
    writer.writeLine(str);

    return writer.toString();
}
function dataTypeToMarkdown(dataType: UADataType): string {
    if (dataType.isEnumeration()) {
        return dataTypeEnumerationToMarkdown(dataType);
    } else if (dataType.isStructure()) {
        return dataTypeStructureToMarkdown(dataType);
    } else {
        const writer = new Writer();
        writer.writeLine("");
        if (dataType.description) {
            writer.writeLine(dataType.description.text || "");
        }
        writer.writeLine("\nBasic Type: " + (DataType as any)[dataType.basicDataType]);
        writer.writeLine("");
        return writer.toString();
    }
}
function dumpReferenceType(referenceType: UAReferenceType): string {
    const writer = new Writer();
    const str = dumpTypeRepresentation(referenceType);
    writer.writeLine(str);
    return writer.toString();
}

export function extractTypes(namespace: INamespace, options?: BuildDocumentationOptions) {
    const namespacePriv = namespace as unknown as NamespacePriv2;
    if (!options || !options.node) {
        const dataTypes = [...namespacePriv._dataTypeIterator()];
        const objectTypes = [...namespacePriv._objectTypeIterator()];
        const variableTypes = [...namespacePriv._variableTypeIterator()];
        const referenceTypes = [...namespacePriv._referenceTypeIterator()];
        return { dataTypes, variableTypes, objectTypes, referenceTypes };
    }
    const node = options.node;

    if (node.nodeClass === NodeClass.DataType) {
        const dataTypes: UADataType[] = [];
        let dataType = node as UADataType;
        dataTypes.push(dataType);
        while (dataType.subtypeOfObj && dataType.subtypeOfObj.nodeId.namespace === namespace.index) {
            dataType = dataType.subtypeOfObj;
            dataTypes.push(dataType);
        }
        return { dataTypes, variableTypes: [], objectTypes: [], dataTypeNode: [], referenceTypes: [] };
    } else if (node.nodeClass === NodeClass.ObjectType) {
        const objectTypes: UAObjectType[] = [];
        let objectType = node as UAObjectType;
        objectTypes.push(objectType);
        while (objectType.subtypeOfObj && objectType.subtypeOfObj.nodeId.namespace === namespace.index) {
            objectType = objectType.subtypeOfObj;
            objectTypes.push(objectType);
        }
        return { dataTypes: [], variableTypes: [], objectTypes, dataTypeNode: [], referenceTypes: [] };
    } else if (node.nodeClass === NodeClass.VariableType) {
        const variableTypes: UAVariableType[] = [];
        let variableType = node as UAVariableType;
        variableTypes.push(variableType);
        while (variableType.subtypeOfObj && variableType.subtypeOfObj.nodeId.namespace === namespace.index) {
            variableType = variableType.subtypeOfObj;
            variableTypes.push(variableType);
        }
        return { dataTypes: [], variableTypes, objectTypes: [], dataTypeNode: [], referenceTypes: [] };
    }

    const dataTypes = [...namespacePriv._dataTypeIterator()];
    const objectTypes = [...namespacePriv._objectTypeIterator()];
    const variableTypes = [...namespacePriv._variableTypeIterator()];
    const referenceTypes = [...namespacePriv._referenceTypeIterator()];
    return { dataTypes, variableTypes, objectTypes, referenceTypes };
}

export async function buildDocumentation(
    namespace: INamespace,
    writer: IWriter,
    options?: BuildDocumentationOptions
): Promise<void> {
    options = options || {};

    const namespacePriv = namespace as unknown as NamespacePriv2;

    const namespaceUri = namespace.namespaceUri;
    // -------- Documentation

    const { dataTypes, objectTypes, variableTypes } = extractTypes(namespace, options);

    writer.writeLine("");
    writer.writeLine("# Namespace " + namespaceUri);
    writer.writeLine("");

    // -------------- writeReferences
    if (namespacePriv._referenceTypeCount() > 0) {
        writer.writeLine("");
        writer.writeLine("##  References ");
        writer.writeLine("");
        for (const referenceType of namespacePriv._referenceTypeIterator()) {
            writer.writeLine("\n\n###  reference " + referenceType.browseName.name!);
            dumpReferenceType(referenceType);
        }
    }

    function d(node: BaseNode): string {
        return node.description && node.description.text ? node.description!.text!.toString() : "";
    }

    // -------------- writeDataType
    if (dataTypes.length > 0) {
        writer.writeLine("");
        writer.writeLine("## DataTypes");
        writer.writeLine("");
        for (const dataType of dataTypes) {
            writer.writeLine("\n\n### " + dataType.browseName.name!.toString());
            writer.writeLine("");
            writer.writeLine(dataTypeToMarkdown(dataType));
        }
    }
    // -------------- writeObjectType
    if (objectTypes.length > 0) {
        writer.writeLine("");
        writer.writeLine("## ObjectTypes");
        writer.writeLine("");
        for (const objectType of objectTypes) {
            writer.writeLine("\n\n### " + objectType.browseName.name!.toString());
            writer.writeLine(d(objectType));

            if (options.dumpGraphics) {
                await options.dumpGraphics(writer, objectType);
            }

            // enumerate components
            writer.writeLine(displayNodeElement(objectType, { format: "markdown" }));

            for (const comp of objectType.getComponents()) {
                writer.writeLine("\n\n#### " + comp.browseName.name!.toString());
                writer.writeLine("");
                writer.writeLine(d(comp));
            }
            for (const comp of objectType.getProperties()) {
                writer.writeLine("\n\n#### " + comp.browseName.name!.toString());
                writer.writeLine("");
                writer.writeLine(d(comp));
            }
        }
    }
    // -------------- writeVariableType
    if (variableTypes.length > 0) {
        writer.writeLine("");
        writer.writeLine("## VariableTypes");
        writer.writeLine("");
        for (const variableType of variableTypes) {
            writer.writeLine("\n\n### " + variableType.browseName.name!.toString());
            writer.writeLine(d(variableType));
            writer.writeLine("");

            if (options.dumpGraphics) {
                await options.dumpGraphics(writer, variableType);
            }
            // enumerate components
            writer.writeLine(displayNodeElement(variableType, { format: "markdown" }));
            for (const reference of variableType.allReferences()) {
                const n = reference.node!;
                writer.writeLine("\n\n#### " + n.browseName.name!.toString());
                writer.writeLine("");
                writer.writeLine(d(n));
            }
        }
    }
}
