/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { UAView as UAViewPublic } from "../source";
import { BaseNode, InternalBaseNodeOptions } from "./base_node";
import { SessionContext } from "./session_context";

export interface InternalViewOptions extends InternalBaseNodeOptions {
    containsNoLoops?: boolean;
}

export class UAView extends BaseNode implements UAViewPublic {

    public readonly nodeClass = NodeClass.View;
    public readonly containsNoLoops: boolean;
    public readonly eventNotifier: number;

    constructor(options: InternalViewOptions) {
        super(options);
        this.containsNoLoops = !!options.containsNoLoops;
        this.eventNotifier = 0;
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue {

        context = context || SessionContext.defaultContext;
        assert(context instanceof SessionContext);

        const options: DataValueLike = {};

        switch (attributeId) {

            case AttributeIds.EventNotifier:
                options.value = { dataType: DataType.UInt32, value: this.eventNotifier };
                options.statusCode = StatusCodes.Good;
                break;

            case AttributeIds.ContainsNoLoops:
                options.value = { dataType: DataType.Boolean, value: this.containsNoLoops };
                options.statusCode = StatusCodes.Good;
                break;

            default:
               return super.readAttribute(context, attributeId);
        }
        return new DataValue(options);
    }
}
