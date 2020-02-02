import * as  fs from "fs";
import {
    BaseNode,
    Namespace,
    UADataType, UAObjectType, UAReferenceType, UAVariableType
} from "node-opcua-address-space";

import { displayNodeElement } from "./displayNodeElement";

interface NamespacePriv2 {
    _objectTypeMap: { [key: string]: UAObjectType };
    _variableTypeMap: { [key: string]: UAVariableType };
    _referenceTypeMap: { [key: string]: UAReferenceType };
    _dataTypeMap: { [key: string]: UADataType };
}
export interface IWriter {
    writeLine(...args: any[]): void;
}
export async function buildDocumentationToFile(namespace: Namespace, filename: string) {
    const stream = fs.createWriteStream("documentation.md");

    const writer = {
        writeLine: (str: string) => {
            stream.write(str);
            stream.write("\n");
        }
    };
    await buildDocumentation(namespace, writer);
    await new Promise((resolve) => {
        stream.on("finish", resolve);
        stream.end();
    });

}
export async function buildDocumentationToString(namespace: Namespace): Promise<string> {

    const stream: string[] = [];
    const writer = {
        writeLine: (str: string) => {
            stream.push(str);
        }
    };
    await buildDocumentation(namespace, writer);
    return stream.join("\n");

}
export async function buildDocumentation(namespace: Namespace, writer: IWriter) {

    const addressSpace = namespace.addressSpace;

    const namespaceUri = namespace.namespaceUri;
    // -------- Documentation

    const nsIndex = addressSpace.getNamespaceIndex(namespaceUri);

    writer.writeLine("# Namespace " + namespaceUri);
    // -------------- writeReferences
    const namespacePriv = namespace as unknown as NamespacePriv2;
    const referenceTypes = Object.values(namespacePriv._referenceTypeMap);
    writer.writeLine("");
    writer.writeLine("##  References ");
    writer.writeLine("");
    for (const referenceType of referenceTypes) {
        writer.writeLine("###  reference " + referenceType.browseName.name!);
    }

    function d(node: BaseNode): string {
        return node.description ? node.description!.text!.toString() : "";
    }
    // -------------- writeDataType
    const dataTypes = Object.values(namespacePriv._dataTypeMap);
    writer.writeLine("");
    writer.writeLine("## DataTypes");
    writer.writeLine("");
    for (const dataType of dataTypes) {
        writer.writeLine("### " + dataType.browseName.name!.toString());
        writer.writeLine(`${d(dataType)}`);
    }
    // -------------- writeObjectType
    const objectTypes = Object.values(namespacePriv._objectTypeMap);
    writer.writeLine("");
    writer.writeLine("## ObjectTypes");
    writer.writeLine("");
    for (const objectType of objectTypes) {
        writer.writeLine("### " + objectType.browseName.name!.toString());
        writer.writeLine(`${d(objectType)}
                `);
        // enumerate components
        writer.writeLine(displayNodeElement(objectType, { format: "markdown" }));
        for (const comp of objectType.getComponents()) {
            writer.writeLine("#### " + comp.browseName.name!.toString());
            writer.writeLine(d(comp));
        }
    }
    // -------------- writeVariableType
    writer.writeLine("");
    writer.writeLine("## VariableTypes");
    writer.writeLine("");
    const variableTypes = Object.values(namespacePriv._variableTypeMap);
    for (const variableType of variableTypes) {
        writer.writeLine("### " + variableType.browseName.name!.toString());
        writer.writeLine(d(variableType));
        // for (const comp of variableType.get()) {
        // writer.writeLine("#### " + comp.browseName.name!.toString());
        // writer.writeLine(" " + comp.description.toString());
    }
}
