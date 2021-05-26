/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { isValidByte } from "node-opcua-basic-types";
import { NodeClass, QualifiedNameLike, QualifiedNameOptions } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import {
    EventTypeLike,
    RaiseEventData,
    SessionContext,
    UAMethod as UAMethodPublic,
    UAObject as UAObjectPublic,
    UAObjectType as UAObjectTypePublic
} from "../source";
import { UAConditionBase } from "./alarms_and_conditions/ua_condition_base";
import { BaseNode } from "./base_node";
import { _clone, apply_condition_refresh, ToStringBuilder, UAObject_toString } from "./base_node_private";

export class UAObject extends BaseNode implements UAObjectPublic {
    public readonly nodeClass = NodeClass.Object;
    public readonly eventNotifier: number;
    public readonly symbolicName: string;

    get typeDefinitionObj(): UAObjectTypePublic {
        return super.typeDefinitionObj as UAObjectTypePublic;
    }

    constructor(options: any) {
        super(options);
        this.eventNotifier = options.eventNotifier || 0;
        assert(typeof this.eventNotifier === "number" && isValidByte(this.eventNotifier));
        this.symbolicName = options.symbolicName || null;
    }

    public readAttribute(context: SessionContext, attributeId: AttributeIds): DataValue {
        const now = getCurrentClock();
        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.EventNotifier:
                assert(isValidByte(this.eventNotifier));
                options.value = { dataType: DataType.Byte, value: this.eventNotifier };
                options.serverTimestamp = now.timestamp;
                options.serverPicoseconds = now.picoseconds;
                options.statusCode = StatusCodes.Good;
                break;
            default:
                return BaseNode.prototype.readAttribute.call(this, context, attributeId);
        }
        return new DataValue(options);
    }

    public clone(options: any, optionalFilter?: any, extraInfo?: any): UAObject {
        options = options || {};
        options = {
            ...options,
            eventNotifier: this.eventNotifier,
            symbolicName: this.symbolicName
        };

        const cloneObject = _clone.call(this, UAObject, options, optionalFilter, extraInfo) as UAObject;
        // xx  newObject.propagate_back_references();
        // xx newObject.install_extra_properties();
        return cloneObject;
    }

    /**
     * returns true if the object has some opcua methods
     */
    public get hasMethods(): boolean {
        return this.getMethods().length > 0;
    }

    public getMethodByName(methodName: QualifiedNameOptions): UAMethodPublic | null;
    public getMethodByName(methodName: string, namespaceIndex?: number): UAMethodPublic | null;
    public getMethodByName(methodName: QualifiedNameLike, namespaceIndex?: number): UAMethodPublic | null {
        return super.getMethodByName(methodName, namespaceIndex);
    }

    public getMethods(): UAMethodPublic[] {
        return super.getMethods();
    }

    /**
     * Raise a transient Event
     */
    public raiseEvent(eventType: EventTypeLike | BaseNode, data: RaiseEventData): void {
        const addressSpace = this.addressSpace;

        if (typeof eventType === "string") {
            const eventTypeFound = addressSpace.findEventType(eventType);
            if (!eventTypeFound) {
                throw new Error("raiseEvent: eventType cannot find event Type " + eventType.toString());
            }
            eventType = eventTypeFound;
            if (!eventType || eventType.nodeClass !== NodeClass.ObjectType) {
                throw new Error("eventType must exist and be an UAObjectType");
            }
        } else if (eventType instanceof NodeId) {
            const eventTypeFound = addressSpace.findNode(eventType) as BaseNode;
            if (!eventTypeFound) {
                throw new Error("raiseEvent: eventType cannot find event Type " + eventType.toString());
            }
            eventType = eventTypeFound!;
            if (!eventType || eventType.nodeClass !== NodeClass.ObjectType) {
                throw new Error("eventType must exist and be an UAObjectType" + eventType.toString());
            }
        }

        eventType = eventType as UAObjectTypePublic;

        let eventTypeNode = eventType;
        // istanbul ignore next
        if (!eventTypeNode) {
            throw new Error("UAObject#raiseEventType : Cannot find event type :" + eventType.toString());
        }

        // coerce EventType
        eventTypeNode = addressSpace.findEventType(eventType) as UAObjectTypePublic;
        const baseEventType = addressSpace.findEventType("BaseEventType")!;
        assert(eventTypeNode.isSupertypeOf(baseEventType));

        data.$eventDataSource = eventTypeNode;
        data.sourceNode = data.sourceNode || { dataType: DataType.NodeId, value: this.nodeId };

        const eventData1 = addressSpace.constructEventData(eventTypeNode, data);

        this._bubble_up_event(eventData1);
    }

    public _bubble_up_event(eventData: any) {
        const addressSpace = this.addressSpace;

        const queue: any[] = [];
        // walk up the hasNotify / hasEventSource chain
        const m: any = {};

        // all events are notified to the server object
        // emit on server object
        const server = addressSpace.findNode("Server") as UAObject;

        if (server) {
            assert(server.eventNotifier > 0x00, "Server must be an event notifier");
            server.emit("event", eventData);
            m[server.nodeId.toString()] = server;
        } else {
            // tslint:disable:no-console
            console.warn(
                chalk.yellow("Warning. ") +
                    chalk.cyan("UAObject#raiseEvent") +
                    chalk.red(" cannot find Server object on addressSpace")
            );
        }

        addInQueue(this);

        function addInQueue(obj: BaseNode) {
            const key: string = obj.nodeId.toString();
            if (!m[key]) {
                m[key] = obj;
                queue.push(obj);
            }
        }

        while (queue.length) {
            const obj = queue.pop();
            // emit on object
            obj.emit("event", eventData);

            const elements1 = obj.findReferencesAsObject("HasNotifier", false);
            elements1.forEach(addInQueue);

            const elements2 = obj.findReferencesAsObject("HasEventSource", false);
            elements2.forEach(addInQueue);
        }
    }
    public _conditionRefresh(_cache?: any) {
        apply_condition_refresh.call(this, _cache);
    }

    public toString(): string {
        const options = new ToStringBuilder();
        UAObject_toString.call(this, options);
        return options.toString();
    }
}
