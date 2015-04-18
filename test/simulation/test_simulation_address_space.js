require("requirish")._(module);

var async = require("async");
var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var address_space = require("lib/address_space/address_space");
var nodeid = require("lib/datamodel/nodeid");
var server_engine = require("lib/server/server_engine");
var makeNodeId = nodeid.makeNodeId;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var WriteValue = require("lib/services/write_service").WriteValue;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var ReadValueId = require("lib/services/read_service").ReadValueId;

var should = require("should");
var assert = require("better-assert");

var namespaceIndex = 411; // namespace for conformance testing nodes


describe("testing address space for conformance testing", function () {

    var engine;

    this.timeout(140000); // very large time out to cope with heavy loaded vms on CI.

    before(function (done) {

        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            build_address_space_for_conformance_testing(engine, {mass_variables: true});

            // address space variable change for conformance testing are changing randomly
            // let wait a little bit to make sure variables have changed at least once
            setTimeout(done, 500);
        });
    });
    after(function () {
        engine = null;
    });

    it("should check that AccessLevel_CurrentRead_NotCurrentWrite Int32 can be read but not written", function (done) {

        var nodeId = makeNodeId("AccessLevel_CurrentRead_NotCurrentWrite", namespaceIndex);
        var value = engine.readSingleNode(nodeId, AttributeIds.Value);

        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Int32);
        value.value.arrayType.should.eql(VariantArrayType.Scalar);
        value.value.value.should.eql(36);

        // now write it again
        var writeValue = new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType: DataType.Int32,
                    value: 1000
                }
            }
        });
        engine.writeSingleNode(writeValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.BadNotWritable, " writing on AccessLevel_CurrentRead_NotCurrentWrite should raise BadNotWritable ");
            done(err);
        });


    });

    it("should be able to write a array of double on Scalar_Static_Array_Double", function (done) {

        var nodeId = makeNodeId("Scalar_Static_Array_Double", namespaceIndex);
        var value = engine.readSingleNode(nodeId, AttributeIds.Value);

        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Double);
        value.value.arrayType.should.eql(VariantArrayType.Array);
        value.value.value.length.should.eql(10);

        // now write it again
        var writeValue = new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Array,
                    value: [10, 20, 30, 40, 50]
                }
            }
        });
        engine.writeSingleNode(writeValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });

    });


    it("should write a scalar Int32 value to the  Scalar_Static_Int32_NodeId node", function (done) {

        // change one value
        var nodeId = makeNodeId("Scalar_Static_Int32", namespaceIndex);

        var writeValue = new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType: DataType.Int32,
                    value: 1000
                }
            }
        });
        engine.writeSingleNode(writeValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });

    });

    it("should build an address space for conformance testing with options.mass_variables", function (done) {


        async.series([
            function (callback) {
                // browseName Interval
                // browseName Enabled
                var intervalNodeId = makeNodeId("Scalar_Simulation_Interval", namespaceIndex);
                // change interval to 200 ms

                var writeValue = new WriteValue({
                    nodeId: intervalNodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        value: {
                            dataType: DataType.UInt16,
                            value: 250
                        }
                    }
                });

                engine.writeSingleNode(writeValue, function (err, statusCode) {
                    callback(err);
                });
            },
            function (callback) {

                // set enable to true
                var enabledNodeId = makeNodeId("Scalar_Simulation_Enabled", namespaceIndex);

                var writeValue = new WriteValue({
                    nodeId: enabledNodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        value: {
                            dataType: DataType.Boolean,
                            value: true
                        }
                    }
                });

                engine.writeSingleNode(writeValue, function (err, statusCode) {
                    callback(err);
                });
            }
        ], done);


    });

    function writeValue(nodeId, dataType, value, callback) {

        var request = new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType: dataType,
                    value: value
                }
            }
        });

        engine.writeSingleNode(request, function (err, statusCode) {
            callback(err);
        });
    }

    function readValue(nodeId, callback) {
        var request = new ReadValueId({
            nodeId: nodeId,
            attributeId: AttributeIds.Value
        });
        var dataValue = engine._readSingleNode(request);
        callback(null, dataValue.value.value);

    }

    it(" should write a new value on Scalar_Static_Int16 and check with read", function (done) {

        var nodeId = makeNodeId("Scalar_Static_Int16", namespaceIndex);

        var l_value = 555;
        async.series([


            function (callback) {
                readValue(nodeId, function (err, value) {
                    l_value = value;
                    l_value.should.eql(0);
                    callback(err);
                });
            },
            function (callback) {
                l_value.should.eql(0);
                writeValue(nodeId, DataType.Int16, l_value + 100, function (err, statusCode) {
                    callback(err);
                });
            },
            function (callback) {
                readValue(nodeId, function (err, value) {
                    value.should.eql(l_value + 100);
                    callback(err);
                });
            }
        ], done);
    });


});
