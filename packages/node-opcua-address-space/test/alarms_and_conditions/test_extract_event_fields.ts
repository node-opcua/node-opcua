import * as fs from "fs";
import * as should from "should";
import { nodesets } from "node-opcua-nodesets";
import {
    EventFilter,
    FilterOperator,
    LiteralOperand,
    ContentFilter,
    SimpleAttributeOperand,
    ElementOperand,
    ContentFilterElementOptions
} from "node-opcua-types";
import { coerceQualifiedName, AttributeIds } from "node-opcua-data-model";
import { coerceNodeId, resolveNodeId, NodeId, NodeIdLike } from "node-opcua-nodeid";
import { Variant, DataType } from "node-opcua-variant";
import {
    AddressSpace,
    UAObject,
    SessionContext,
    extractEventFields,
    checkWhereClause,
    RaiseEventData,
    UAEventType,
    UAVariable,
    IEventData,
    FilterContext,
    checkFilter,
    UAVariableT,
    UAExclusiveDeviationAlarmEx
} from "../..";
import { generateAddressSpace } from "../../nodeJS";

interface This extends Mocha.Suite {
    variableWithAlarm: UAVariable;
    setpointNodeNode: UAVariable;
    addressSpace: AddressSpace;
    source: UAObject;
    green: UAObject;
    alarmNode: UAExclusiveDeviationAlarmEx;
}

