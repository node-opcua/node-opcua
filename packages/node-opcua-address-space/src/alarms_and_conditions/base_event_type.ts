import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { DataType, Variant } from "node-opcua-variant";
import { UAVariableT } from "../../source";
import { BaseNode } from "../base_node";
import { UAObject } from "../ua_object";
import { UAObjectType } from "../ua_object_type";

export interface BaseEventType extends UAObject {
    sourceName: UAVariableT<string>;
    sourceNode: UAVariableT<NodeId>;
}
/**
 * @class BaseEventType
 * @class UAObject
 * @constructor
 */
export class BaseEventType extends UAObject {

    /**
     * @method setSourceName
     * @param name
     */
    public setSourceName(name: string): void {
        assert(typeof name === "string");
        const self = this;
        self.sourceName.setValueFromSource(
          new Variant({
              dataType: DataType.String,
              value: name
          })
        );
    }

    /**
     * @method setSourceNode
     * @param node {NodeId|UAObject}
     */
    public setSourceNode(node: NodeId | BaseNode): void {
        const self = this;
        self.sourceNode.setValueFromSource(
          new Variant({
              dataType: DataType.NodeId,
              value: (node as any).nodeId ? (node as any).nodeId : node
          })
        );
    }
}
