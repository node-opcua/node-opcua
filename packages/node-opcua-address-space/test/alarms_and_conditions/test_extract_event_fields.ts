import * as should from "should";
import * as fs from "fs";
import {
    AddressSpace,
    extractEventFields,
    UAObject,
    generateAddressSpace,
    SessionContext,
    IEventData,
    EventData,
    checkWhereClause
} from "../..";
import { nodesets } from "node-opcua-nodesets";
import { EventFilter, EventFilterOptions, FilterOperator, LiteralOperand, ContentFilter } from "node-opcua-types";
import { coerceQualifiedName, AttributeIds } from "node-opcua-data-model";
import { coerceNodeId, resolveNodeId } from "node-opcua-nodeid";
import { Variant, DataType } from "node-opcua-variant";

describe("Testing extract EventField", function (this: any) {

    let addressSpace: AddressSpace;
    let source: UAObject;
    const test = this;
    before(async () => {

        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("PRIVATE_NAMESPACE");

        const xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace = addressSpace.getOwnNamespace();

        addressSpace.installAlarmsAndConditionsService();

        const green = namespace.addObject({
            browseName: "Green",
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });

        source = namespace.addObject({
            browseName: "Motor.RPM",
            componentOf: green,
            eventSourceOf: green
        });

        test.variableWithAlarm = namespace.addVariable({
            browseName: "VariableWithLimit",
            dataType: "Double",
            propertyOf: source
        });

        test.setpointNodeNode = namespace.addVariable({
            browseName: "SetPointValue",
            dataType: "Double",
            propertyOf: source
        });

        test.addressSpace = addressSpace;
        test.source = source;
        test.green = green;
    });
    after(() => {
        addressSpace.dispose();
    });

    it("EVF1- EventFilter", () => {

        const eventFilter = new EventFilter({
            selectClauses                 /* SimpleAttributeOp[] */: [
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("Changes")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041"),
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("EventType")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041"),
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("SourceNode")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041"),
                }
            ],
            whereClause: new ContentFilter({
                elements /* ContentFilterElem[] */: [
                    {
                        filterOperator /* FilterOperator      */: FilterOperator.OfType,

                        filterOperands /* ExtensionObject  [] */: [
                            new LiteralOperand({
                                value: new Variant({
                                    dataType: DataType.NodeId, value: coerceNodeId("ns=0;i=2132")
                                })
                            })
                        ]
                    }
                ]
            })
        });
        const sessionContext = SessionContext.defaultContext;

        const eventTypeNode = addressSpace.findNode("DeviceFailureEventType")!;
        const eventData: IEventData = new EventData(eventTypeNode);
        const result = extractEventFields(sessionContext, eventFilter.selectClauses || [], eventData);
    });

    it("EVF2- check Where Clause OfType", () => {

        const whereClause = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.OfType,

                    filterOperands /* ExtensionObject  [] */: [
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.NodeId, value: resolveNodeId("SystemEventType")
                            })
                        })
                    ]
                }
            ]
        })
        const sessionContext = SessionContext.defaultContext;

        {
            const deviceFailureEventType = addressSpace.findNode("DeviceFailureEventType")!;
            should.exist(deviceFailureEventType);
            const eventData1: IEventData = new EventData(deviceFailureEventType);
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(true);
        }
        {
            const systemEventType = addressSpace.findNode("SystemEventType")!;
            should.exist(systemEventType);
            const eventData2: IEventData = new EventData(systemEventType);
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData2).should.eql(true);
        }
        {
            const eventQueueOverflowEventType = addressSpace.findNode("EventQueueOverflowEventType")!;
            should.exist(eventQueueOverflowEventType);
            const eventData3: IEventData = new EventData(eventQueueOverflowEventType);
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData3).should.eql(false);
        }
    });

});
