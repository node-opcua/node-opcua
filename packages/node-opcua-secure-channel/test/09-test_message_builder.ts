import "should";
import * as packets from "node-opcua-transport/dist/test-fixtures";
import { redirectToFile } from "node-opcua-debug/nodeJS";
import { make_debugLog } from "node-opcua-debug";
import { MessageBuilder, SecurityPolicy, MessageSecurityMode } from "../dist/source";
import { IDerivedKeyProvider } from "../dist/source/token_stack";
import sinon from "sinon";

const debugLog = make_debugLog(__filename);

describe("MessageBuilder", function () {

    const derivedKeyProvider: IDerivedKeyProvider = {
        getDerivedKey(tokenId: number) {
            return null;
        }
    };

    it("should raise a error event if a HEL or ACK packet is fed instead of a MSG packet ", function (done) {
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "MessageBuilder"
        });

        let full_message_body_event_received = false;
        let on_message__received = false;

        messageBuilder
            .on("message", (message) => {
                on_message__received = true;
            })
            .on("full_message_body", (full_message_body) => {
                full_message_body_event_received = true;
            })
            .on("error", (err) => {
                err.should.be.instanceOf(Error);
                on_message__received.should.equal(false);
                full_message_body_event_received.should.equal(true);
                done();
            });

        messageBuilder.feed(packets.helloMessage1); // HEL message
    });

    /**
     *  utility test function that verifies that the messageBuilder sends
     *  a error event, without crashing when a bad packet is processed.
     * @param test_case_name
     * @param bad_packet
     * @param done
     */
    function test_behavior_with_bad_packet(test_case_name: string, bad_packet: Buffer, expectError: boolean, done: ()=>void) {
        redirectToFile(
            "MessageBuilder_" + test_case_name + ".log",
            () => {
                const messageBuilder = new MessageBuilder(derivedKeyProvider, {
                    name: "MessageBuilder"
                });

                let full_message_body_event_received = false;
                let on_message__received = false;

                messageBuilder
                    .on("message", (message) => {
                        on_message__received = true;
                    })
                    .on("full_message_body", (full_message_body) => {
                        full_message_body_event_received = true;
                    })
                    .on("invalid_message", (err) => {
                        expectError.should.eql(false);
                        on_message__received.should.equal(false);
                        full_message_body_event_received.should.equal(true);
                        done();
                    })
                    .on("error", (err) => {
                        err.should.be.instanceOf(Error);
                        expectError.should.eql(true);
                        done();
                    });

                messageBuilder.feed(bad_packet); // OpenSecureChannel message
            },
            function () {
                /** */
            }
        );
    }

    it("should raise an error if the embedded object id is not known", function (done) {
        const bad_packet = Buffer.from(packets.openChannelRequest1);

        // alter the packet id to scrap the message ID
        // this will cause the message builder not to find the embedded object constructor.
        bad_packet.writeUInt8(255, 80);
        bad_packet.writeUInt8(255, 81);
        bad_packet.writeUInt8(255, 82);

        test_behavior_with_bad_packet("bad_object_id_error", bad_packet, true, done);
    });

    it("should raise an invalid_message if the embedded object failed to be decoded", function (done) {
        const bad_packet = Buffer.from(packets.openChannelRequest1);

        // alter the packet id  to scrap the inner data
        // this will cause the decode function to fail and raise an exception
        bad_packet.writeUInt8(10, 0x65);
        bad_packet.writeUInt8(11, 0x66);
        bad_packet.writeUInt8(255, 0x67);

        test_behavior_with_bad_packet("corrupted_message_error", bad_packet, false, done);
    });

    it("should emit a 'invalid_sequence_number' event if a message does not have a 1-increased sequence number", async  () => {

        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "MessageBuilder"
        });

        const spyMessage = sinon.spy();
        const spyError = sinon.spy();
        const spyInvalidSequenceNumber = sinon.spy();
        messageBuilder.on("message", spyMessage);
        messageBuilder.on("error", spyError);
        messageBuilder.on("invalid_sequence_number", spyInvalidSequenceNumber);
    
        // send first messages with sequence number 1
        messageBuilder.feed(packets.openChannelRequest1);

        spyMessage.callCount.should.eql(1); // only first message is accepted, as sequence number is 1
        spyError.callCount.should.eql(0);
        spyInvalidSequenceNumber.callCount.should.eql(0);

        // send a second messages with sequence number 1 ( instead of 2)
        messageBuilder.feed(packets.openChannelRequest1);
        spyMessage.callCount.should.eql(1); // only first message is accepted, as sequence number is 1
        spyError.callCount.should.eql(1);
        spyInvalidSequenceNumber.callCount.should.eql(1);
        spyInvalidSequenceNumber.getCall(0).args[0].should.eql(2,"expected sequence number");
        spyInvalidSequenceNumber.getCall(0).args[1].should.eql(1,"found sequence number");
    });

    it("some random packet - encrypted ", (done) => {
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "MessageBuilder"
        });
        messageBuilder.setSecurity(MessageSecurityMode.Sign, SecurityPolicy.Basic256);

        let _err: Error;
        messageBuilder
            .on("message", (message) => {
                /** */
            })
            .on("error", (err: Error) => {
                _err = err;
                done();
            })
            .on("invalid_sequence_number", (expected, found) => {
                done(new Error("should not get there" + JSON.stringify({ expected, found })));
            });

        messageBuilder.feed(packets.random_packet);
        
        _err!.message.should.match(/Invalid message header detected/);
    });
});
