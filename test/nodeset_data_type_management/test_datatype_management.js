
var opcua = require("../../");
var AddressSpace = opcua.AddressSpace;
var should = require("should");

var factories = require("../../lib/misc/factories");
var _ = require("underscore");

var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;



var nodeset = require("../../lib/address_space/convert_nodeset_to_types").nodeset;
var makeServerStatus = require("../../lib/address_space/convert_nodeset_to_types").makeServerStatus;


describe("ComplexType read from XML NodeSET file shall be binary Encodable",function(){


    var address_space ;

    before(function(done){
        address_space = new AddressSpace();

        var xml_file = __dirname + "/../fixtures/fixture_nodeset_enumtype.xml";
        require("fs").existsSync(xml_file).should.be.eql(true);

        opcua.generate_address_space(address_space,xml_file,function(err) {
            makeServerStatus(address_space);
            done(err);
        });
    });

    it("should create an enumeration from the  ServerState object",function(done){


        var test_value = nodeset.ServerState.NoConfiguration;

        test_value.value.should.eql(2);
        done();

    });
    it("should create an structure from the ServerStatus object",function(done){



        var serverStatus = new nodeset.ServerStatus({
            startTime: new Date(),
            buildInfo : {
               // productUri: "qsdqs",
                // manufacturerName: "sqdqsd"

            },
            secondsTillShutdown: 100,
            shutdownReason:{ text: "for maintenance"}
        });

        assert(serverStatus._schema.name === "ServerStatus");
        serverStatus.startTime.should.be.instanceOf(Date);
        serverStatus.secondsTillShutdown.should.eql(100);

        encode_decode_round_trip_test(serverStatus);

        done();
    });
});
