var assert = require("assert");
var factories = require("../misc/factories");
var opcua = require("../../");
var AddressSpace = require("./address_space").AddressSpace;

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
exports.makeEnumeration =makeEnumeration;

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


        var dataType = address_space.findObject(dataTypeId);
        if (!dataType) {
            throw new Error(" cannot find description for object " + dataTypeId.toString() +
                            ". Check that this node exists in the nodeset.xml file");
        }
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
exports.makeStructure = makeStructure;



var nodeset = exports.nodeset = {
    ServerState: null,
    ServerStatus : null
};

var makeServerStatus = function(address_space) {

    assert(address_space instanceof AddressSpace);

    var makeEnumeration = require("../address_space/convert_nodeset_to_types").makeEnumeration;
    var makeStructure = require("../address_space/convert_nodeset_to_types").makeStructure;

    if (!nodeset.ServerState)   {

        var dataType = address_space.findDataType("ServerState");
        assert(dataType);

        var superType = address_space.findObject(dataType.subTypeOf);
        assert(superType.browseName  === "Enumeration");

        var ServerState = makeEnumeration(dataType);
        nodeset.ServerState = ServerState;
        console.log("Setting ServerState ",exports.ServerState)  ;
    }

    if (!nodeset.ServerStatus){
        var dataType = address_space.findDataType("ServerStatusDataType");
        assert(dataType);


        var superType = address_space.findObject(dataType.subTypeOf);
        assert(superType.browseName ==="Structure");

        var ServerStatus = makeStructure(dataType);
        nodeset.ServerStatus = ServerStatus;

    }

};
exports.makeServerStatus =  makeServerStatus;