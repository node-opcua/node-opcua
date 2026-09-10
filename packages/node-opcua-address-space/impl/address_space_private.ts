/**
 * @module node-opcua-address-space.Private
 */

import type {
    AddReferenceOpts,
    BaseNode,
    IAddressSpace,
    MethodCallInterceptor,
    UADataType,
    UAObjectType,
    UAReference,
    UAVariableType,
    UAView
} from "node-opcua-address-space-base";
import type { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import type { NodeClass } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { ModelChangeStructureDataType } from "node-opcua-types";
import type { ExtensionObjectConstructorFuncWithSchema } from "../api/interfaces/extension_object_constructor.js";
import type { UARootFolder } from "../api/ua_root_folder.js";

import type { ReadProcessedDetailsFunc } from "./historical_access/read_processed_details_hook.js";
import type { NamespacePrivate } from "./namespace_private.js";

export interface AddressSpacePrivate extends IAddressSpace {
    rootFolder: UARootFolder;

    /** a small integer per reference type NodeId, the same for the life of the address space */
    referenceTypeOrdinal(referenceType: NodeId): number;

    isFrugal: boolean;
    suspendBackReference: boolean;

    _condition_refresh_in_progress: boolean;

    $$extraDataTypeManager?: ExtraDataTypeManager;

    _coerceNode(node: string | BaseNode | NodeIdLike): BaseNode | null;

    _coerceFolder(folder: string | BaseNode | NodeId): BaseNode | null;

    _coerce_DataType(dataType: NodeIdLike | BaseNode): NodeId;

    _coerceType(baseType: string | NodeId | BaseNode, topMostBaseType: string, nodeClass: NodeClass): UAVariableType | UAObjectType;
    _coerceTypeDefinition(typeDefinition: string | NodeId): NodeId;

    _coerce_VariableTypeIds(dataType: NodeId | string | BaseNode): NodeId;

    getDefaultNamespace(): NamespacePrivate;

    getOwnNamespace(): NamespacePrivate;

    getNamespace(indexOrName: number | string): NamespacePrivate;

    registerNamespace(namespaceUri: string): NamespacePrivate;

    getNamespaceArray(): NamespacePrivate[];

    getExtensionObjectConstructor(dataType: NodeId | UADataType): ExtensionObjectConstructorFuncWithSchema;

    constructExtensionObject(dataType: UADataType | NodeId, options?: Record<string, unknown>): ExtensionObject;

    normalizeReferenceType(params: AddReferenceOpts | UAReference): UAReference;

    normalizeReferenceType(reference: AddReferenceOpts | UAReference): UAReference;
    normalizeReferenceTypes(references?: AddReferenceOpts[] | UAReference[] | null): UAReference[];

    _register(node: BaseNode): void;

    resolveNodeId(nodeIdLike: NodeIdLike): NodeId;

    modelChangeTransaction(action: () => void): void;

    _collectModelChange(view: UAView | null, data: ModelChangeStructureDataType): void;

    deleteNode(nodeId: NodeId): void;

    getDataTypeManager(): ExtraDataTypeManager;

    /** installed through installReadProcessedDetails, by node-opcua-aggregates */
    _readProcessedDetails?: ReadProcessedDetailsFunc;

    isEnumeration(dataType: NodeId): boolean;

    _methodCallInterceptors: MethodCallInterceptor[];
}
