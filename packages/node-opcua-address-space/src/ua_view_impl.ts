/**
 * @module node-opcua-address-space
 */
import { NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { EventNotifierFlags, ISessionContext, UAView } from "node-opcua-address-space-base";

import { SessionContext } from "../source/session_context";
import { BaseNodeImpl, InternalBaseNodeOptions } from "./base_node_impl";

export interface InternalViewOptions extends InternalBaseNodeOptions {
    containsNoLoops?: boolean;
}

export class UAViewImpl extends BaseNodeImpl implements UAView {
    public readonly nodeClass = NodeClass.View;
    public readonly containsNoLoops: boolean;
    private _eventNotifier: EventNotifierFlags;
    public get eventNotifier(): EventNotifierFlags {
        return this._eventNotifier;
    }

    constructor(options: InternalViewOptions) {
        super(options);
        this.containsNoLoops = !!options.containsNoLoops;
        this._eventNotifier = EventNotifierFlags.None;
    }

    public readAttribute(context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        context = context || SessionContext.defaultContext;

        const options: DataValueLike = {};

        switch (attributeId) {
            case AttributeIds.EventNotifier:
                options.value = { dataType: DataType.Byte, value: this.eventNotifier };
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
