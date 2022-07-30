/**
 * @module node-opcua-address-space.Private
 */
import { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { NodeClass, QualifiedNameLike } from "node-opcua-data-model";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { ModelChangeStructureDataType, ReadProcessedDetails, HistoryReadResult } from "node-opcua-types";
import { NumericRange } from "node-opcua-numeric-range";
import { CallbackT } from "node-opcua-status-code";

import {
    IAddressSpace,
    BaseNode,
    UADataType,
    UAView,
    ISessionContext,
    AddReferenceOpts,
    UAVariableType,
    UAObjectType,
    UAReference,
    UAVariable,
    ContinuationData
} from "node-opcua-address-space-base";

import { UARootFolder } from "../source/ua_root_folder";

import { NamespacePrivate } from "./namespace_private";
import { ExtensionObjectConstructorFuncWithSchema } from "./ua_data_type_impl";
import { NamespaceImpl } from "./namespace_impl";

export interface AddressSpacePrivate extends IAddressSpace {
    rootFolder: UARootFolder;

    isFrugal: boolean;
    suspendBackReference: boolean;

    _condition_refresh_in_progress: boolean;

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

    normalizeReferenceTypes(references: AddReferenceOpts[] | UAReference[] | null): UAReference[];

    _register(node: BaseNode): void;

    resolveNodeId(nodeIdLike: NodeIdLike): NodeId;

    modelChangeTransaction(action: () => void): void;

    _collectModelChange(view: UAView | null, data: ModelChangeStructureDataType): void;

    deleteNode(nodeId: NodeId): void;

    getDataTypeManager(): ExtraDataTypeManager;

    ///
    _readProcessedDetails?: (
        variable: UAVariable,
        context: ISessionContext,
        historyReadDetails: ReadProcessedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationData: ContinuationData,
        callback: CallbackT<HistoryReadResult>
    ) => void;

    isEnumeration(dataType: NodeId): boolean;
}
