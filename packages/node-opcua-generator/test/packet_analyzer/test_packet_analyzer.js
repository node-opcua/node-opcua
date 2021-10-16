/* eslint-disable no-undef */
const path = require("path");
const should = require("should");

const { BinaryStream } = require("node-opcua-binary-stream");
const ec = require("node-opcua-basic-types");
const { makeExpandedNodeId } = require("node-opcua-nodeid");
const factories = require("node-opcua-factory");
const { analyseExtensionObject } = require("node-opcua-packet-analyzer");

const generator = require("../..");

const temporary_folder = path.join(__dirname, "../..", "_test_generated");

function initialize() {
    const Person2_Schema = {
        id: factories.next_available_id(),
        name: "Person2",
        fields: [
            { name: "lastName", fieldType: "UAString" },
            { name: "address", fieldType: "UAString" },
            { name: "age", fieldType: "Int32", defaultValue: 25 }
        ]
    };
    exports.Person2_Schema = Person2_Schema;
    const Person2 = generator.registerObject(Person2_Schema, temporary_folder);
}
xdescribe("testing package_analyser", function () {
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
        analyseExtensionObject(stream.buffer);
    });
});
