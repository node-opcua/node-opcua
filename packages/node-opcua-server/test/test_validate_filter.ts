import "should";
import type { BaseNode } from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import {
    ContentFilter,
    ElementOperand,
    EventFilter,
    FilterOperator,
    ofType,
    SimpleAttributeOperand
} from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";

import { defaultServerCapabilities } from "../source/server_capabilities.js";
import { validateFilter } from "../source/validate_filter.js";

// The EventFilter branch of validateFilter does not dereference the node, so a stub is sufficient.
const dummyNode = {} as BaseNode;
const onEventNotifier: ReadValueIdOptions = { attributeId: AttributeIds.EventNotifier };

describe("validateFilter - EventFilter whereClause conformance (OPC UA Part 4 - 7.7)", () => {
    it("VF01 - accepts an EventFilter with no whereClause", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: undefined });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF02 - accepts an EventFilter with an empty whereClause", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: new ContentFilter({ elements: [] }) });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF03 - accepts an EventFilter with a valid forward ElementOperand reference", () => {
        // element 0 : Not(ElementOperand(1)) ; element 1 : Not(ElementOperand(2)) ; element 2 : OfType leaf
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    ofType("BaseEventType")
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF03b - accepts an acyclic whereClause whose references are not strictly forward-ordered", () => {
        // element 0 : Not(ElementOperand(2)) ; element 1 : OfType leaf ; element 2 : Not(ElementOperand(1)) (backward but acyclic)
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    ofType("BaseEventType"),
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF03c - ignores an unreachable element (cannot be traced back to the starting element) - Part 4 7.7.1", () => {
        // element 0 : OfType leaf (the whole reachable filter)
        // elements 1,2 : an unreachable cycle 1 -> 2 -> 1 that must be ignored, not rejected
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    ofType("BaseEventType"),
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF04 - rejects a self-referential whereClause with BadFilterElementInvalid", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 0 })] }]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadFilterElementInvalid);
    });

    it("VF05 - rejects a cyclic whereClause (0 -> 1 -> 0) with BadFilterElementInvalid", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 0 })] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadFilterElementInvalid);
    });

    it("VF06 - rejects an out-of-bounds ElementOperand reference with BadFilterElementInvalid", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 99 })] }]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadFilterElementInvalid);
    });

    it("VF07 - rejects an operator with the wrong number of operands with BadFilterOperandCountMismatch - Part 4 Table 118", () => {
        // Not expects exactly 1 operand; provide 2.
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    {
                        filterOperator: FilterOperator.Not,
                        filterOperands: [new ElementOperand({ index: 1 }), new ElementOperand({ index: 1 })]
                    },
                    ofType("BaseEventType")
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadFilterOperandCountMismatch);
    });

    it("VF08 - rejects a whereClause exceeding maxWhereClauseParameters", () => {
        // 3 operands total across the three elements (1 + 1 + 1).
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    ofType("BaseEventType")
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode, { maxWhereClauseParameters: 2 }).should.eql(
            StatusCodes.BadEventFilterInvalid
        );
        validateFilter(filter, onEventNotifier, dummyNode, { maxWhereClauseParameters: 3 }).should.eql(StatusCodes.Good);
    });

    it("VF09 - rejects an EventFilter exceeding maxSelectClauseParameters", () => {
        const selectClauses = [
            new SimpleAttributeOperand({ attributeId: AttributeIds.Value, browsePath: ["EventType"] }),
            new SimpleAttributeOperand({ attributeId: AttributeIds.Value, browsePath: ["SourceNode"] })
        ];
        const filter = new EventFilter({ selectClauses, whereClause: new ContentFilter({ elements: [] }) });
        validateFilter(filter, onEventNotifier, dummyNode, { maxSelectClauseParameters: 1 }).should.eql(
            StatusCodes.BadEventFilterInvalid
        );
        validateFilter(filter, onEventNotifier, dummyNode, { maxSelectClauseParameters: 2 }).should.eql(StatusCodes.Good);
    });

    // The ConditionId operand of an alarm collector: the NodeId attribute of the ConditionType instance itself.
    const conditionIdOperand = () =>
        new SimpleAttributeOperand({
            typeDefinitionId: resolveNodeId("ConditionType"),
            browsePath: [],
            attributeId: AttributeIds.NodeId
        });

    // The filter the OPC Foundation CTT's alarm collector creates on the Server object (captured on the
    // wire): every event field of every standard condition type the server advertises, 148 of them, each
    // on BaseEventType with one browse path, plus the ConditionId operand; and a where clause of one
    // InList over ConditionId with no list yet (the collector fills it with ModifyMonitoredItems).
    function alarmCollectorFilter(): EventFilter {
        const selectClauses: SimpleAttributeOperand[] = [];
        for (let i = 0; i < 148; i++) {
            selectClauses.push(
                new SimpleAttributeOperand({
                    typeDefinitionId: resolveNodeId("BaseEventType"),
                    browsePath: [`Field${i}`],
                    attributeId: AttributeIds.Value
                })
            );
        }
        selectClauses.push(conditionIdOperand());
        return new EventFilter({
            selectClauses,
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.InList, filterOperands: [conditionIdOperand()] }]
            })
        });
    }

    it("VF11 - the default server capabilities accept the 149 select clauses an alarm collector sends", () => {
        const filter = alarmCollectorFilter();
        (filter.selectClauses || []).length.should.eql(149);
        const defaults = {
            maxSelectClauseParameters: defaultServerCapabilities.maxSelectClauseParameters,
            maxWhereClauseParameters: defaultServerCapabilities.maxWhereClauseParameters
        };
        validateFilter(filter, onEventNotifier, dummyNode, defaults).should.eql(StatusCodes.Good);
        // the previous default, 100, is what refused it: Part 5 leaves the value to the server, and any
        // server exposing the standard alarm types receives more than that from a client selecting every field
        validateFilter(filter, onEventNotifier, dummyNode, { maxSelectClauseParameters: 100 }).should.eql(
            StatusCodes.BadEventFilterInvalid
        );
    });

    it("VF12 - accepts an InList with only its left operand: Part 4 7.7.4 makes it FALSE, not malformed", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.InList, filterOperands: [conditionIdOperand()] }]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF13 - still rejects an InList with no operand at all with BadFilterOperandCountMismatch", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({ elements: [{ filterOperator: FilterOperator.InList, filterOperands: [] }] })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadFilterOperandCountMismatch);
    });

    it("VF10 - still rejects an EventFilter applied to a non-EventNotifier attribute", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: new ContentFilter({ elements: [] }) });
        validateFilter(filter, { attributeId: AttributeIds.Value }, dummyNode).should.eql(StatusCodes.BadFilterNotAllowed);
    });
});
