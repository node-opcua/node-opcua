import "should";
import type { BaseNode } from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-data-model";
import { ContentFilter, ElementOperand, EventFilter, FilterOperator } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";

import { validateFilter } from "../source/validate_filter";

// The EventFilter branch of validateFilter does not dereference the node, so a stub is sufficient.
const dummyNode = {} as BaseNode;
const onEventNotifier: ReadValueIdOptions = { attributeId: AttributeIds.EventNotifier };

describe("validateFilter - EventFilter whereClause conformance (OPC UA Part 4 - 7.4.4.4)", () => {
    it("VF01 - accepts an EventFilter with no whereClause", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: undefined });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF02 - accepts an EventFilter with an empty whereClause", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: new ContentFilter({ elements: [] }) });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF03 - accepts an EventFilter with a valid forward ElementOperand reference", () => {
        // element 0 : Not(ElementOperand(1)) ; element 1 : Not(ElementOperand(2)) ; element 2 : leaf
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    { filterOperator: FilterOperator.OfType, filterOperands: [] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF03b - accepts an acyclic whereClause whose references are not strictly forward-ordered", () => {
        // element 0 : Not(ElementOperand(2)) ; element 1 : leaf ; element 2 : Not(ElementOperand(1)) (backward but acyclic)
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 2 })] },
                    { filterOperator: FilterOperator.OfType, filterOperands: [] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.Good);
    });

    it("VF04 - rejects an EventFilter with a self-referential whereClause", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 0 })] }]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadEventFilterInvalid);
    });

    it("VF05 - rejects an EventFilter with a cyclic whereClause (0 -> 1 -> 0)", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 1 })] },
                    { filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 0 })] }
                ]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadEventFilterInvalid);
    });

    it("VF06 - rejects an EventFilter with an out-of-bounds ElementOperand reference", () => {
        const filter = new EventFilter({
            selectClauses: [],
            whereClause: new ContentFilter({
                elements: [{ filterOperator: FilterOperator.Not, filterOperands: [new ElementOperand({ index: 99 })] }]
            })
        });
        validateFilter(filter, onEventNotifier, dummyNode).should.eql(StatusCodes.BadEventFilterInvalid);
    });

    it("VF07 - still rejects an EventFilter applied to a non-EventNotifier attribute", () => {
        const filter = new EventFilter({ selectClauses: [], whereClause: new ContentFilter({ elements: [] }) });
        validateFilter(filter, { attributeId: AttributeIds.Value }, dummyNode).should.eql(StatusCodes.BadFilterNotAllowed);
    });
});
