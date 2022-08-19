import "should";
import {
    EventFilter,
    FilterOperator,
    LiteralOperand,
    ContentFilter,
    SimpleAttributeOperand,
    ElementOperand
} from "node-opcua-types";
import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataType, Variant, VariantOptionsT } from "node-opcua-variant";

import { checkFilter, ofType, extractEventFieldsBase } from "..";
import { FilterContextMock, variableWithAlarm, alarmNode } from "./filter_context_mock";

// https://reference.opcfoundation.org/v105/Core/docs/Part4/7.7.3/

describe("Testing extract EventField", function (this: Mocha.Suite) {
    const filterContext = new FilterContextMock();

    function setSeverity(variant: VariantOptionsT<number, DataType.UInt16>) {
        filterContext.setValue("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode.Severity", variant);
    }
    function setEnabledState(value: boolean) {
        filterContext.setValue("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode.EnabledState.Id", {
            dataType: DataType.Boolean,
            value
        });
    }
    function setAckedState(value: boolean) {
        filterContext.setValue("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode.AckedState.Id", {
            dataType: DataType.Boolean,
            value
        });
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
                elements: [ofType("BaseModelChangeEventType")]
            })
        });

        filterContext.eventSource = filterContext.findNodeByName("EventQueueOverflowEventType");

        filterContext.setValue(
            "EventQueueOverflowEventType.SourceNode",
            new Variant({ dataType: DataType.NodeId, value: resolveNodeId("EventQueueOverflowEventType") })
        );

        const result = extractEventFieldsBase(filterContext, eventFilter.selectClauses || []);

        result[0].dataType.should.eql(DataType.Null);
        result[1].dataType.should.eql(DataType.NodeId);
        result[2].dataType.should.eql(DataType.NodeId);

        result[1].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
        result[2].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
    });
    it("EV01b ", () => {
        const selectClauses = [
            new SimpleAttributeOperand({
                attributeId: AttributeIds.Value,
                browsePath: ["EventType"]
            })
        ];
        const result = extractEventFieldsBase(filterContext, selectClauses);

        result[0].dataType.should.eql(DataType.NodeId);
        result[0].value.toString().should.eql(resolveNodeId("EventQueueOverflowEventType").toString());
    });

    it("EV02- check Where Clause OfType", () => {
        const contentFilter = new ContentFilter({ elements: [ofType("SystemEventType")] });
        {
            filterContext.eventSource = filterContext.findNodeByName("DeviceFailureEventType");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("SystemEventType");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("EventQueueOverflowEventType");
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });

    it("EV03- check Where Clause InList OfType", () => {
        const contentFilter = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.InList,

                    filterOperands /* ExtensionObject  [] */: [
                        new SimpleAttributeOperand({
                            attributeId: AttributeIds.Value,
                            browsePath: ["EventType"],
                            typeDefinitionId: resolveNodeId("BaseEventType")
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
        {
            filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.AuditCertificateExpiredEvent");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.AuditHistoryDeleteEvent");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.DeviceFailureEvent");
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("SystemEventType");
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("EventQueueOverflowEventType");
            checkFilter(filterContext, contentFilter).should.eql(false);
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
        {
            filterContext.eventSource = filterContext.findNodeByName("AuditCertificateExpiredEventType");
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            filterContext.eventSource = filterContext.findNodeByName("GeneralModelChangeEventType");
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });

    [
        //                          2 , 10 , 100  compare to 10
        { op: FilterOperator.LessThan, result: [true, false, false] },
        { op: FilterOperator.LessThanOrEqual, result: [true, true, false] },
        { op: FilterOperator.GreaterThan, result: [false, false, true] },
        { op: FilterOperator.GreaterThanOrEqual, result: [false, true, true] },
        { op: FilterOperator.Equals, result: [false, true, false] }
    ].forEach(({ op, result }) =>
        it(`EV05-${op} - check checkFilter with ${FilterOperator[op]} operand`, () => {
            filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode");

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

            {
                setSeverity({ dataType: DataType.UInt16, value: 2.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[0]);
            }
            {
                setSeverity({ dataType: DataType.UInt16, value: 10.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[1]);
            }
            {
                setSeverity({ dataType: DataType.UInt16, value: 100.0 });
                checkFilter(filterContext, contentFilter).should.eql(result[2]);
            }
        })
    );

    it("EV06 - checkFilter with Or operand", () => {
        filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode");

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

        //  Value >= 10.0 OR Value <= 5.0
        {
            setSeverity({ dataType: DataType.UInt16, value: 4.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 5.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 6.0 });
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 9.0 });
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 10.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 11.0 });
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
    });

    it("EV07 - checkFilter with Between operand", () => {
        filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode");

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

        //  true when 5.0 <= Value <= 10.0
        {
            setSeverity({ dataType: DataType.UInt16, value: 4.0 });
            checkFilter(filterContext, whereClause).should.eql(false);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 5.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 6.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 9.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 10.0 });
            checkFilter(filterContext, whereClause).should.eql(true);
        }
        {
            setSeverity({ dataType: DataType.UInt16, value: 11.0 });
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

        {
            setEnabledState(true);
            setAckedState(true);

            checkFilter(filterContext, contentFilter).should.eql(true);
        }
        {
            setEnabledState(false);
            setAckedState(true);
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });

    it("EV09 - checkFilter with (unsupported) Like operand", () => {
        filterContext.eventSource = filterContext.findNodeByName("RootFolder.Objects.Server.VariableWithAlarm.AlarmNode");

        const contentFilter = new ContentFilter({
            elements: [
                {
                    filterOperator: FilterOperator.Like,
                    filterOperands: []
                }
            ]
        });

        {
            checkFilter(filterContext, contentFilter).should.eql(false);
        }
    });
    it("EV10 - checkFilter empty", () => {
        const contentFilter = new ContentFilter({
            elements: null
        });

        {
            checkFilter(filterContext, contentFilter).should.eql(true);
        }
    });

    it("EV11 - checkFilter OfType with Variable", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.eventSource = variableWithAlarm;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
    });

    it("EV12 - checkFilter OfType with Object", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.eventSource = alarmNode;
        checkFilter(filterContext, contentFilter).should.eql(false);
        checkFilter(filterContext, contentFilter2).should.eql(true);
    });

    it("EV13 - checkFilter OfType with DataType", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("Number")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("String")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });

        filterContext.eventSource = filterContext.findNodeByName("UInt16")!;

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV14 - checkFilter OfType with ReferenceType", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("HasChild")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("HasSubtype")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });
        filterContext.eventSource = filterContext.findNodeByName("HasComponent")!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV15 - checkFilter OfType with ObjectType   ", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("NetworkAddressType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("OrderedListType")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseVariableType")]
        });
        filterContext.eventSource = filterContext.findNodeByName("NetworkAddressType")!;

        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV16 - checkFilter OfType with VariableType   ", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });

        const contentFilter2 = new ContentFilter({
            elements: [ofType("PropertyType")]
        });

        const contentFilter3 = new ContentFilter({
            elements: [ofType("BaseObjectType")]
        });
        filterContext.eventSource = filterContext.findNodeByName("CubeItemType")!;
        checkFilter(filterContext, contentFilter).should.eql(true);
        checkFilter(filterContext, contentFilter2).should.eql(false);
        checkFilter(filterContext, contentFilter3).should.eql(false);
    });

    it("EV17 - checkFilter OfType with VariableType - no Root   ", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });
        (filterContext.eventSource as any) = null;
        checkFilter(filterContext, contentFilter).should.eql(false);
    });

    it("EV18 - checkFilter OfType with VariableType - root is Method ( no sense !)   ", () => {
        const contentFilter = new ContentFilter({
            elements: [ofType("DataItemType")]
        });
        filterContext.eventSource = filterContext.findNodeByName("GetMonitoredItems")!;
        checkFilter(filterContext, contentFilter).should.eql(false);
    });
});