// https://reference.opcfoundation.org/v105/Core/docs/Part4/7.7.3/

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

        test.alarmNode = namespace.instantiateExclusiveDeviationAlarm({
            browseName: "MyNonExclusiveAlarm",
            conditionSource: source,
            highHighLimit: 100.0,
            highLimit: 10.0,
            inputNode: test.variableWithAlarm,
            lowLimit: -1.0,
            lowLowLimit: -10.0
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    function createEventData(eventTypeName: string): IEventData {
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

    it("EV01- EventFilter", () => {
        const eventFilter = new EventFilter({
            selectClauses: [
                {
                    attributeId: AttributeIds.Value,
                    browsePath: ["Changes"],
                    typeDefinitionId: resolveNodeId("BaseEventType")
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: ["EventType"],
                    typeDefinitionId: resolveNodeId("BaseEventType")
                },
                {
                    attributeId: AttributeIds.Value,
                    browsePath: ["SourceNode"],
                    typeDefinitionId: resolveNodeId("BaseEventType")
                }
            ],
            whereClause: new ContentFilter({
                elements /* ContentFilterElem[] */: [ofType("BaseModelChangeEventType")]
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
    it("EV01b ", () => {
        const selectClauses = [
            new SimpleAttributeOperand({
                attributeId: AttributeIds.Value,
                browsePath: ["EventType"]
            })
        ];
        const sessionContext = SessionContext.defaultContext;
        const eventData = createEventData("EventQueueOverflowEventType");
        const result = extractEventFields(sessionContext, selectClauses, eventData);
        result[0].dataType.should.eql(DataType.NodeId);
        result[0].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
    });

    it("EV02- check Where Clause OfType", () => {
        const contentFilter = new ContentFilter({
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
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("SystemEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("EventQueueOverflowEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData).should.eql(false);
        }
    });

    it("EV03- check Where Clause InList OfType", () => {
        const contentFilter = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.InList,

                    filterOperands /* ExtensionObject  [] */: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["EventType"],
                            typeDefinitionId: new NodeId()
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
        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("AuditHistoryDeleteEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("DeviceFailureEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("SystemEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("EventQueueOverflowEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });

    it("EV04- check WhereClause with Not Operand #810", () => {
        const contentFilter = new ContentFilter({
            elements: [
                {
                    /*0*/ filterOperator /* FilterOperator      */: FilterOperator.Not,
                    filterOperands /* ExtensionObject  [] */: [
                        new ElementOperand({
                            index /* UInt32*/: 1
                        })
                    ]
                },
                ofType("GeneralModelChangeEventType") // (ns = 0; i=2133))
            ]
        });

        const sessionContext = SessionContext.defaultContext;

        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("GeneralModelChangeEventType");
            checkWhereClause(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });

    const sessionContext = SessionContext.defaultContext;

    function getFilterContext() {
        const filterContext: FilterContext = {
            addressSpace,
            sessionContext,
            rootNode: test.alarmNode
        };
        return filterContext;
    }

    [
        //                          2 , 10 , 100  compare to 10
        { op: FilterOperator.LessThan, result: [true, false, false] },
        { op: FilterOperator.LessThanOrEqual, result: [true, true, false] },
        { op: FilterOperator.GreaterThan, result: [false, false, true] },
        { op: FilterOperator.GreaterThanOrEqual, result: [false, true, true] },
        { op: FilterOperator.Equals, result: [false, true, false] }
    ].forEach(({ op, result }) =>
        it(`EV05-${op} - check checkFilter with ${FilterOperator[op]} operand`, () => {
            const contentFilter = new ContentFilter({
                elements: [
                    {
                        filterOperator: op,
                        filterOperands: [
                            new SimpleAttributeOperand({
                                attributeId: AttributeIds.Value,
                                browsePath: ["Severity"]
                            }),
                            new LiteralOperand({
                                value: new Variant({
                                    dataType: DataType.Double,
                                    value: 10.0
                                })
                            })
                        ]
                    }
                ]
            });

            const severityNode = test.alarmNode.getChildByName("Severity")! as UAVariableT<number, DataType.UInt16>;
            const filterContext = getFilterContext();

            {
                severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 2.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[0]);
            }
            {
                severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 10.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[1]);
            }
            {
                severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 100.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[2]);
            }
        })
    );

    it("EV06 - checkFilter with Or operand", () => {
        const contentFilter = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.Or,
                    filterOperands: [
                        new ElementOperand({
                            index /* UInt32*/: 1
                        }),
                        new ElementOperand({
                            index /* UInt32*/: 2
                        })
                    ]
                },
                {
                    filterOperator: FilterOperator.GreaterThanOrEqual,
                    filterOperands: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["Severity"]
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.Double,
                                value: 10.0
                            })
                        })
                    ]
                },
                {
                    filterOperator: FilterOperator.LessThanOrEqual,
                    filterOperands: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["Severity"]
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.Double,
                                value: 5.0
                            })
                        })
                    ]
                }
            ]
        });

        const severityNode = test.alarmNode.getChildByName("Severity")! as UAVariableT<number, DataType.UInt16>;

        const filterContext = getFilterContext();

        //  Value >= 10.0 OR Value <= 5.0
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 4.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 5.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 6.0 });
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 9.0 });
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 10.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 11.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
    });

    it("EV07 - checkFilter with Between operand", () => {
        const whereClause = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.Between,
                    filterOperands: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["Severity"]
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.Double,
                                value: 5.0
                            })
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.Double,
                                value: 10.0
                            })
                        })
                    ]
                }
            ]
        });

        const severityNode = test.alarmNode.getChildByName("Severity")! as UAVariableT<number, DataType.UInt16>;

        const filterContext = getFilterContext();

        //  true when 5.0 <= Value <= 10.0
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 4.0 });
            checkFilter(filterContext, whereClause).should.eql(false);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 5.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 6.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 9.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 10.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            severityNode.setValueFromSource({ dataType: DataType.UInt16, value: 11.0 });
            checkFilter(filterContext, whereClause).should.eql(false);
        }
    });

    it("EV08 - checkFilter with And operand", () => {
        const contentFilter = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.And,
                    filterOperands: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["EnabledState", "Id"]
                        }),
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["AckedState", "Id"]
                        })
                    ]
                }
            ]
        });

        const filterContext = getFilterContext();
        {
            test.alarmNode.setEnabledState(true);
            test.alarmNode.acknowledgeAndAutoConfirmBranch(test.alarmNode.currentBranch(), "Just a test");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            test.alarmNode.setEnabledState(false);
            test.alarmNode.acknowledgeAndAutoConfirmBranch(test.alarmNode.currentBranch(), "Just a test");
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });

    it("EV09 - checkFilter with (unsupported) Like operand", () => {
        const contentFilter = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.Like,
                    filterOperands: []
                }
            ]
        });

        const filterContext = getFilterContext();
        {
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });
    it("EV10 - checkFilter empty", () => {
        const contentFilter = new ContentFilter({
            elements: null
        });

        const filterContext = getFilterContext();
        {
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
    });

    function ofType(nodeId: NodeIdLike): ContentFilterElementOptions {
        const element: ContentFilterElementOptions = {
            filterOperator: FilterOperator.OfType,
            filterOperands: [
                new LiteralOperand({
                    value: {
                        dataType: DataType.NodeId,
                        value: resolveNodeId(nodeId)
                    }
                })
            ]
        };
        return element;
    }
    it("EV11 - checkFilter OfType with Variable", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.rootNode = test.variableWithAlarm;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
    });

    it("EV12 - checkFilter OfType with Object", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.rootNode = test.alarmNode;
        checkFilter(filterContext, contentFilter).should.eql(false);
        checkFilter(filterContext, contentFilter2).should.eql(true);
    });

    it("EV13 - checkFilter OfType with DataType", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("Number")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("String")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });
        filterContext.rootNode = addressSpace.findDataType("UInt16", 0)!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV14 - checkFilter OfType with ReferenceType", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("HasChild")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("HasSubtype")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });
        filterContext.rootNode = addressSpace.findReferenceType("HasComponent", 0)!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV15 - checkFilter OfType with ObjectType   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("NetworkAddressType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("OrderedListType")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });
        filterContext.rootNode = addressSpace.findObjectType("NetworkAddressType", 0)!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV16 - checkFilter OfType with VariableType   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("PropertyType")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });
        filterContext.rootNode = addressSpace.findVariableType("CubeItemType", 0)!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });
    it("EV16 - checkFilter OfType with VariableType - no Root   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        (filterContext.rootNode as any) = null;

        checkFilter(filterContext, contentFilter).should.eql(false);
    });
    it("EV17 - checkFilter OfType with VariableType - root is Method ( no sense !)   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        filterContext.rootNode = addressSpace.rootFolder.objects.server.getMonitoredItems!;

        checkFilter(filterContext, contentFilter).should.eql(false);
    });
});
