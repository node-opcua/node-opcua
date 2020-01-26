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

    public hasDataTypeFactory(nodeId: NodeId): boolean {
        return !!this.dataTypeFactoryMap.hasOwnProperty(this.makeKey(nodeId));
    }

    public registerDataTypeFactory(nodeId: NodeId, dataTypeFactory: DataTypeFactory) {
        /* istanbul ignore next */
        if (this.hasDataTypeFactory(nodeId)) {
            throw new Error("Dictionary already registered");
        }

        this.dataTypeFactoryMap[this.makeKey(nodeId)] = dataTypeFactory;
        assert(nodeId.namespace !== 0,
            "registerTypeDictionary cannot be used for namespace 0");
        assert(!this.dataTypeFactoryMapByNamespace.hasOwnProperty(nodeId.namespace),
            "already registered");
        this.dataTypeFactoryMapByNamespace[nodeId.namespace] = dataTypeFactory;
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

    private makeKey(nodeId: NodeId): string {
        return this.namespaceArray[nodeId.namespace] + "@" + nodeId.value.toString();
    }

}
