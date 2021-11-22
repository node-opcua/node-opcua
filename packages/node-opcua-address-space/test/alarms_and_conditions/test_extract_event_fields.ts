import * as fs from "fs";
import * as should from "should";
import { nodesets } from "node-opcua-nodesets";
import {
    EventFilter,
    FilterOperator,
    LiteralOperand,
    ContentFilter,
    SimpleAttributeOperand,
    ElementOperand
} from "node-opcua-types";
import { coerceQualifiedName, AttributeIds } from "node-opcua-data-model";
import { coerceNodeId, resolveNodeId, NodeId } from "node-opcua-nodeid";
import { Variant, DataType } from "node-opcua-variant";

import {
    AddressSpace,
    extractEventFields,
    UAObject,
    SessionContext,
    checkWhereClause,
    RaiseEventData,
    UAEventType,
    UAVariable
} from "../..";
import { generateAddressSpace } from "../../nodeJS";

interface This extends Mocha.Suite {
    variableWithAlarm: UAVariable;
    setpointNodeNode: UAVariable;
    addressSpace: AddressSpace;
    source: UAObject;
    green: UAObject;
}
describe("Testing extract EventField", function (this: Mocha.Suite) {
    let addressSpace: AddressSpace;
    let source: UAObject;
    const test = this as This;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("PRIVATE_NAMESPACE");

        const xml_file = nodesets.standard;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);

        const namespace = addressSpace.getOwnNamespace();

        addressSpace.installAlarmsAndConditionsService();

        const green = namespace.addObject({
            browseName: "Green",
            eventNotifier: 0x1,
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

    function createEventData(eventTypeName: string) {
        const eventTypeNode = addressSpace.findNode(eventTypeName)! as UAEventType;
        should.exist(eventTypeNode);
        const data: RaiseEventData = {};
        data.$eventDataSource = eventTypeNode;
        data.sourceNode = {
            dataType: DataType.NodeId,
            value: test.source.nodeId
        };
        const eventData = addressSpace.constructEventData(eventTypeNode, data);
        return eventData;
    }

    it("EVF1- EventFilter", () => {
        const eventFilter = new EventFilter({
            selectClauses /* SimpleAttributeOp[] */: [
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("Changes")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041")
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("EventType")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041")
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: [coerceQualifiedName("SourceNode")],
                    typeDefinitionId: coerceNodeId("ns=0;i=2041")
                }
            ],
            whereClause: new ContentFilter({
                elements /* ContentFilterElem[] */: [
                    {
                        filterOperator /* FilterOperator      */: FilterOperator.OfType,

                        filterOperands /* ExtensionObject  [] */: [
                            new LiteralOperand({
                                value: new Variant({
                                    dataType: DataType.NodeId,
                                    value: coerceNodeId("ns=0;i=2132")
                                })
                            })
                        ]
                    }
                ]
            })
        });
        const sessionContext = SessionContext.defaultContext;

        const eventData = createEventData("EventQueueOverflowEventType");
        const result = extractEventFields(sessionContext, eventFilter.selectClauses || [], eventData);
        result[0].dataType.should.eql(DataType.Null);
        result[1].dataType.should.eql(DataType.NodeId);
        result[2].dataType.should.eql(DataType.NodeId);
        result[1].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
        result[2].value.toString().should.eql(test.source.nodeId.toString());
    });
    it("EVF1b ", () => {
        const selectClauses = [
            new SimpleAttributeOperand({
                attributeId: AttributeIds.Value,
                browsePath: [coerceQualifiedName("EventType")]
            })
        ];
        const sessionContext = SessionContext.defaultContext;
        const eventData = createEventData("EventQueueOverflowEventType");
        const result = extractEventFields(sessionContext, selectClauses, eventData);
        result[0].dataType.should.eql(DataType.NodeId);
        result[0].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
    });

    it("EVF2- check Where Clause OfType", () => {
        const whereClause = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.OfType,

                    filterOperands /* ExtensionObject  [] */: [
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.NodeId,
                                value: resolveNodeId("SystemEventType")
                            })
                        })
                    ]
                }
            ]
        });
        const sessionContext = SessionContext.defaultContext;

        {
            const eventData = createEventData("DeviceFailureEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("SystemEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("EventQueueOverflowEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData).should.eql(false);
        }
    });
    it("EVF3- check Where Clause InList OfType", () => {
        const whereClause = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.InList,

                    filterOperands /* ExtensionObject  [] */: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: [coerceQualifiedName("EventType")],
                            typeDefinitionId: new NodeId(),
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.NodeId,
                                value: resolveNodeId("AuditCertificateExpiredEventType")
                            })
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.NodeId,
                                value: resolveNodeId("AuditHistoryDeleteEventType")
                            })
                        })
                    ]
                }
            ]
        });
        const sessionContext = SessionContext.defaultContext;
        const op = new SimpleAttributeOperand({
            attributeId: AttributeIds.Value,
            browsePath: [coerceQualifiedName("EventType")],
            typeDefinitionId:new NodeId(),
        });

        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("AuditHistoryDeleteEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("DeviceFailureEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("SystemEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("EventQueueOverflowEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(false);
        }
    });

    it("EVF4- check WhereClause with Not Operand #810", () => {
        const whereClause = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    /*0*/ filterOperator /* FilterOperator      */: FilterOperator.Not,

                    filterOperands /* ExtensionObject  [] */: [
                        new ElementOperand({
                            index /* UInt32*/: 1
                        })
                    ]
                },

                {
                    filterOperator: FilterOperator.OfType,

                    filterOperands: [
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.NodeId,
                                value: resolveNodeId("GeneralModelChangeEventType") // (ns = 0; i=2133))
                            })
                        })
                    ]
                }
            ]
        });

        const sessionContext = SessionContext.defaultContext;

        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("GeneralModelChangeEventType");
            checkWhereClause(addressSpace, sessionContext, whereClause, eventData1).should.eql(false);
        }
    });
});
