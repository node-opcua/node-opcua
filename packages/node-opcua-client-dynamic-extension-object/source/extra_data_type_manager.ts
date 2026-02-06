/**
 * @module node-opcua-client-dynamic-extension-object
 */
import { format } from "util";

import { assert } from "node-opcua-assert";
import { AttributeIds, BrowseDirection, NodeClassMask, ResultMask } from "node-opcua-data-model";
import { ConstructorFunc, DataTypeFactory, getStandardDataTypeFactory, StructureInfo } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSessionAsync2 } from "node-opcua-pseudo-session";
import { AnyConstructorFunc } from "node-opcua-schemas";

export class ExtraDataTypeManager {
    public namespaceArray: string[] = [];
    private dataTypeFactoryMapByNamespace: { [key: number]: DataTypeFactory } = {};
    private _session: IBasicSessionAsync2 | null = null;
    private _pendingExtractions: Map<string, Promise<StructureInfo>> = new Map();

    constructor() {
        /* */
    }

    public setSession(session: IBasicSessionAsync2): void {
        this._session = session;
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
        if (namespaceIndex === 0) {
            return getStandardDataTypeFactory();
        }
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }

    public getDataTypeFactory(namespaceIndex: number): DataTypeFactory {
        if (namespaceIndex === 0) {
            return getStandardDataTypeFactory();
        }
        return this.dataTypeFactoryMapByNamespace[namespaceIndex];
    }

    public getBuiltInType(fieldTypeName: string) {
        // fallback to standard factory
        const standardDataTypeFactory = getStandardDataTypeFactory();
        if (standardDataTypeFactory.hasBuiltInType(fieldTypeName)) {
            return standardDataTypeFactory.getBuiltInType(fieldTypeName);
        }
        throw new Error("Cannot find built-in type " + fieldTypeName);
    }

    public getStructureInfoForDataType(dataTypeNodeId: NodeId): StructureInfo | null {
        const dataTypeFactory = this.getDataTypeFactory(dataTypeNodeId.namespace);
        if (!dataTypeFactory) {
            throw new Error("cannot find dataFactory for namespace=" + dataTypeNodeId.namespace + " when requested for " + dataTypeNodeId.toString());
        }
        return dataTypeFactory.getStructureInfoForDataType(dataTypeNodeId);
    }

    public async getStructureInfoForDataTypeAsync(dataTypeNodeId: NodeId): Promise<StructureInfo> {
        const structureInfo = this.getStructureInfoForDataType(dataTypeNodeId);
        if (structureInfo) {
            return structureInfo;
        }
        if (!this._session) {
            throw new Error("Session is required for lazy loading. Call setSession first.");
        }

        const key = dataTypeNodeId.toString();
        if (this._pendingExtractions.has(key)) {
            return await this._pendingExtractions.get(key)!;
        }

        const promise = (async () => {
            // Need to browse the name if not provided
            const browseResult = await this._session!.read({
                nodeId: dataTypeNodeId,
                attributeId: AttributeIds.BrowseName
            });
            const browseName = browseResult.value?.value?.name || "Unknown";

            // Use the already existing readDataTypeDefinitionAndBuildType from populate_data_type_manager_104
            // We'll need to make sure it's accessible and correctly used.
            // For now, let's assume we can import it or move it.
            // Actually, populate_data_type_manager_104.ts exports readDataTypeDefinitionAndBuildType
            const { readDataTypeDefinitionAndBuildType } = require("./private/populate_data_type_manager_104");
            const cache = {}; // local cache for this extraction
            await readDataTypeDefinitionAndBuildType(this._session!, dataTypeNodeId, browseName, this, cache);

            const info = this.getStructureInfoForDataType(dataTypeNodeId);
            if (!info) {
                throw new Error("Failed to extract data type structure for " + dataTypeNodeId.toString());
            }
            return info;
        })();

        this._pendingExtractions.set(key, promise);
        try {
            return await promise;
        } finally {
            this._pendingExtractions.delete(key);
        }
    }

    public getExtensionObjectConstructorFromDataType(dataTypeNodeId: NodeId): AnyConstructorFunc {
        const dataTypeFactory = this.getDataTypeFactory(dataTypeNodeId.namespace);
        if (!dataTypeFactory) {
            throw new Error("cannot find dataFactory for namespace=" + dataTypeNodeId.namespace + " when requested for " + dataTypeNodeId.toString());
        }
        // find schema corresponding to dataTypeNodeId in typeDictionary
        const structureInfo = dataTypeFactory.findStructureInfoForDataType(dataTypeNodeId);
        const Constructor = structureInfo.constructor;
        if (!Constructor) {
            throw new Error("Cannot find Extension Object Constructor for Abstract dataType");
        }
        return Constructor;
    }

    public async getExtensionObjectConstructorFromDataTypeAsync(dataTypeNodeId: NodeId): Promise<AnyConstructorFunc> {
        const structureInfo = await this.getStructureInfoForDataTypeAsync(dataTypeNodeId);
        const Constructor = structureInfo.constructor;
        if (!Constructor) {
            throw new Error("Cannot find Extension Object Constructor for Abstract dataType " + dataTypeNodeId.toString());
        }
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

    public async getExtensionObjectConstructorFromBinaryEncodingAsync(binaryEncodingNodeId: NodeId): Promise<ConstructorFunc> {
        const dataTypeFactory = this.getDataTypeFactoryForNamespace(binaryEncodingNodeId.namespace);
        let Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
        if (Constructor) {
            return Constructor;
        }

        if (!this._session) {
            throw new Error("Session is required for lazy loading. Call setSession first.");
        }

        // Need to find the DataType for this binary encoding
        const browseResult = await this._session.browse({
            nodeId: binaryEncodingNodeId,
            referenceTypeId: "HasEncoding",
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeClassMask: NodeClassMask.DataType,
            resultMask: ResultMask.BrowseName
        });

        if (browseResult.statusCode.isNotGood() || !browseResult.references || browseResult.references.length !== 1) {
            throw new Error("Cannot find DataType for binary encoding " + binaryEncodingNodeId.toString());
        }

        const dataTypeNodeId = browseResult.references[0].nodeId;
        await this.getStructureInfoForDataTypeAsync(dataTypeNodeId);

        Constructor = dataTypeFactory.getConstructor(binaryEncodingNodeId);
        if (!Constructor) {
            throw new Error("Cannot find constructor for binary encoding " + binaryEncodingNodeId.toString() + " after extraction");
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
