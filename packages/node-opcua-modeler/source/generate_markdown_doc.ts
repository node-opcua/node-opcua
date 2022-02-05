/* eslint-disable max-statements */
import {
    BaseNode,
    dumpReferenceDescription,
    Namespace,
    UADataType,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space";
import { coerceUInt32 } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StructureField } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

import { displayNodeElement } from "./displayNodeElement";
import { TableHelper } from "./tableHelper";
import { dumpClassHierachry, graphVizToPlantUml, opcuaToDot } from "./to_graphivz";

interface NamespacePriv2 {
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
    writeLine(...args: any[]): void;
}
class Writer implements IWriter {
    private readonly stream: string[] = [];
    constructor() {
        /* empty */
    }
    public writeLine(str: string) {
        this.stream.push(str);
    }
    public toString(): string {
        return this.stream.join("\n");
    }
}

export async function buildDocumentationToString(namespace: Namespace): Promise<string> {
    const writer = new Writer();
    await buildDocumentation(namespace, writer);
    return writer.toString();
}

interface V {
    valueRank?: number;
    arrayDimensions?: number[];
    dataType: NodeId;
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
    const addressSpace = dataType.addressSpace;
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
export async function buildDocumentation(namespace: Namespace, writer: IWriter): Promise<void> {
    const addressSpace = namespace.addressSpace;

    const namespaceUri = namespace.namespaceUri;
    // -------- Documentation

    const nsIndex = addressSpace.getNamespaceIndex(namespaceUri);

    writer.writeLine("");
    writer.writeLine("# Namespace " + namespaceUri);
    writer.writeLine("");

    const namespacePriv = namespace as unknown as NamespacePriv2;
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
        return node.description ? node.description!.text!.toString() : "";
    }
    // -------------- writeDataType
    if (namespacePriv._dataTypeCount() > 0) {
        writer.writeLine("");
        writer.writeLine("## DataTypes");
        writer.writeLine("");
        for (const dataType of namespacePriv._dataTypeIterator()) {
            writer.writeLine("\n\n### " + dataType.browseName.name!.toString());
            writer.writeLine("");
            writer.writeLine(dataTypeToMarkdown(dataType));
        }
    }
    // -------------- writeObjectType
    if (namespacePriv._objectTypeCount() > 0) {
        writer.writeLine("");
        writer.writeLine("## ObjectTypes");
        writer.writeLine("");
        for (const objectType of namespacePriv._objectTypeIterator()) {
            writer.writeLine("\n\n### " + objectType.browseName.name!.toString());
            writer.writeLine(d(objectType));

            writer.writeLine(graphVizToPlantUml(dumpClassHierachry(objectType, { showBaseType: true, depth: 2 })));

            writer.writeLine(graphVizToPlantUml(opcuaToDot(objectType)));

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
    if (namespacePriv._variableTypeCount() > 0) {
        writer.writeLine("");
        writer.writeLine("## VariableTypes");
        writer.writeLine("");
        for (const variableType of namespacePriv._variableTypeIterator()) {
            writer.writeLine("\n\n### " + variableType.browseName.name!.toString());
            writer.writeLine(d(variableType));
            writer.writeLine("");

            writer.writeLine(graphVizToPlantUml(dumpClassHierachry(variableType, { showBaseType: true, depth: 2 })));

            writer.writeLine(graphVizToPlantUml(opcuaToDot(variableType)));

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
