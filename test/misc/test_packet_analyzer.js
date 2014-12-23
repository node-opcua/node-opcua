var packet_analyzer = require("../../lib/misc/packet_analyzer").packet_analyzer;
var factories = require("../../lib/misc/factories");
var should = require("should");
var BinaryStream =require("../../lib/misc/binaryStream").BinaryStream;
var ec = require("../../lib/misc/encode_decode");
var makeExpandedNodeId = require("../../lib/datamodel/expanded_nodeid").makeExpandedNodeId;

var Person2_Schema = {
    id: factories.next_available_id(),
    name: "Person2",
    fields: [
        { name: "lastName" , fieldType: "UAString" },
        { name: "address"  , fieldType: "UAString" },
        { name: "age"      , fieldType: "Int32"  , defaultValue:  25  }
    ]
};
exports.Person2_Schema = Person2_Schema;
var Person2   = factories.registerObject(Person2_Schema,"tmp");

describe("testing package_analyser",function(){


    it("should analyse a packet ",function(){

        var obj = new Person2({
            lastName: "John",
            address: "Miami"
        });

        var stream = new BinaryStream();

        var expandedNodeId = makeExpandedNodeId(Person2_Schema.id);
        ec.encodeExpandedNodeId(expandedNodeId,stream);
        obj.encode(stream);

        stream.rewind();

        packet_analyzer(stream._buffer);

    });

});

