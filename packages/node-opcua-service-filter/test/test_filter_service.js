const { MonitoringParameters } = require("node-opcua-types");
const { AttributeIds } = require("node-opcua-data-model");
const { NumericRange } = require("node-opcua-numeric-range");
const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");
const { EventFilter, FilterOperator, ElementOperand, AttributeOperand } = require("..");



describe("Filter Service", function () {
    it("should create a EventFilter", function () {
        new EventFilter({});
    });
    it("should encode and decode a MonitoringParameters with EventFilter filter", function (done) {
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
        const obj_reloaded = encode_decode_round_trip_test(obj);

        obj_reloaded.filter.selectClauses.length.should.eql(3);
        obj_reloaded.filter.whereClause.elements.length.should.eql(1);

        obj_reloaded.filter.whereClause.elements[0].filterOperands[1].attributeId.should.eql(AttributeIds.Value);

        done();
    });
});
