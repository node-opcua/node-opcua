require("requirish")._(module);
var address_space_for_conformance_testing  = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var address_space = require("lib/address_space/address_space");
var nodeid = require("lib/datamodel/nodeid");
var server_engine = require("lib/server/server_engine");
var makeNodeId = nodeid.makeNodeId;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var WriteValue = require("lib/services/write_service").WriteValue;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var StatusCodes  = require("lib/datamodel/opcua_status_code").StatusCodes;

var should  = require("should");
var assert = require("better-assert");

var namespaceIndex = 411; // namespace for conformance testing nodes


describe("testing address space for conformance testing",function() {

    var engine;

    this.timeout(40000);

    before(function(done) {

        engine = new server_engine.ServerEngine();
        engine.initialize(null,function() {
            build_address_space_for_conformance_testing(engine,{ mass_variables: true});

            // address space variable change for conformance testing are changing randomly
            // let wait a little bit to make sure variables have changed at least once
            setTimeout(done,500);
        });
    });
    after(function() {
        engine = null;
    });

    it("should check that AccessLevel_CurrentRead_NotCurrentWrite Int32 can be read but not written",function() {

        var nodeId = makeNodeId("AccessLevel_CurrentRead_NotCurrentWrite", namespaceIndex);
        var value = engine.readSingleNode(nodeId,AttributeIds.Value);

        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Int32);
        value.value.arrayType.should.eql(VariantArrayType.Scalar);
        value.value.value.should.eql(36);

        // now write it again
        var result = engine.writeSingleNode(new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value : {
                    dataType: DataType.Int32,
                    value: 1000
                }
            }
        }));

        result.should.eql(StatusCodes.BadNotWritable , " writing on AccessLevel_CurrentRead_NotCurrentWrite should raise BadNotWritable ");

    });

    it("should be able to write a array of double on Scalar_Static_Array_Double",function() {

        var nodeId = makeNodeId("Scalar_Static_Array_Double", namespaceIndex);
        var value = engine.readSingleNode(nodeId,AttributeIds.Value);

        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Double);
        value.value.arrayType.should.eql(VariantArrayType.Array);
        value.value.value.length.should.eql(10);

        // now write it again
        var result = engine.writeSingleNode(new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value : {
                    dataType: DataType.Double,
                    arrayType: VariantArrayType.Array,
                    value: [10,20,30,40,50]
                }
            }
        }));

        result.should.eql(StatusCodes.Good);

    });


    it("should write a scalar Int32 value to the  Scalar_Static_Int32_NodeId node",function() {

        // change one value
        var nodeId = makeNodeId("Scalar_Static_Int32", namespaceIndex);

        engine.writeSingleNode(new WriteValue({
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: {
                value : {
                    dataType: DataType.Int32,
                    value: 1000
                }
            }
        }));

    });

    it("should build an address space for conformance testing with options.mass_variables",function() {



        // browseName Interval
        // browseName Enabled
        var intervalNodeId = makeNodeId("Scalar_Simulation_Interval", namespaceIndex);
        // change interval to 200 ms
        engine.writeSingleNode(new WriteValue({
            nodeId: intervalNodeId,
            attributeId: AttributeIds.Value,
            value: {
               value : {
                   dataType: DataType.UInt16,
                   value: 250
               }
            }
        }));
        // set enable to true
        var enabledNodeId = makeNodeId("Scalar_Simulation_Enabled", namespaceIndex);
        engine.writeSingleNode(new WriteValue({
            nodeId: enabledNodeId,
            attributeId: AttributeIds.Value,
            value: {
                value : {
                    dataType: DataType.Boolean,
                    value: true
                }
            }
        }));

    });
});
