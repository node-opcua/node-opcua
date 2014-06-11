var address_space_for_conformance_testing  = require("../../lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var address_space = require("../../lib/address_space/address_space");
var generate_address_space = require("../../lib/address_space/load_nodeset2").generate_address_space;
var AddressSpace = address_space.AddressSpace;
var should  = require("should");
var nodeid = require("../../lib/datamodel/nodeid");
var ReferenceType = address_space.ReferenceType;
var server_engine = require("../../lib/server/server_engine");


var assert = require("better-assert");


describe("testing address space for conformance testing",function() {

    var engine;

    beforeEach(function() {

        engine = new server_engine.ServerEngine();
    });

    it("should build",function(done) {

        var xml_file = __dirname + "/../../lib/server/mini.Node.Set2.xml";

        require("fs").existsSync(xml_file).should.be.eql(true);
        engine.initialize(null,function(){
            build_address_space_for_conformance_testing(engine);

            setTimeout(done,500);
            // done();
        });
    });

});
