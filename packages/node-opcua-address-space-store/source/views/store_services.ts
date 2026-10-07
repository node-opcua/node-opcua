/**
 * @module node-opcua-address-space-store
 *
 * The Read, Write, Browse and TranslateBrowsePaths services answered on a compact address
 * space: the same statuses and the same result shapes as the node objects give, from the
 * columns, with the views only where a value goes through a getter or a setter.
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
import { StatusCodes } from "node-opcua-status-code";
import {
    BrowseDescription,
    type BrowseDescriptionOptions,
    type BrowsePath,
    BrowsePathResult,
    type BrowsePathTargetOptions,
    BrowseResult,
    type ReadValueIdOptions,
    ReferenceDescription,
    type ReferenceDescriptionOptions,
    type WriteValue
} from "node-opcua-types";
import type { BrowsedReference } from "../browser.js";
import { NO_NODE } from "../node_id_index.js";
import type { StoreAddressSpace } from "./store_address_space.js";
import { attributeDataValue, deniedDataValue, valueDataValue } from "./store_data_value.js";
import type { StoreVariableView } from "./store_variable_view.js";

const HIERARCHICAL_REFERENCES = resolveNodeId("ns=0;i=33");
const HAS_TYPE_DEFINITION = resolveNodeId("ns=0;i=40");
const nullExpandedNodeId = ExpandedNodeId.nullNodeId as ExpandedNodeId;

export class StoreServices {
    readonly #space: StoreAddressSpace;

    constructor(space: StoreAddressSpace) {
        this.#space = space;
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
