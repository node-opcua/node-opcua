const should = require("should");


const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const ec = require("node-opcua-basic-types");
const makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;

const generator = require("../..");
const factories = require("node-opcua-factory");

const packet_analyzer = require("node-opcua-packet-analyzer").packet_analyzer;


const path = require("path");
const temporary_folder = path.join(__dirname,"../..","_test_generated");

const Person2_Schema = {
    id: factories.next_available_id(),
    name: "Person2",
    fields: [
        {name: "lastName", fieldType: "UAString"},
        {name: "address", fieldType: "UAString"},
        {name: "age", fieldType: "Int32", defaultValue: 25}
    ]
};
exports.Person2_Schema = Person2_Schema;
const Person2 = generator.registerObject(Person2_Schema, temporary_folder);

describe("testing package_analyser", function () {

    it("should analyse a packet ", function () {

        const obj = new Person2({
            lastName: "John",
            address: "Miami"
        });

        const stream = new BinaryStream();

        const expandedNodeId = makeExpandedNodeId(Person2_Schema.id);
        ec.encodeExpandedNodeId(expandedNodeId, stream);
        obj.encode(stream);

        stream.rewind();
        packet_analyzer(stream._buffer);
    });
});

