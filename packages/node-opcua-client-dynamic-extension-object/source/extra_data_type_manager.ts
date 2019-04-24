/**
 * @module node-opcua-client-dynamic-extension-object
 */
import { NodeId } from "node-opcua-nodeid";
import { TypeDictionary } from "node-opcua-schemas";

export class ExtraDataTypeManager {

    public namespaceArray: string[] = [];

    private readonly typeDictionaries: any = {};

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
    }

    private makeKey(nodeId: NodeId): string {
        return this.namespaceArray[nodeId.namespace] + "@" + nodeId.value.toString();
    }

}
