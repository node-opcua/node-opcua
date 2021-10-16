"use strict";

/* jslint */
/*global require,describe, it, before, after */
// tslint:disable: only-arrow-functions
// tslint:disable: no-console
// tslint:disable: ordered-imports
import * as util from "util";
import { EventEmitter } from "events";
import * as should from "should";

import {
    AddressSpace,
    checkSelectClauses,
    IEventData,
    EventData,
    extractEventFields,
    Namespace,
    UAEventType,
    UAObject,
    SessionContext,
    BaseNode
} from "node-opcua-address-space";
import { getMiniAddressSpace } from "node-opcua-address-space/testHelpers";

import { AttributeIds, NodeClass, coerceQualifiedName } from "node-opcua-data-model";
import { EventFilter, SimpleAttributeOperand } from "node-opcua-service-filter";
import { EventFieldList } from "node-opcua-service-subscription";
import { DataType, Variant } from "node-opcua-variant";
import { NodeId } from "node-opcua-nodeid";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Events  ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let eventType: UAEventType;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        eventType = namespace.addEventType({ browseName: "SomeEventType" });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should create a new EventType", () => {
        eventType.browseName.toString().should.eql("1:SomeEventType");
    });

    class Observer {
        /* empty */
        public onEvent: any;
    }

    util.inherits(Observer, EventEmitter);

    it("should raise a new transitory event of  EventType", function (done: () => void) {
        const serverObject = addressSpace.findNode("Server")! as UAObject;
        serverObject.browseName.toString().should.eql("Server");

        // tslint:disable-next-line: no-shadowed-variable
        const eventType = addressSpace.findEventType("1:SomeEventType")!;

        const observer = new Observer();

        observer.onEvent = (evtData: any) => {
            debugLog(" EVENT RECEIVED :", evtData.sourceName.value);
            evtData.sourceName.dataType.should.eql(DataType.String);

            done();
        };

        serverObject.once("event", observer.onEvent.bind(observer));

        serverObject.raiseEvent(eventType, {
            sourceName: { dataType: "String", value: "Hello" },
            sourceNode: { dataType: "NodeId", value: serverObject.nodeId },
            message: { dataType: "String", value: "Hello World" }
        });
    });

    it("should extract EventData from an select clause", function () {
        const baseEventType = addressSpace.findEventType("BaseEventType")!;

        const a = new EventFilter({
            selectClauses: [
                {
                    browsePath: [coerceQualifiedName("")],
                    typeDefinitionId: NodeId.nullNodeId
                }
            ],
            whereClause: {
                elements: []
            }
        });

        const eventFilter = new EventFilter({
            selectClauses: [
                // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("EventId")],
                    typeDefinitionId: baseEventType.nodeId
                },
                { typeDefinitionId: baseEventType.nodeId, browsePath: [{ name: "SourceNode" }], attributeId: AttributeIds.Value },
                { typeDefinitionId: baseEventType.nodeId, browsePath: [{ name: "SourceName" }], attributeId: AttributeIds.Value },
                { typeDefinitionId: baseEventType.nodeId, browsePath: [{ name: "ReceiveTime" }], attributeId: AttributeIds.Value }
            ],
            whereClause: { elements: [] }
        });

        eventFilter.selectClauses![0].should.be.instanceof(SimpleAttributeOperand);

        const auditEventType = addressSpace.findEventType("AuditEventType")!;
        // xx var auditEventInstance =  auditEventType.instantiate({browseName: "Instantiation"});
        // if (eventFilter.selectClauses.length===0) {return 0;}
        const selectClauseResults = checkSelectClauses(auditEventType, eventFilter.selectClauses!);

        selectClauseResults.length.should.eql(eventFilter.selectClauses!.length);

        // xx debugLog(selectClauseResults);

        const eventData = new EventData(baseEventType);

        const eventFields = extractEventFields(SessionContext.defaultContext, eventFilter.selectClauses!, eventData);

        eventFields.length.should.eql(eventFilter.selectClauses!.length);

        const eventFieldList = new EventFieldList({
            clientHandle: 1,
            eventFields
        });
        // xx debugLog("xxxx ",eventField.toString());
    });

    it("should filter an event", function (done: () => void) {
        const serverObject = addressSpace.findNode("Server")! as UAObject;
        serverObject.browseName.toString().should.eql("Server");

        // myEventType is on the Simulation namespace
        const eventType = addressSpace.findEventType("1:SomeEventType")!;

        should.exist(eventType);

        const eventFilter = new EventFilter({
            selectClauses: [
                // SimpleAttributeOperand
                {
                    // This parameter restricts the operand to instances of the TypeDefinitionNode or
                    //  one of its subtypes
                    typeDefinitionId: NodeId.nullNodeId,
                    browsePath: [{ name: "EventId" }],
                    attributeId: AttributeIds.Value
                },
                { browsePath: [{ name: "SourceNode" }], attributeId: AttributeIds.Value },
                { browsePath: [{ name: "SourceName" }], attributeId: AttributeIds.Value },
                { browsePath: [{ name: "ReceiveTime" }], attributeId: AttributeIds.Value }
            ],
            whereClause: { elements: [] }
        });

        const rTime = new Date(1789, 6, 14);

        const data = {
            sourceName: { dataType: "String", value: "Hello" },
            sourceNode: { dataType: "NodeId", value: serverObject.nodeId },
            message: { dataType: "String", value: "Hello World" },
            receiveTime: { dataType: "DateTime", value: rTime }
        };
        const eventData = addressSpace.constructEventData(eventType, data);

        const eventFields = extractEventFields(SessionContext.defaultContext, eventFilter.selectClauses!, eventData);

        // make sure all event fields are Variant
        eventFields.forEach(function (e) {
            e.should.instanceOf(Variant);
        });

        eventFields.length.should.eql(4);
        eventFields.forEach(function (f) {
            return debugLog(f.toString());
        });

        eventFields[1].value.should.eql(serverObject.nodeId); // sourceNode
        eventFields[2].value.should.eql("Hello");
        eventFields[2].dataType.should.eql(DataType.String); // sourceName
        eventFields[3].dataType.should.eql(DataType.DateTime);

        debugLog(" EVENT RECEIVED :", (eventData as any).sourceName.value);
        done();
    });

    //     Area1
    //       |
    //       | hasNotifier
    //     Tank1
    //    /    \
    //   /      \ hasEventSource
    //  Pump   TempSensor
    //
    it("should bubble events up", function () {
        const area1 = namespace.createNode({
            nodeClass: NodeClass.Object,
            browseName: "Area1",
            organizedBy: addressSpace.rootFolder.objects
        });
        area1.browseName.name!.should.eql("Area1");

        const tank1 = namespace.createNode({
            browseName: "Tank1",
            componentOf: area1,
            eventNotifier: 0x1,
            nodeClass: NodeClass.Object,
            notifierOf: area1
        });
        tank1.browseName.name!.should.eql("Tank1");

        const pump = namespace.createNode({
            browseName: "Pump",
            componentOf: tank1,
            eventNotifier: 1,
            eventSourceOf: tank1,
            nodeClass: NodeClass.Object
        }) as UAObject;

        const pumpStartEventType = namespace.addEventType({ browseName: "PumpStartEventType" });
        pumpStartEventType.browseName.toString().should.eql("1:PumpStartEventType");
        pumpStartEventType.subtypeOfObj!.browseName.toString().should.eql("BaseEventType");

        const receivers: any[] = [];

        function spyFunc(this: BaseNode, object: any, data: any): void {
            debugLog("object ", this.browseName.toString(), " received Event");
            receivers.push(this.browseName.name!.toString());
        }
        const server = addressSpace.findNode("Server")!;

        server.on("event", spyFunc.bind(server));
        (pump as any).on("event", spyFunc.bind(pump));
        tank1.on("event", spyFunc.bind(tank1));
        area1.on("event", spyFunc.bind(area1));

        const eventData = {};
        pump.raiseEvent(pumpStartEventType, eventData);

        receivers.should.eql(["Server", "Pump", "Tank1", "Area1"]);
    });
});
