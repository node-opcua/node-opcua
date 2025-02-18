import fs from "fs";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import {
    EventFilter,
    FilterOperator,
    LiteralOperand,
    ContentFilter,
    SimpleAttributeOperand,
    ElementOperand
} from "node-opcua-types";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { resolveNodeId, NodeId } from "node-opcua-nodeid";
import { Variant, DataType, VariantOptions } from "node-opcua-variant";
import { ofType } from "node-opcua-service-filter";

import { FilterContextOnAddressSpace, extractEventFields } from "node-opcua-service-filter/source/on_address_space/index";

import {
    AddressSpace,
    UAObject,
    SessionContext,
    RaiseEventData,
    UAEventType,
    UAVariable,
    IEventData,
    UAVariableT,
    UAExclusiveDeviationAlarmEx,
    PseudoVariantString,
    PseudoVariantDateTime
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { checkFilter } from "node-opcua-service-filter";

import { checkWhereClauseOnAdressSpace } from "../source/filter/check_where_clause_on_address_space";

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

    function createEventData(eventTypeName: string, options?:  
        { message?: PseudoVariantString, localTime?: PseudoVariantDateTime }): IEventData {

        const message = options?.message ;
        const localTime = options?.localTime;

        const eventTypeNode = addressSpace.findNode(eventTypeName)! as UAEventType;

        should.exist(eventTypeNode);
        eventTypeNode.nodeClass.should.eql(NodeClass.ObjectType);

        const data: RaiseEventData & { message?: VariantOptions } = {};
        data.$eventDataSource = eventTypeNode;
        data.sourceNode = {
            dataType: DataType.NodeId,
            value: test.source.nodeId,

        };
        data.message = message;
        data.localTime = localTime; 

        const eventData = addressSpace.constructEventData(eventTypeNode, data);
        return eventData;
    }

    it("EV01 - EventFilter", () => {
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

        // console.log(result[0].toString());

        result[0].dataType.should.eql(DataType.Null);
        result[1].dataType.should.eql(DataType.NodeId);
        result[2].dataType.should.eql(DataType.NodeId);

        result[1].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
        result[2].value.toString().should.eql(test.source.nodeId.toString());
    });
    it("EV02 - EventFilter - verification", () => {
        const selectClauses = [
            new SimpleAttributeOperand({
                attributeId: AttributeIds.Value,
                browsePath: ["EventType"]
            })
        ];
        const sessionContext = SessionContext.defaultContext;

        const eventData = createEventData("EventQueueOverflowEventType");
        // console.log(eventData);
        const result = extractEventFields(sessionContext, selectClauses, eventData);

        result[0].dataType.should.eql(DataType.NodeId);
        result[0].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
    });

    it("EV03 - check Where Clause OfType", () => {
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
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("SystemEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData).should.eql(true);
        }
        {
            const eventData = createEventData("EventQueueOverflowEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData).should.eql(false);
        }
    });

    it("EV04 - check Where Clause InList OfType", () => {
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
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("AuditHistoryDeleteEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("DeviceFailureEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("SystemEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("EventQueueOverflowEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });

    it("EV05 - check Where Clause with Equal FilterOperand and NodeIds as arguments", () => {
        const contentFilter = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.Equals,

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

                    ]
                }
            ]
        });
        const sessionContext = SessionContext.defaultContext;
        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("DeviceFailureEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });

    it("EV06 - check Where Clause = with Equal FilterOperand and LocalTime as arguments", () => {

        const expectedDate = new Date("2019-01-01");
        const contentFilter = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.Equals,

                    filterOperands /* ExtensionObject  [] */: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["LocalTime"],
                            typeDefinitionId: new NodeId()
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.DateTime,
                                value: expectedDate
                            })
                        }),

                    ]
                }
            ]
        });
        const sessionContext = SessionContext.defaultContext;
        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType", { localTime: { dataType: DataType.DateTime, value: new Date(expectedDate)} });
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType", { localTime: { dataType: DataType.DateTime, value: new Date("2000-01-01") } });
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });

    it("EV07 - check Where Clause = with Equal FilterOperand and String as arguments", () => {
        const contentFilter = new ContentFilter({
            elements /* ContentFilterElem[] */: [
                {
                    filterOperator /* FilterOperator      */: FilterOperator.Equals,

                    filterOperands /* ExtensionObject  [] */: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["Message"],
                            typeDefinitionId: new NodeId()
                        }),
                        new LiteralOperand({
                            value: new Variant({
                                dataType: DataType.String,
                                value: "Hello World"
                            })
                        }),

                    ]
                }
            ]
        });
        const sessionContext = SessionContext.defaultContext;
        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType", { message: { dataType: DataType.String, value: "Hello World" } });
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(true);
        }
        {
            const eventData1 = createEventData("DeviceFailureEventType", { message: { dataType:  DataType.String, value: "Bye Bye" } });
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter, eventData1).should.eql(false);
        }
    });


    it("EV08 - check WhereClause with Not Operand #810 (Not(OfType(...))", () => {
        const contentFilter1 = new ContentFilter({
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
        const contentFilter2 = new ContentFilter({
            elements: [
               
                ofType("GeneralModelChangeEventType") // (ns = 0; i=2133))
            ]
        });


        const sessionContext = SessionContext.defaultContext;

        {
            const eventData1 = createEventData("AuditCertificateExpiredEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter1, eventData1).should.eql(true);
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter2, eventData1).should.eql(false);
        }
        {
            const eventData1 = createEventData("GeneralModelChangeEventType");
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter2, eventData1).should.eql(true);
            checkWhereClauseOnAdressSpace(addressSpace, sessionContext, contentFilter1, eventData1).should.eql(false);
        }
    });

    const sessionContext = SessionContext.defaultContext;

    function getFilterContext(): FilterContextOnAddressSpace {
        const eventData = createEventData("ExclusiveDeviationAlarmType");
        const filterContext: FilterContextOnAddressSpace = new FilterContextOnAddressSpace(sessionContext, eventData);
        filterContext.setEventSource(test.alarmNode);

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
        it(`EV08-${FilterOperator[op]} - check checkFilter with ${FilterOperator[op]} operand`, () => {
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

    it("EV09 - checkFilter with Or operand", () => {
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

    it("EV10 - checkFilter with Between operand", () => {
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

    it("EV11 - checkFilter with And operand", () => {
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

    it("EV12 - checkFilter with (unsupported) Like operand", () => {
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
    it("EV13 - checkFilter empty", () => {
        const contentFilter = new ContentFilter({
            elements: null
        });

        const filterContext = getFilterContext();
        {
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
    });

    it("EV14 - checkFilter OfType with Variable", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.setEventSource(test.variableWithAlarm);
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
    });

    it("EV15 - checkFilter OfType with Object", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.setEventSource(test.alarmNode);
        checkFilter(filterContext, contentFilter).should.eql(false);
        checkFilter(filterContext, contentFilter2).should.eql(true);
    });

    it("EV16 - checkFilter OfType with DataType", () => {
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
        filterContext.setEventSource(addressSpace.findDataType("UInt16", 0)!);

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV17 - checkFilter OfType with ReferenceType", () => {
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

        filterContext.setEventSource(addressSpace.findReferenceType("HasComponent", 0)!);

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV18 - checkFilter OfType with ObjectType   ", () => {
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

        filterContext.setEventSource(addressSpace.findObjectType("NetworkAddressType", 0)!);

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV19 - checkFilter OfType with VariableType   ", () => {
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

        filterContext.setEventSource(addressSpace.findVariableType("CubeItemType", 0)!);

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });
    it("EV20 - checkFilter OfType with VariableType - no Root   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        filterContext.setEventSource(null);

        checkFilter(filterContext, contentFilter).should.eql(false);
    });
    it("EV21 - checkFilter OfType with VariableType - root is Method ( no sense !)   ", () => {
        const filterContext = getFilterContext();

        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        filterContext.setEventSource(addressSpace.rootFolder.objects.server.getMonitoredItems!);

        checkFilter(filterContext, contentFilter).should.eql(false);
    });
});
