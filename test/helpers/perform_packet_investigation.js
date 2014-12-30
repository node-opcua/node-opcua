require("requirish")._(module);

var redirectToFile = require("lib/misc/utils").redirectToFile;



var perform_packet_investigation = function(packet,done) {

    var MessageBuilder = require("lib/misc/message_builder").MessageBuilder;
    var messageBuilder = new MessageBuilder();

    var full_message_body_event_received = false;
    var on_message__received = false;

    messageBuilder.
        on("message",function(message){
            on_message__received = true;
            done();
        }).
        on("full_message_body",function(full_message_body){
            full_message_body_event_received = true;

        }).
        on("error",function(err){
            done(err);

        });

    messageBuilder.feed(packet);

};


exports.perform_packet_investigation= perform_packet_investigation;