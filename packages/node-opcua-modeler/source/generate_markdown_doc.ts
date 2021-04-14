import { BaseNode, Namespace, UADataType, UAObjectType, UAReferenceType, UAVariableType } from "node-opcua-address-space";
import { coerceUInt32 } from "node-opcua-basic-types";
import { DataTypeDefinition, EnumDefinition, StructureDefinition, StructureField } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import { displayNodeElement } from "./displayNodeElement";
import { TableHelper } from "./tableHelper";

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

function dataTypeToMarkdown(dataType: UADataType): string {
    const addressSpace = dataType.addressSpace;

    const writer = new Writer();
    const definition: DataTypeDefinition = (dataType as any).$definition;

    writer.writeLine("\nisAbstract: " + (dataType.isAbstract ? "Yes" : "No"));
    if (dataType.subtypeOfObj) {
        writer.writeLine("\nSubtype of " + dataType.subtypeOfObj?.browseName.toString());
    }
    writer.writeLine("");

    if (definition instanceof EnumDefinition) {
        writer.writeLine("\nBasic Type: " + (DataType as any)[DataType.UInt32]);
        writer.writeLine("");

        const table = new TableHelper(["Name", "Value", "Description"]);
        for (const f of definition.fields || []) {
            table.push([f.name, coerceUInt32(f.value[1]), f.description.text || ""]);
        }
        writer.writeLine(table.toMarkdownTable());
    } else if (definition instanceof StructureDefinition) {
        writer.writeLine("\nBasic Type: " + (DataType as any)[dataType.basicDataType]);

        const table = new TableHelper(["Name", "data type", "value rank", "maxStringLength", "Dimensions", "Description"]);

        for (const f of definition.fields || []) {
            const dataTypeString = addressSpace.findDataType(f.dataType)!.browseName.toString();
            table.push([
                f.name,
                dataTypeString,
                f.valueRank ? f.valueRank : "",
                f.maxStringLength ? f.maxStringLength : "",
                f.arrayDimensions ? f.arrayDimensions : "",
                f.description.text || ""
            ]);
        }
        writer.writeLine(table.toMarkdownTable());
    } else {
        writer.writeLine("\nBasic Type: " + (DataType as any)[dataType.basicDataType]);
        writer.writeLine("");
    }
    return writer.toString();
}
export async function buildDocumentation(namespace: Namespace, writer: IWriter) {
    const addressSpace = namespace.addressSpace;

    const namespaceUri = namespace.namespaceUri;
    // -------- Documentation

    const nsIndex = addressSpace.getNamespaceIndex(namespaceUri);

    writer.writeLine("");
    writer.writeLine("# Namespace " + namespaceUri);
    writer.writeLine("");
    // -------------- writeReferences
    const namespacePriv = (namespace as unknown) as NamespacePriv2;
    writer.writeLine("");
    writer.writeLine("##  References ");
    writer.writeLine("");
    for (const referenceType of namespacePriv._referenceTypeIterator()) {
        writer.writeLine("\n\n###  reference " + referenceType.browseName.name!);
    }

    function d(node: BaseNode): string {
        return node.description ? node.description!.text!.toString() : "";
    }
    // -------------- writeDataType
    writer.writeLine("");
    writer.writeLine("## DataTypes");
    writer.writeLine("");
    for (const dataType of namespacePriv._dataTypeIterator()) {
        writer.writeLine("\n\n### " + dataType.browseName.name!.toString());
        writer.writeLine("");
        writer.writeLine(dataTypeToMarkdown(dataType));
    }
    // -------------- writeObjectType
    writer.writeLine("");
    writer.writeLine("## ObjectTypes");
    writer.writeLine("");
    for (const objectType of namespacePriv._objectTypeIterator()) {
        writer.writeLine("\n\n### " + objectType.browseName.name!.toString());
        writer.writeLine(d(objectType));
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
    // -------------- writeVariableType
    writer.writeLine("");
    writer.writeLine("## VariableTypes");
    writer.writeLine("");
    for (const variableType of namespacePriv._variableTypeIterator()) {
        writer.writeLine("\n\n### " + variableType.browseName.name!.toString());
        writer.writeLine(d(variableType));
        writer.writeLine("");
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
