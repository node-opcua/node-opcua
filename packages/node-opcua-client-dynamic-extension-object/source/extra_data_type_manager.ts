/**
 * @module node-opcua-client-dynamic-extension-object
 */
import assert from "node-opcua-assert";
import {
    ConstructorFunc,
    DataTypeFactory,
    getStandartDataTypeFactory,
} from "node-opcua-factory";
import {
    ExpandedNodeId,
    NodeId,
} from "node-opcua-nodeid";
import {
    AnyConstructorFunc,
} from "node-opcua-schemas";

export class ExtraDataTypeManager {

    public namespaceArray: string[] = [];

    private readonly dataTypeFactoryMap: { [key: string]: DataTypeFactory } = {};
    private readonly dataTypeFactoryMapByNamespace: { [key: number]: DataTypeFactory } = {};

    constructor() {
        /* */
    }

    public setNamespaceArray(namespaceArray: string[]) {
        this.namespaceArray = namespaceArray;
    }

    public hasDataTypeFactory(namespaceIndex: number): boolean {
        return !!this.dataTypeFactoryMapByNamespace.hasOwnProperty(namespaceIndex);
    }

    public registerDataTypeFactory(namespaceIndex: number, dataTypeFactory: DataTypeFactory) {
        /* istanbul ignore next */
        assert(namespaceIndex !== 0,
            "registerTypeDictionary cannot be used for namespace 0");
        if (this.hasDataTypeFactory(namespaceIndex)) {
            throw new Error("Dictionary already registered");
        }
        this.dataTypeFactoryMapByNamespace[namespaceIndex] = dataTypeFactory;
    }

    public getDataTypeFactoryForNamespace(namespaceIndex: number): DataTypeFactory {
        assert(namespaceIndex !== 0,
            "getTypeDictionaryForNamespace cannot be used for namespace 0");
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }
    public getDataTypeFactory(namespaceIndex: number): DataTypeFactory {
        if (namespaceIndex === 0) {
            return getStandartDataTypeFactory();
        }
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }

    public getExtensionObjectConstructorFromDataType(
        dataTypeNodeId: NodeId
    ): AnyConstructorFunc {
        const dataTypeFactory = this.getDataTypeFactory(dataTypeNodeId.namespace);
        // find schema corresponding to dataTypeNodeId in typeDictionary
        const Constructor = dataTypeFactory.findConstructorForDataType(dataTypeNodeId);
        return Constructor;
    }

    public getExtensionObjectConstructorFromBinaryEncoding(
        binaryEncodingNodeId: NodeId
    ): ConstructorFunc {
        const dataTypeFactory = this.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);
        const Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
        if (!Constructor) {
            throw new Error("getExtensionObjectConstructorFromBinaryEncoding cannot find constructor for " + binaryEncodingNodeId.toString());
        }
        return Constructor;
    }
}
