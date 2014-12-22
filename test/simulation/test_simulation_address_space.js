var address_space_for_conformance_testing  = require("../../lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var address_space = require("../../lib/address_space/address_space");
var generate_address_space = require("../../lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = address_space.AddressSpace;
var should  = require("should");
var nodeid = require("../../lib/datamodel/nodeid");
var ReferenceType = address_space.ReferenceType;
var server_engine = require("../../lib/server/server_engine");
var makeNodeId = nodeid.makeNodeId;
var DataType = require("../../lib/datamodel/variant").DataType;
var WriteValue = require("../../lib/services/write_service").WriteValue;

var assert = require("better-assert");

var namespaceIndex = 411; // namespace for conformance testing nodes


describe("testing address space for conformance testing",function() {

    var engine;

    this.timeout(40000);

    beforeEach(function() {

        engine = new server_engine.ServerEngine();
    });
    afterEach(function() {
        engine = null;
    });

    it("should build an address space for conformance testing",function(done) {

        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);
        engine.initialize(null,function(){
            build_address_space_for_conformance_testing(engine);

            // check that AccessLevel_CurrentRead_NotCurrentWrite Int32 can be read but not written


            // change one value
            var Scalar_Static_Int32_NodeId = makeNodeId("Scalar_Static_Int32", namespaceIndex);
            engine.writeSingleNode(new WriteValue({
                nodeId: Scalar_Static_Int32_NodeId,
                attributeId: 13,
                value: {
                    value : {
                        dataType: DataType.Int32,
                        value: 1000
                    }
                }
            }),function(){});


            // address space variable change for conformance testing are changing randomly
            // let wait a little bit to make sure variables have changed at least once
            setTimeout(done,500);
            // done();
        });
    });

    it("should build an address space for conformance testing with options.mass_variables",function(done) {

        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);
        engine.initialize(null,function(){
            build_address_space_for_conformance_testing(engine,{ mass_variables: true});

            // browseName Interval
            // browseName Enabled
            var intervalNodeId = makeNodeId("Scalar_Simulation_Interval", namespaceIndex);
            // change interval to 200 ms
            engine.writeSingleNode(new WriteValue({
                nodeId: intervalNodeId,
                attributeId: 13,
                value: {
                   value : {
                       dataType: DataType.UInt16,
                       value: 250
                   }
                }
            }),function(){});
            // set enable to true
            var enabledNodeId = makeNodeId("Scalar_Simulation_Enabled", namespaceIndex);
            engine.writeSingleNode(new WriteValue({
                nodeId: enabledNodeId,
                attributeId: 13,
                value: {
                    value : {
                        dataType: DataType.Boolean,
                        value: true
                    }
                }
            }),function(){});

            // address space variable change for conformance testing are changing randomly
            // let wait a little bit to make sure variables have changed at least once
            setTimeout(done,500);
            // done();
        });
    });
});
