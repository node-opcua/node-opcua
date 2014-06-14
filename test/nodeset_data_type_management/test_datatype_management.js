
var opcua = require("../../");
var AddressSpace = opcua.AddressSpace;
var should = require("should");

var factories = require("../../lib/misc/factories");
var _ = require("underscore");

var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

function makeEnumeration(dataType) {

    assert(dataType);
    assert(dataType.hasOwnProperty("browseName"));
    assert(_.isArray(dataType.definition));


    var Enumeration_Schema = {
        id: dataType.nodeId,
        name: dataType.browseName,
        enumValues: {}
    };

    dataType.definition.forEach(function(pair){
        Enumeration_Schema.enumValues[pair.name] = pair.value;
    });

    //xx console.log(JSON.stringify(Enumeration_Schema,null," "));
    return factories.registerEnumeration(Enumeration_Schema);
}

function lowerFirstLetter(str){
      return str.substr(0,1).toLowerCase()+ str.substr(1);
}
function makeStructure(dataType) {

    var address_space = dataType.__address_space;

    assert(address_space.constructor.name === "AddressSpace");

    var name = dataType.browseName;
    assert(name.substr(-8) === "DataType");

    name = name.substring(0,name.length-8);
    // remove
    var schema = {
        id: dataType.nodeId,
        name: name,
        fields: [
            // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
        ]
    };

    // construct the fields
    dataType.definition.forEach(function(pair){

        var dataTypeId = opcua.resolveNodeId(pair.dataType);

        //xx console.log("dataTypeid ",pair.name, dataTypeId.toString(address_space));

        var dataType = address_space.findObject(dataTypeId);
        var dataTypeName = dataType.browseName;
        schema.fields.push({
            name: lowerFirstLetter(pair.name),
            fieldType: dataTypeName,
            isArray: false,
            description: "some description here"
        });
    });

    return factories.registerObject(schema);
}

describe("ComplexType read from XML NodeSET file shall be binary Encodable",function(){


    var address_space ;

    before(function(done){
        address_space = new AddressSpace();

        var xml_file = __dirname + "/../fixtures/fixture_nodeset_enumtype.xml";
        require("fs").existsSync(xml_file).should.be.eql(true);

        opcua.generate_address_space(address_space,xml_file,function(err) {
            done(err);
        });
    });

    it("should create an enumeration from the  ServerState object",function(done){

        var dataType = address_space.findDataType("ServerState");
        assert(dataType);

        var superType = address_space.findObject(dataType.subTypeOf);
        superType.browseName.should.eql("Enumeration");

        var the_enum = makeEnumeration(dataType);
        var test_value = the_enum.NoConfiguration;

        test_value.value.should.eql(2);
        done();

    });
    it("should create an structure from the ServerStatus object",function(done){

        var dataType = address_space.findDataType("ServerStatusDataType");
        assert(dataType);

        var superType = address_space.findObject(dataType.subTypeOf);
        superType.browseName.should.eql("Structure");

        var ServerStatus = makeStructure(dataType);


        var serverStatus = new ServerStatus({
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
