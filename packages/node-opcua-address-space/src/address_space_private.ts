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
    AddReferenceOpts,
    AddressSpace,
    BaseNode as BaseNodePublic,
    UADataType,
    UAView,
    SessionContext,
    ContinuationPoint
} from "../source";
import { NamespacePrivate } from "./namespace_private";
import { Reference } from "./reference";
import { UAObjectType } from "./ua_object_type";
import { UAVariableType } from "./ua_variable_type";
import { ExtensionObjectConstructorFuncWithSchema } from "./ua_data_type";
import { UAVariable } from "./ua_variable";

export interface AddressSpacePrivate extends AddressSpace {
    isFrugal: boolean;
    suspendBackReference: boolean;

    _condition_refresh_in_progress: boolean;

    _coerceNode(node: string | BaseNodePublic | NodeId): BaseNodePublic | null;

    _coerceFolder(folder: string | BaseNodePublic | NodeId): BaseNodePublic | null;

    _coerce_DataType(dataType: NodeIdLike | BaseNodePublic): NodeId;

    _coerceType(
        baseType: string | NodeId | BaseNodePublic,
        topMostBaseType: string,
        nodeClass: NodeClass
    ): UAVariableType | UAObjectType;
    _coerceTypeDefinition(typeDefinition: string | NodeId): NodeId;

    _coerce_VariableTypeIds(dataType: NodeId | string | BaseNodePublic): NodeId;

    getDefaultNamespace(): NamespacePrivate;

    getOwnNamespace(): NamespacePrivate;

    getNamespace(indexOrName: number | string): NamespacePrivate;

    registerNamespace(namespaceUri: string): NamespacePrivate;

    getNamespaceArray(): NamespacePrivate[];

    getExtensionObjectConstructor(dataType: NodeId | UADataType): ExtensionObjectConstructorFuncWithSchema;

    constructExtensionObject(dataType: UADataType | NodeId, options?: any): ExtensionObject;

    normalizeReferenceType(params: AddReferenceOpts | Reference): Reference;

    normalizeReferenceTypes(references: AddReferenceOpts[] | Reference[] | null): Reference[];

    _register(node: BaseNodePublic): void;

    resolveNodeId(nodeIdLike: NodeIdLike): NodeId;

    modelChangeTransaction(action: () => void): void;

    _collectModelChange(view: UAView | null, data: ModelChangeStructureDataType): void;

    deleteNode(nodeId: NodeId): void;

    getDataTypeManager(): ExtraDataTypeManager;

    ///
    _readProcessedDetails?: (
        variable: UAVariable,
        context: SessionContext,
        historyReadDetails: ReadProcessedDetails,
        indexRange: NumericRange | null,
        dataEncoding: QualifiedNameLike | null,
        continuationPoint: ContinuationPoint | null,
        callback: CallbackT<HistoryReadResult>
    ) => void;

    isEnumeration(dataType: NodeId): boolean;
}
