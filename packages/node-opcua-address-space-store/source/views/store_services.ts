/**
 * @module node-opcua-address-space-store
 *
 * The Read, Write, Browse, TranslateBrowsePaths and Call services answered on a compact address
 * space: the same statuses and the same result shapes as the node objects give, from the
 * columns, with the views only where a value goes through a getter or a setter, or where a
 * Method runs the function bound to it.
 */

import type { ISessionContext } from "node-opcua-address-space-base";
import {
    AttributeIds,
    BrowseDirection,
    isDataEncoding,
    LocalizedText,
    NodeClass,
    QualifiedName,
    type QualifiedNameLike,
    ResultMask
} from "node-opcua-data-model";
import { apply_timestamps_no_copy, coerceTimestampsToReturn, DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { getCurrentClock, isMinDate } from "node-opcua-date-time";
import { coerceExpandedNodeId, ExpandedNodeId, type NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    type Argument,
    BrowseDescription,
    type BrowseDescriptionOptions,
    type BrowsePath,
    BrowsePathResult,
    type BrowsePathTargetOptions,
    BrowseResult,
    type CallMethodRequest,
    type CallMethodResultOptions,
    PermissionType,
    type ReadValueIdOptions,
    ReferenceDescription,
    type ReferenceDescriptionOptions,
    type WriteValue
} from "node-opcua-types";
import { Variant, VariantArrayType } from "node-opcua-variant";
import type { BrowsedReference } from "../browser.js";
import { NO_NODE } from "../node_id_index.js";
import type { StoreAddressSpace } from "./store_address_space.js";
import { attributeDataValue, deniedDataValue, valueDataValue } from "./store_data_value.js";
import type { StoreMethodView } from "./store_method_view.js";
import type { StoreVariableView } from "./store_variable_view.js";

const HIERARCHICAL_REFERENCES = resolveNodeId("ns=0;i=33");
const HAS_TYPE_DEFINITION = resolveNodeId("ns=0;i=40");
const HAS_COMPONENT = resolveNodeId("ns=0;i=47");
const HAS_SUBTYPE = resolveNodeId("ns=0;i=45");
const nullExpandedNodeId = ExpandedNodeId.nullNodeId as ExpandedNodeId;

export class StoreServices {
    readonly #space: StoreAddressSpace;

    constructor(space: StoreAddressSpace) {
        this.#space = space;
    }

    /**
     * one Method call, with the steps and statuses of the node objects: the Object, then the
     * Method (a component of the Object, or of one of its types), then the session's right to
     * call it, then its arguments, then the function bound to it
     */
    public async call(context: ISessionContext | null, request: CallMethodRequest): Promise<CallMethodResultOptions> {
        const space = this.#space;
        const store = space.store;
        const object = store.find(resolveNodeId(request.objectId));
        if (object === NO_NODE || store.nodes.isDeleted(object)) {
            return { statusCode: StatusCodes.BadNodeIdUnknown };
        }
        const objectClass = store.nodes.nodeClass(object);
        if (objectClass !== NodeClass.Object && objectClass !== NodeClass.ObjectType) {
            return { statusCode: StatusCodes.BadNodeIdInvalid };
        }
        const requested = store.find(resolveNodeId(request.methodId));
        if (requested === NO_NODE || store.nodes.isDeleted(requested) || store.nodes.nodeClass(requested) !== NodeClass.Method) {
            return { statusCode: StatusCodes.BadMethodInvalid };
        }
        const method = this.#methodOf(object, requested);
        if (method === NO_NODE) {
            return { statusCode: StatusCodes.BadMethodInvalid };
        }
        // the function of the Method, or of the declaration in the type when the instance has none
        const handler = space.methods.get(method) ?? space.methods.get(requested);
        if (!handler) {
            return { statusCode: StatusCodes.BadNotExecutable };
        }
        if (space.permissions.isAccessRestricted(context, method)) {
            return { statusCode: StatusCodes.BadSecurityModeInsufficient };
        }
        if ((space.permissions.permissions(context, method) & PermissionType.Call) === 0) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }
        const view = space.viewOf(method) as StoreMethodView;
        const declared = view.inputArguments ?? (space.viewOf(requested) as StoreMethodView).inputArguments;
        const inputArguments = (request.inputArguments ?? []) as Variant[];
        const checked = this.#checkArguments(declared, inputArguments);
        if (!checked.statusCode.isGood()) {
            return checked;
        }
        try {
            const result = await handler(inputArguments, context, store.nodes.nodeId(object));
            return {
                statusCode: result.statusCode ?? StatusCodes.Good,
                inputArgumentResults: result.inputArgumentResults ?? checked.inputArgumentResults,
                outputArguments: (result.outputArguments ?? []).map((v) => (v instanceof Variant ? v : new Variant(v)))
            };
        } catch {
            return { statusCode: StatusCodes.BadInternalError };
        }
    }

    /** the Method a call of `requested` on `object` runs; NO_NODE when it is not one of the object */
    #methodOf(object: number, requested: number): number {
        const space = this.#space;
        const store = space.store;
        const components = space.browser.browse(object, { referenceType: HAS_COMPONENT, forward: true });
        if (components.some((r) => r.target === requested)) {
            return requested;
        }
        // a Method of one of its types: the instance's own Method of that name when it has one
        const declaringParent = store.nodes.parent(requested);
        let type = store.nodes.nodeClass(object) === NodeClass.ObjectType ? object : store.nodes.typeDefinition(object);
        while (type !== NO_NODE) {
            if (type === declaringParent) {
                const name = store.nodes.browseName(requested);
                const own = components.find(
                    (r) => store.nodes.nodeClass(r.target) === NodeClass.Method && store.nodes.browseName(r.target) === name
                );
                return own ? own.target : requested;
            }
            const supertypes = space.browser.browse(type, { referenceType: HAS_SUBTYPE, includeSubtypes: false, forward: false });
            type = supertypes.length > 0 ? supertypes[0].target : NO_NODE;
        }
        return NO_NODE;
    }

    /** the input arguments against what the Method declares; nothing to check when it declares nothing the store can read */
    #checkArguments(
        declared: Argument[] | null,
        inputs: Variant[]
    ): { statusCode: StatusCode; inputArgumentResults?: StatusCode[] } {
        if (!declared) {
            return { statusCode: StatusCodes.Good, inputArgumentResults: inputs.map(() => StatusCodes.Good) };
        }
        if (inputs.length < declared.length) {
            return { statusCode: StatusCodes.BadArgumentsMissing };
        }
        if (inputs.length > declared.length) {
            return { statusCode: StatusCodes.BadTooManyArguments };
        }
        const results = declared.map((argument, k) =>
            this.#accepts(argument, inputs[k]) ? StatusCodes.Good : StatusCodes.BadTypeMismatch
        );
        const allGood = results.every((r) => r === StatusCodes.Good);
        return { statusCode: allGood ? StatusCodes.Good : StatusCodes.BadInvalidArgument, inputArgumentResults: results };
    }

    #accepts(argument: Argument, input: Variant): boolean {
        const space = this.#space;
        const dataType = argument.dataType ? space.store.find(resolveNodeId(argument.dataType)) : NO_NODE;
        if (!space.dataTypes.accepts(dataType, input.dataType, false)) {
            return false;
        }
        const scalar = input.arrayType === VariantArrayType.Scalar;
        switch (argument.valueRank) {
            case -1: // a scalar
                return scalar;
            case -2: // anything
                return true;
            case -3: // a scalar or one dimension
                return scalar || input.arrayType === VariantArrayType.Array;
            case 0: // one dimension or more
                return !scalar;
            case 1:
                return input.arrayType === VariantArrayType.Array;
            default:
                return input.arrayType === VariantArrayType.Matrix && (input.dimensions?.length ?? 0) === argument.valueRank;
        }
    }

    /** one item of a Read, as the server's accessor answers it for a node object */
    public read(
        context: ISessionContext | null,
        nodeToRead: ReadValueIdOptions,
        maxAge: number,
        timestampsToReturn?: TimestampsToReturn
    ): DataValue {
        if (!nodeToRead.nodeId || nodeToRead.attributeId === undefined) {
            throw new Error("StoreServices#read: expecting a nodeId and an attributeId");
        }
        if (timestampsToReturn === TimestampsToReturn.Invalid) {
            return new DataValue({ statusCode: StatusCodes.BadTimestampsToReturnInvalid });
        }
        timestampsToReturn = coerceTimestampsToReturn(timestampsToReturn);
        const space = this.#space;
        const index = space.store.find(resolveNodeId(nodeToRead.nodeId));
        if (index === NO_NODE) {
            return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
        }
        const attributeId = nodeToRead.attributeId as AttributeIds;
        let dataValue = this.#attribute(context, index, attributeId, nodeToRead.indexRange, nodeToRead.dataEncoding);
        dataValue = apply_timestamps_no_copy(dataValue, timestampsToReturn, attributeId);
        if (timestampsToReturn === TimestampsToReturn.Server) {
            dataValue.sourceTimestamp = null;
            dataValue.sourcePicoseconds = 0;
        }
        if (timestampsToReturn === TimestampsToReturn.Both || timestampsToReturn === TimestampsToReturn.Server) {
            const now = context?.currentTime || getCurrentClock();
            if (!dataValue.serverTimestamp || isMinDate(dataValue.serverTimestamp)) {
                dataValue.serverTimestamp = now.timestamp;
                dataValue.serverPicoseconds = 0;
            } else if (maxAge < 0x7fffffff && now.timestamp.getTime() - dataValue.serverTimestamp.getTime() > maxAge) {
                // Part 4 5.10.2: a value without a data source is re-verified at read time, and
                // ServerTimestamp is the time the server (re)obtained it
                dataValue.serverTimestamp = now.timestamp;
                dataValue.serverPicoseconds = now.picoseconds;
                if (attributeId === AttributeIds.Value && dataValue.statusCode.isGoodish()) {
                    // the columns move with it, so that a later read within MaxAge never reports
                    // an older ServerTimestamp than this one
                    space.store.values.setServerTimestamp(index, now.timestamp.getTime(), now.picoseconds);
                }
            }
        }
        return dataValue;
    }

    /** an attribute of a node, from the columns; the Value of a bound Variable through its view */
    #attribute(
        context: ISessionContext | null,
        index: number,
        attributeId: AttributeIds,
        indexRange?: NumericRange | null,
        dataEncoding?: QualifiedNameLike | null
    ): DataValue {
        const space = this.#space;
        if (attributeId !== AttributeIds.Value || space.store.nodes.nodeClass(index) !== NodeClass.Variable) {
            if (indexRange?.isDefined()) {
                return new DataValue({ statusCode: StatusCodes.BadIndexRangeNoData });
            }
            if (isDataEncoding(dataEncoding)) {
                return new DataValue({ statusCode: StatusCodes.BadDataEncodingInvalid });
            }
            return attributeDataValue(space.reader, index, attributeId);
        }
        if (space.bindings.has(index) || (indexRange && !indexRange.isEmpty()) || isDataEncoding(dataEncoding)) {
            // the view knows the getter, the range and the encoding
            return (space.viewOf(index) as StoreVariableView).readValue(context, indexRange, dataEncoding);
        }
        const status = space.permissions.readValueStatus(context, index);
        if (status !== 0) {
            return deniedDataValue(status);
        }
        return valueDataValue(space.store.values, index);
    }

    /**
     * one item of a Write: the status of the write.
     * @param now the time (ms) to stamp the value with: a Write of many items reads the clock once
     *            for all of them, rather than once per item
     */
    public write(context: ISessionContext | null, writeValue: WriteValue, now?: number): number {
        if (!writeValue.value?.value) {
            return StatusCodes.BadTypeMismatch.value;
        }
        const view = this.#space.findNode(writeValue.nodeId);
        if (!view) {
            return StatusCodes.BadNodeIdUnknown.value;
        }
        if (writeValue.attributeId !== AttributeIds.Value) {
            return StatusCodes.BadNotWritable.value;
        }
        if (view.nodeClass !== NodeClass.Variable) {
            return StatusCodes.BadNotWritable.value;
        }
        return (view as StoreVariableView).writeValue(writeValue.value, context, writeValue.indexRange, now);
    }

    /** the Browse of one node */
    public browse(context: ISessionContext | null, description: BrowseDescriptionOptions): BrowseResult {
        if (!description.nodeId) {
            throw new Error("StoreServices#browse: expecting a nodeId");
        }
        const browseDescription = description instanceof BrowseDescription ? description : new BrowseDescription(description);
        if (browseDescription.browseDirection === BrowseDirection.Invalid) {
            return new BrowseResult({ statusCode: StatusCodes.BadBrowseDirectionInvalid });
        }
        const space = this.#space;
        const node = space.store.find(resolveNodeId(browseDescription.nodeId));
        if (node === NO_NODE) {
            return new BrowseResult({ statusCode: StatusCodes.BadNodeIdUnknown });
        }
        let referenceType: NodeId | undefined;
        const requested = browseDescription.referenceTypeId;
        if (requested && !(requested.identifierType === NodeIdType.NUMERIC && requested.value === 0)) {
            const typeNode = space.store.find(requested);
            if (typeNode === NO_NODE || space.store.nodes.nodeClass(typeNode) !== NodeClass.ReferenceType) {
                return new BrowseResult({ statusCode: StatusCodes.BadReferenceTypeIdInvalid });
            }
            referenceType = requested;
        }
        return new BrowseResult({
            statusCode: StatusCodes.Good,
            references: this.references(context, node, browseDescription, referenceType)
        });
    }

    /** the reference descriptions of a node's references, filtered as a Browse filters them */
    public references(
        context: ISessionContext | null,
        node: number,
        browseDescription: BrowseDescription,
        referenceType: NodeId | undefined,
        targetNamespaces?: ReadonlySet<number>
    ): ReferenceDescription[] {
        const space = this.#space;
        const direction = browseDescription.browseDirection;
        const browsed = space.browser.browse(node, {
            referenceType,
            includeSubtypes: browseDescription.includeSubtypes,
            forward: direction === BrowseDirection.Both ? undefined : direction === BrowseDirection.Forward,
            nodeClassMask: browseDescription.nodeClassMask
        });
        const out: ReferenceDescription[] = [];
        for (const r of browsed) {
            if (targetNamespaces && !targetNamespaces.has(space.store.nodes.namespace(r.target))) continue;
            if (!space.permissions.canBrowse(context, r.target)) continue;
            out.push(this.#describe(r, browseDescription.resultMask));
        }
        return out;
    }

    #describe(r: BrowsedReference, resultMask: number): ReferenceDescription {
        const space = this.#space;
        const nodes = space.store.nodes;
        const target = r.target;
        const nodeClass = nodes.nodeClass(target);
        const data: ReferenceDescriptionOptions = {
            referenceTypeId: resultMask & ResultMask.ReferenceType ? space.store.referenceTypeOf(r.referenceTypeOrdinal) : null,
            isForward: resultMask & ResultMask.IsForward ? r.forward : false,
            nodeId: coerceExpandedNodeId(nodes.nodeId(target)),
            browseName:
                resultMask & ResultMask.BrowseName
                    ? new QualifiedName({ namespaceIndex: nodes.browseNameNamespace(target), name: nodes.browseName(target) })
                    : null,
            displayName: resultMask & ResultMask.DisplayName ? new LocalizedText({ text: nodes.displayName(target) }) : null,
            nodeClass: resultMask & ResultMask.NodeClass ? nodeClass : NodeClass.Unspecified,
            typeDefinition: nullExpandedNodeId
        };
        if (resultMask & ResultMask.TypeDefinition && (nodeClass === NodeClass.Object || nodeClass === NodeClass.Variable)) {
            const t = space.browser.typeDefinition(target, HAS_TYPE_DEFINITION);
            if (t !== NO_NODE) data.typeDefinition = coerceExpandedNodeId(nodes.nodeId(t));
        }
        return new ReferenceDescription(data);
    }

    /** one TranslateBrowsePathsToNodeIds path, with the statuses the node objects give */
    public translate(browsePath: BrowsePath): BrowsePathResult {
        const space = this.#space;
        const start = space.store.find(resolveNodeId(browsePath.startingNode));
        if (start === NO_NODE) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadNodeIdUnknown });
        }
        const elements = browsePath.relativePath.elements ?? [];
        if (elements.length === 0) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadNothingToDo, targets: [] });
        }
        for (const element of elements) {
            if (!element.targetName?.name) {
                // the last element must name its target too (Part 4, TranslateBrowsePathsToNodeIds)
                return new BrowsePathResult({ statusCode: StatusCodes.BadBrowseNameInvalid });
            }
        }
        const found = space.browser.translate(
            start,
            elements.map((e) => ({
                referenceType: e.referenceTypeId && e.referenceTypeId.value !== 0 ? e.referenceTypeId : undefined,
                isInverse: e.isInverse,
                includeSubtypes: e.includeSubtypes,
                targetName: { namespaceIndex: e.targetName.namespaceIndex, name: e.targetName.name ?? "" }
            })),
            HIERARCHICAL_REFERENCES
        );
        if (found.length === 0) {
            return new BrowsePathResult({ statusCode: StatusCodes.BadNoMatch });
        }
        const targets: BrowsePathTargetOptions[] = found.map((index) => ({
            remainingPathIndex: 0xffffffff,
            targetId: coerceExpandedNodeId(space.store.nodes.nodeId(index))
        }));
        return new BrowsePathResult({ statusCode: StatusCodes.Good, targets });
    }
}
