"use strict";
/* based on  AttributeWriteValue test7
   Write a ByteString value to a node of type Byte[].
*/

var async = require("async");
var should = require("should");
var opcua = require("node-opcua");
var _ = require("underscore");

var OPCUAClient = opcua.OPCUAClient;

var perform_operation_on_subscription = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_subscription;

module.exports = function (test) {

    describe("Testing ctt  - write a ByteString value to a node of type Byte[]", function () {

        it("should write a ByteString value into a node  of type Byte[]",function(done) {
            var client = new OPCUAClient();
            var endpointUrl = test.endpointUrl;

            var nodeToRead = {
                nodeId: "ns=411;s=Scalar_Static_Array_Byte",
                attributeId: 13
            };

            perform_operation_on_subscription(client,endpointUrl,function(session,subscription,inner_done){

                var l = 0;
                async.series([
                    function read_initial_value(callback) {

                        session.read([nodeToRead],function(err,unused,results){
                            //xx console.log(results[0].toString());
                            results[0].value.value.length.should.be.greaterThan(2);
                            l = results[0].value.value.length;
                            callback();
                        })
                    },
                    function write_byteString_in_arrayOfByte(callback) {

                        var nodeToWrite= {
                            nodeId:"ns=411;s=Scalar_Static_Array_Byte",
                            attributeId: 13,
                            value: {
                                value: {
                                    dataType: opcua.DataType.ByteString,
                                    arrayType: opcua.VariantArrayType.Scalar,
                                    value: new Buffer([l,2,3,88])
                                }
                            }
                        };
                        session.write([nodeToWrite],function(err,results) {
                            if(err) { return callback(err);}
                            //xx console.log(results[0].toString());
                            results[0].should.not.eql(opcua.StatusCodes.BadTypeMismatch);
                            results[0].should.eql(opcua.StatusCodes.Good);
                            callback(err);
                        });
                    }
                ],inner_done);
            },done);

        });
    });
};