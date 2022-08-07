/**
 * @module node-opcua-client-dynamic-extension-object
 */
import { format } from "util";

import { assert } from "node-opcua-assert";
import { ConstructorFunc, DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { AnyConstructorFunc } from "node-opcua-schemas";

export class ExtraDataTypeManager {
    public namespaceArray: string[] = [];
    private dataTypeFactoryMapByNamespace: { [key: number]: DataTypeFactory } = {};

    constructor() {
        /* */
    }

    public setNamespaceArray(namespaceArray: string[]): void {
        this.namespaceArray = namespaceArray;
    }

    public hasDataTypeFactory(namespaceIndex: number): boolean {
        return !!Object.prototype.hasOwnProperty.call(this.dataTypeFactoryMapByNamespace, namespaceIndex);
    }

    public registerDataTypeFactory(namespaceIndex: number, dataTypeFactory: DataTypeFactory): void {
        /* istanbul ignore next */
        assert(namespaceIndex !== 0, "registerTypeDictionary cannot be used for namespace 0");
        if (this.hasDataTypeFactory(namespaceIndex)) {
            throw new Error("Dictionary already registered");
        }
        this.dataTypeFactoryMapByNamespace[namespaceIndex] = dataTypeFactory;
    }

    public getDataTypeFactoryForNamespace(namespaceIndex: number): DataTypeFactory {
        assert(namespaceIndex !== 0, "getTypeDictionaryForNamespace cannot be used for namespace 0");
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }

    public getDataTypeFactory(namespaceIndex: number): DataTypeFactory {
        if (namespaceIndex === 0) {
            return getStandardDataTypeFactory();
        }
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }

    public getExtensionObjectConstructorFromDataType(dataTypeNodeId: NodeId): AnyConstructorFunc {
        const dataTypeFactory = this.getDataTypeFactory(dataTypeNodeId.namespace);
        if (!dataTypeFactory) {
            throw new Error("cannot find dataFactory for namespace=" + dataTypeNodeId.namespace);
        }
        // find schema corresponding to dataTypeNodeId in typeDictionary
        const Constructor = dataTypeFactory.findConstructorForDataType(dataTypeNodeId);
        return Constructor;
    }

    public getExtensionObjectConstructorFromBinaryEncoding(binaryEncodingNodeId: NodeId): ConstructorFunc {
        const dataTypeFactory = this.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);
        const Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
        if (!Constructor) {
            throw new Error(
                "getExtensionObjectConstructorFromBinaryEncoding cannot find constructor for binaryEncoding " +
                    binaryEncodingNodeId.toString()
            );
        }
        return Constructor;
    }

    public toString(): string {
        const l: string[] = [];
        function write(...args: [any, ...any[]]) {
            l.push(format.apply(format, args));
        }
        write("ExtraDataTypeManager");
        for (let n = 0; n < this.namespaceArray.length; n++) {
            write("------------- namespace:", this.namespaceArray[n]);
            const dataFactory = this.dataTypeFactoryMapByNamespace[n];
            if (!dataFactory) {
                continue;
            }
            write(dataFactory.toString());
        }
        return l.join("\n");
    }
}
