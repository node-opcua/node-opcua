var should = require("should");

var MessageBuilder = require("../src/message_builder").MessageBuilder;


var packets = require("node-opcua-transport/test-fixtures/fixture_full_tcp_packets");

var redirectToFile = require("node-opcua-debug").redirectToFile;
var debugLog = require("node-opcua-debug").make_debugLog(__filename);


describe("MessageBuilder", function () {


    it('should raise a error event if a HEL or ACK packet is fed instead of a MSG packet ', function (done) {

        var messageBuilder = new MessageBuilder();

        var full_message_body_event_received = false;
        var on_message__received = false;

        messageBuilder.
            on("message", function (message) {
                on_message__received = true;

            }).
            on("full_message_body", function (full_message_body) {
                full_message_body_event_received = true;

            }).
            on("error", function (err) {
                err.should.be.instanceOf(Error);
                on_message__received.should.equal(false);
                full_message_body_event_received.should.equal(true);
                done();

            });

        messageBuilder.feed(packets.packet_cs_1); // HEL message
    });


    /**
     *  utility test function that verifies that the messageBuilder sends
     *  a error event, without crashing when a bad packet is processed.
     * @param test_case_name
     * @param bad_packet
     * @param done
     */
    function test_behavior_with_bad_packet(test_case_name, bad_packet, done) {

        redirectToFile("MessageBuilder_" + test_case_name + ".log", function () {

            var messageBuilder = new MessageBuilder();

            var full_message_body_event_received = false;
            var on_message__received = false;

            messageBuilder.
                on("message", function (message) {
                    on_message__received = true;

                }).
                on("full_message_body", function (full_message_body) {
                    full_message_body_event_received = true;

                }).
                on("error", function (err) {
                    err.should.be.instanceOf(Error);
                    on_message__received.should.equal(false);
                    full_message_body_event_received.should.equal(true);
                    done();
                });


            messageBuilder.feed(bad_packet); // OpenSecureChannel message
        }, function () {
        });

    }

    it('should raise an error if the embedded object id is not known', function (done) {

        var bad_packet = new Buffer(packets.packet_cs_2);

        // alter the packet id to scrap the message ID
        // this will cause the message builder not to find the embedded object constructor.
        bad_packet.writeUInt8(255, 80);
        bad_packet.writeUInt8(255, 81);
        bad_packet.writeUInt8(255, 82);

        test_behavior_with_bad_packet("bad_object_id_error", bad_packet, done);

    });

    it('should raise an error if the embedded object failed to be decoded', function (done) {

        var bad_packet = new Buffer(packets.packet_cs_2);

        // alter the packet id  to scrap the inner data
        // this will cause the decode function to fail and raise an exception
        bad_packet.writeUInt8(10, 0x65);
        bad_packet.writeUInt8(11, 0x66);
        bad_packet.writeUInt8(255, 0x67);

        test_behavior_with_bad_packet("corrupted_message_error", bad_packet, done);
    });


    it("should emit a 'invalid_sequence_number' event if a message does not have a 1-increased sequence number", function (done) {

        var messageBuilder = new MessageBuilder();

        messageBuilder.
            on("message", function (message) {
            }).
            on("error", function (err) {
                console.log(err);

                throw new Error("should not get there");
            }).
            on("invalid_sequence_number", function (expected, found) {
                //xx console.log("expected ",expected);
                //xx console.log("found",found);
                done();
            });


        messageBuilder.feed(packets.packet_cs_2);
        messageBuilder.feed(packets.packet_cs_2);


    });

});

