var MessageBuilder = require("../lib/message_builder").MessageBuilder;
var should = require('should');
var packets = require("./fixtures/fixture_full_tcp_packets");

var redirectToFile = require("../lib/utils").redirectToFile;

describe("MessageBuilder",function(){


    it('should raise a message event after reassembling and decoding a message ',function(done){

        var messageBuilder = new MessageBuilder();

        var full_message_body_event_received = false;
        var on_message__received = false;

        messageBuilder.
            on("message",function(message){
                on_message__received = true;
                message._schema.name.should.equal("GetEndpointsResponse");

                on_message__received.should.equal(true);
                full_message_body_event_received.should.equal(true);
                done();

            }).
            on("full_message_body",function(full_message_body){
                full_message_body_event_received = true;

            }).
            on("error",function(err){
                throw new Error("should not get there");
            });


        messageBuilder.feed(packets.packet_sc_3_a); // GEP response chunk  1
        messageBuilder.feed(packets.packet_sc_3_b); // GEP response chunk  2
    });



    it('should raise a error event if a HEL or ACK packet is fed instead of a MSG packet ',function(done){

        var messageBuilder = new MessageBuilder();

        var full_message_body_event_received = false;
        var on_message__received = false;

        messageBuilder.
            on("message",function(message){
                on_message__received = true;

            }).
            on("full_message_body",function(full_message_body){
                full_message_body_event_received = true;

            }).
            on("error",function(err){
                err.should.be.instanceOf(Error);
                on_message__received.should.equal(false);
                full_message_body_event_received.should.equal(true);
                done();

            });

        messageBuilder.feed(packets.packet_cs_1); // HEL message
    });
    it('should raise a error if the message cannot be decoded',function(done){


        redirectToFile("MessageBuilder_badpacket_error.log",function(){

            var messageBuilder = new MessageBuilder();

            var full_message_body_event_received = false;
            var on_message__received = false;

            messageBuilder.
                on("message",function(message){
                    on_message__received = true;

                }).
                on("full_message_body",function(full_message_body){
                    full_message_body_event_received = true;

                }).
                on("error",function(err){
                    err.should.be.instanceOf(Error);
                    on_message__received.should.equal(false);
                    full_message_body_event_received.should.equal(true);
                    done();
                });


            var bad_packet = Buffer( packets.packet_cs_2);

            // alter the packet id  to scrap the data
            bad_packet.writeUInt8(255,80);
            bad_packet.writeUInt8(255,81);
            bad_packet.writeUInt8(255,82);

            messageBuilder.feed(bad_packet); // OpenSecureChannel message
        },function(){});
    });



});
