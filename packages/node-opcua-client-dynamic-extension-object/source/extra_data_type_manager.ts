/**
 * @module node-opcua-client-dynamic-extension-object
 */
import assert from "node-opcua-assert";
import { 
    StructuredTypeSchema ,
     getStandartDataTypeFactory, 
     DataTypeFactory
} from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { 
    AnyConstructorFunc, 
    createDynamicObjectConstructor,
    TypeDictionary 
} from "node-opcua-schemas";

export class ExtraDataTypeManager {

    public namespaceArray: string[] = [];

    private readonly typeDictionaries: { [key: string]: TypeDictionary } = {};
    private readonly typeDictionariesByNamespace: { [key: number]: TypeDictionary } = {};

    constructor() {
        /* */
    }

    public setNamespaceArray(namespaceArray: string[]) {
        this.namespaceArray = namespaceArray;
    }

    public hasDataTypeDictionary(nodeId: NodeId): boolean {
        return !!this.typeDictionaries.hasOwnProperty(this.makeKey(nodeId));
    }

    public registerTypeDictionary(nodeId: NodeId, typeDictionary: TypeDictionary) {
        /* istanbul ignore next */
        if (this.hasDataTypeDictionary(nodeId)) {
            throw new Error("Dictionary already registered");
        }

        this.typeDictionaries[this.makeKey(nodeId)] = typeDictionary;
        assert(nodeId.namespace !== 0,
            "registerTypeDictionary cannot be used for namespace 0");
        assert(!this.typeDictionariesByNamespace.hasOwnProperty(nodeId.namespace),
            "already registered");
        this.typeDictionariesByNamespace[nodeId.namespace] = typeDictionary;
    }

    public getTypeDictionaryForNamespace(namespaceIndex: number): TypeDictionary {
        assert(namespaceIndex !== 0,
            "getTypeDictionaryForNamespace cannot be used for namespace 0");
        return this.typeDictionariesByNamespace[namespaceIndex];
    }
    public getDataTypeFactory(namespaceIndex: number): DataTypeFactory {
        if (namespaceIndex === 0) {
            return getStandartDataTypeFactory();
        }
        return this.typeDictionariesByNamespace[namespaceIndex];
    }

    public getExtensionObjectConstructorFromDataType(
        dataTypeNodeId: NodeId
    ): AnyConstructorFunc {
        const typeDictionary = this.getTypeDictionaryForNamespace(dataTypeNodeId.namespace);
        // find schema corresponding to dataTypeNodeId in typeDictionary
        const schema = findSchemaForDataType(typeDictionary, dataTypeNodeId);
        const Constructor = createDynamicObjectConstructor(schema, typeDictionary);
        return Constructor;
    }

    public getExtensionObjectConstructorFromBinaryEncoding(
        binaryEncodingNodeId: NodeId
    ): AnyConstructorFunc {
        const typeDictionary = this.getTypeDictionaryForNamespace(binaryEncodingNodeId.namespace);
        // find schema corresponding to binaryEncodingNodeId in typeDictionary
        const schema = findSchemaForBinaryEncoding(typeDictionary, binaryEncodingNodeId);
        const Constructor = createDynamicObjectConstructor(schema, typeDictionary);
        return Constructor;
    }

    private makeKey(nodeId: NodeId): string {
        return this.namespaceArray[nodeId.namespace] + "@" + nodeId.value.toString();
    }

}

function findSchemaForDataType(
    typeDictionary: TypeDictionary,
    dataTypeNodeId: NodeId
): StructuredTypeSchema {

    for (const k of Object.keys(typeDictionary.structuredTypes)) {

        const schema = typeDictionary.structuredTypes[k];
        if (schema.id.value === dataTypeNodeId.value) {
            assert(schema.id.namespace === dataTypeNodeId.namespace);
            return schema;
        }
    }
    throw new Error("findSchemaForDataType: Cannot find schema for " + dataTypeNodeId.toString()
        + " in " +
        Object.keys(typeDictionary.structuredTypes).map(
            (a) => a + ":" +
                typeDictionary.structuredTypes[a].id.toString()).join("\n"));
}

function findSchemaForBinaryEncoding(
    typeDictionary: TypeDictionary,
    binaryEncodingNodeId: NodeId
): StructuredTypeSchema {

    for (const k of Object.keys(typeDictionary.structuredTypes)) {

        const schema = typeDictionary.structuredTypes[k];
        if (schema.encodingDefaultBinary &&
            schema.encodingDefaultBinary!.value === binaryEncodingNodeId.value) {
            assert(schema.encodingDefaultBinary!.namespace === binaryEncodingNodeId.namespace);
            return schema;
        }
    }
    throw new Error("findSchemaForBinaryEncoding: Cannot find schema for " + binaryEncodingNodeId.toString()
        + " in " +
        Object.keys(typeDictionary.structuredTypes).map(
            (a) => a + " " +
                (typeDictionary.structuredTypes[a].encodingDefaultBinary ?
                    typeDictionary.structuredTypes[a].encodingDefaultBinary!.toString() : "None")).join("\n"));
}
