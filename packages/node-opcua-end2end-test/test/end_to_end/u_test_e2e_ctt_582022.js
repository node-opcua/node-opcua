"use strict";
/* based on  AttributeWriteValue test7
   Write a ByteString value to a node of type Byte[].
*/

const async = require("async");
const should = require("should");
const opcua = require("node-opcua");

const {
    OPCUAClient,
    makeNodeId,
    coerceNodeId,
    AttributeIds,
} = require("node-opcua");

const { perform_operation_on_subscription } = require("../../test_helpers/perform_operation_on_client_session");

module.exports = function(test) {


    describe("Testing ctt  - write a ByteString value to a node of type Byte[]", function() {


        it("should write a ByteString value into a node  of type Byte[]", function(done) {

            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            let simulationNamespaceIndex = -1;

            perform_operation_on_subscription(client, endpointUrl, function(session, subscription, inner_done) {

                let l = 0;
                async.series([

                    function read_namespaceArray(callback) {

                        session.readNamespaceArray(function(err, namespaceArray) {
                            if (err) return callback(err);
                            simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");
                            console.log("simulationNamespaceIndex = ", simulationNamespaceIndex);
                            callback();
                        });
                    },
                    function read_initial_value(callback) {

                        const nodeToRead = {
                            nodeId: coerceNodeId("s=Scalar_Static_Array_Byte", simulationNamespaceIndex),
                            attributeId: AttributeIds.Value
                        };

                        session.read(nodeToRead, function(err, dataValue) {
                            if (err) return callback(err);
                            if (dataValue.statusCode !== opcua.StatusCodes.Good) {
                                return callback(new Error("Cannot read value" + dataValue.toString()))
                            }
                            //xx console.log(results[0].toString());
                            dataValue.value.value.length.should.be.greaterThan(2);
                            l = dataValue.value.value.length;
                            callback();
                        })
                    },
                    function write_byteString_in_arrayOfByte(callback) {

                        const nodeToWrite = {
                            nodeId: coerceNodeId("s=Scalar_Static_Array_Byte", simulationNamespaceIndex),
                            attributeId: AttributeIds.Value,
                            value: {
                                value: {
                                    dataType: opcua.DataType.ByteString,
                                    arrayType: opcua.VariantArrayType.Scalar,
                                    value: Buffer.from([l, 2, 3, 88])
                                }
                            }
                        };
                        session.write([nodeToWrite], function(err, results) {
                            if (err) { return callback(err); }
                            //xx console.log(results[0].toString());
                            results[0].should.not.eql(opcua.StatusCodes.BadTypeMismatch);
                            results[0].should.eql(opcua.StatusCodes.Good);
                            callback(err);
                        });
                    }
                ], inner_done);
            }, done);

        });
    });
};