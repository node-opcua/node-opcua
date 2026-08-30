import { AttributeIds } from "node-opcua-data-model";
import { NumericRange } from "node-opcua-numeric-range";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { MonitoringParameters } from "node-opcua-types";
import should from "should";
import { AttributeOperand, ElementOperand, EventFilter, FilterOperator } from "..";

describe("Filter Service", () => {
    it("should create a EventFilter", () => {
        new EventFilter({});
    });
    it("should encode and decode a MonitoringParameters with EventFilter filter", (done) => {
        const obj = new MonitoringParameters({
            samplingInterval: 10,
            discardOldest: true,
            queueSize: 10,
            filter: new EventFilter({
                selectClauses: [
                    // SimpleAttributeOperand
                    {
                        typeDefinitionId: "i=123", // NodeId

                        browsePath: [
                            // QualifiedName
                            { namespaceIndex: 1, name: "A" },
                            { namespaceIndex: 1, name: "B" },
                            {
                                namespaceIndex: 1,
                                name: "C"
                            }
                        ],
                        attributeId: AttributeIds.Value,
                        indexRange: new NumericRange()
                    },
                    {
                        // etc...
                    },
                    {
                        // etc...
                    }
                ],
                whereClause: {
                    //ContentFilter
                    elements: [
                        // ContentFilterElement
                        {
                            filterOperator: FilterOperator.InList,
                            filterOperands: [
                                //
                                new ElementOperand({
                                    index: 123
                                }),
                                new AttributeOperand({
                                    nodeId: "i=10",
                                    alias: "someText",
                                    browsePath: {
                                        //RelativePath
                                    },
                                    attributeId: AttributeIds.Value
                                })
                            ]
                        }
                    ]
                }
            })
        });
        // the round-trip helper returns the base type; this test built a MonitoringParameters
        const obj_reloaded = encode_decode_round_trip_test(obj) as MonitoringParameters;

        const filter = obj_reloaded.filter as EventFilter;
        should(filter.selectClauses?.length).eql(3);
        should(filter.whereClause?.elements?.length).eql(1);

        const operand = filter.whereClause?.elements?.[0]?.filterOperands?.[1] as AttributeOperand | undefined;
        should(operand?.attributeId).eql(AttributeIds.Value);

        done();
    });
});
