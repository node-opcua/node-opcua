var should = require("should");


var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var ec = require("node-opcua-basic-types");
var makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;

var generator = require("node-opcua-generator");
var factories = require("node-opcua-factory");

var packet_analyzer = require("..").packet_analyzer;


var path = require("path");
var temporary_folder = path.join(__dirname,"..","_test_generated");

var Person2_Schema = {
    id: factories.next_available_id(),
    name: "Person2",
    fields: [
        {name: "lastName", fieldType: "UAString"},
        {name: "address", fieldType: "UAString"},
        {name: "age", fieldType: "Int32", defaultValue: 25}
    ]
};
exports.Person2_Schema = Person2_Schema;
var Person2 = generator.registerObject(Person2_Schema, temporary_folder);

describe("testing package_analyser", function () {

    it("should analyse a packet ", function () {

        var obj = new Person2({
            lastName: "John",
            address: "Miami"
        });

        var stream = new BinaryStream();

        var expandedNodeId = makeExpandedNodeId(Person2_Schema.id);
        ec.encodeExpandedNodeId(expandedNodeId, stream);
        obj.encode(stream);

        stream.rewind();
        packet_analyzer(stream._buffer);
    });
});

