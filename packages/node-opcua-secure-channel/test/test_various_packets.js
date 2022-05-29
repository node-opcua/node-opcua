const should = require("should");

const packets = require("node-opcua-transport/dist/test-fixtures");
const { BinaryStream } = require("node-opcua-binary-stream");
const { decodeExpandedNodeId } = require("node-opcua-basic-types");
const { analyseExtensionObject } = require("node-opcua-packet-analyzer");

const { MessageBuilder } = require("..");
const { MessageSecurityMode, SecurityPolicy } = require("..");

const full_message_body = require("../test_fixtures/fixture_problematic_ReadResponse.js").packet_ReadResponse;

describe("testing with problematic packet", function () {

    it("should raise a message event after reassembling and decoding a message ", function (done) {

        const messageBuilder = new MessageBuilder();
        messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        let full_message_body_event_received = false;
        let on_message__received = false;

        messageBuilder.
            on("message", function (message) {
                on_message__received = true;
                message.schema.name.should.equal("GetEndpointsResponse");

                on_message__received.should.equal(true);
                full_message_body_event_received.should.equal(true);
                done();

            }).
            on("full_message_body", function (full_message_body) {
                full_message_body_event_received = true;

            }).
            on("error", function (err) {
                should.not.exist(err);
                throw new Error("should not get there");
            });

        messageBuilder.feed(packets.getEndpointsRequest2_chunk1); // GEP response chunk  1
        messageBuilder.feed(packets.getEndpointsRequest2_chunk2); // GEP response chunk  2
    });

    it("should not emit a \"invalid_sequence_number\" event when message have a 1-increased sequence number", function (done) {

        const messageBuilder = new MessageBuilder();

        let messageCount = 0;
        messageBuilder.
            on("message", function (message) {
                messageCount += 1;
                if (messageCount === 2) {
                    done();
                }
            }).
            on("error", function (err) {
                console.log(err);
                throw new Error("should not get there");
            }).
            on("invalid_sequence_number", function (expected, found) {
                throw new Error("should not received a invalid_sequence_number here");
            });


        messageBuilder.feed(packets.openChannelRequest1); // OpenSecureChannelRequest chunk 2
        messageBuilder.feed(packets.getEndpointsRequest1); // OpenSecureChannelRequest chunk 3

    });
    it("should decode this problematic ReadResponse ", function (done) {


        const binaryStream = new BinaryStream(full_message_body);

        // read expandedNodeId:
        const id = decodeExpandedNodeId(binaryStream);

        // this.objectFactory = objectFactory;

        // // construct the object
        // const objMessage = this.objectFactory.constructObject(id);

        // if (!objMessage) {
        //     console.log("cannot construct object with id" + id.toString());
        // }
        // objMessage.constructor.name.should.eql("ReadResponse");


        analyseExtensionObject(full_message_body);

        done();
    });

});
