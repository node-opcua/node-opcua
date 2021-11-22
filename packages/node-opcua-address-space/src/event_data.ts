/**
 * @module node-opcua-address-space.Private
 */
import { assert } from "node-opcua-assert";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { constructBrowsePathFromQualifiedName } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { SimpleAttributeOperand } from "node-opcua-types";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

import { ISessionContext, BaseNode, IEventData, UAVariable } from "node-opcua-address-space-base";

/**
 * @class EventData
 * @param eventTypeNode {BaseNode}
 * @constructor
 */
export class EventData implements IEventData {
    public eventId: NodeId;
    public $eventDataSource: BaseNode;

    private __nodes: { [key: string]: Variant };

    constructor(eventTypeNode: BaseNode) {
        this.__nodes = {};
        this.eventId = new NodeId();
        this.$eventDataSource = eventTypeNode;
    }

    /**
     * @method resolveSelectClause
     * @param selectClause {SimpleAttributeOperand}
     * @return {NodeId|null}
     */
    public resolveSelectClause(selectClause: SimpleAttributeOperand): NodeId | null {
        assert(selectClause instanceof SimpleAttributeOperand);
        const addressSpace = this.$eventDataSource.addressSpace;

        if (selectClause.browsePath!.length === 0 && selectClause.attributeId === AttributeIds.NodeId) {
            assert(!"Cannot use resolveSelectClause on this selectClause as it has no browsePath");
        }
        // navigate to the innerNode specified by the browsePath [ QualifiedName]
        const browsePath = constructBrowsePathFromQualifiedName(this.$eventDataSource, selectClause.browsePath);

        // xx console.log(self.$eventDataSource.browseName.toString());
        // xx console.log("xx browse Path", browsePath.toString());

        const browsePathResult = addressSpace.browsePath(browsePath);

        // xx console.log(" br",
        //    self.$eventDataSource.nodeId.toString(),
        //    selectClause.browsePath.toString(),
        //    browsePathResult.targets[0] ? browsePathResult.targets[0].targetId.toString() : "!!!NOT FOUND!!!"é)

        if (browsePathResult.statusCode !== StatusCodes.Good) {
            return null;
        }
        if (!browsePathResult.targets) {
            return null;
        }
        // istanbul ignore next
        if (browsePathResult.targets.length !== 1) {
            // xx console.log("selectClause ",selectClause.toString());
            // xx console.log("browsePathResult ",browsePathResult.toString());
            // xx throw new Error("browsePathResult.targets.length !== 1"  + browsePathResult.targets.length);
        }
        return browsePathResult.targets[0].targetId;
    }

    public setValue(lowerName: string, node: BaseNode, variant: VariantLike): void {
        const eventData = this as any;
        eventData[lowerName] = Variant.coerce(variant); /// _coerceVariant(variant);
        eventData.__nodes[node.nodeId.toString()] = eventData[lowerName];
    }
    /**
     * @method readValue
     * @param nodeId {NodeId}
     * @param selectClause {SimpleAttributeOperand}
     * @return {Variant}
     */
    public readValue(sessionContext: ISessionContext, nodeId: NodeId, selectClause: SimpleAttributeOperand): Variant {
        assert(nodeId instanceof NodeId);
        assert(selectClause instanceof SimpleAttributeOperand);
        assert(nodeId instanceof NodeId);
        const addressSpace = this.$eventDataSource.addressSpace;

        const node = addressSpace.findNode(nodeId)!;
        const key = node.nodeId.toString();

        // if the value exists in cache ... we read it from cache...
        const cached_value = this.__nodes[key];
        if (cached_value) {
            return cached_value;
        }

        if (node.nodeClass === NodeClass.Variable && selectClause.attributeId === AttributeIds.Value) {
            const nodeVariable = node as UAVariable;
            return prepare(nodeVariable.readValue(sessionContext, selectClause.indexRange));
        }
        return prepare(node.readAttribute(sessionContext, selectClause.attributeId));
    }
}

function prepare(dataValue: DataValue): Variant {
    if (dataValue.statusCode === StatusCodes.Good) {
        return dataValue.value;
    }
    return new Variant({ dataType: DataType.StatusCode, value: dataValue.statusCode });
}
