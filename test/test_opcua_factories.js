

var  encode_decode_round_trip_test = require("./encode_decode_round_trip_test").encode_decode_round_trip_test;



describe("OPCUA Structure encoding and decoding", function() {
    it("should encode and decode a EndPointDescription",function(done){

        var obj = require("./fixture_GetEndPointResponse").makeEndPoint();
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a GetEndPointResponse 1/4",function(done){

        var obj = require("./fixture_GetEndPointResponse").fixture1;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 2/4",function(done){

        var obj = require("./fixture_GetEndPointResponse").fixture2;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 3/4",function(done){

        var obj = require("./fixture_GetEndPointResponse").fixture3;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a GetEndPointResponse 4/4",function(done){

        var obj = require("./fixture_GetEndPointResponse").fixture4;
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a AsymmetricAlgorithmSecurityHeader ",function(done){

        var obj = require("./fixture_AsymmetricAlgorithmSecurityHeader").fixture1;
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a OpenSecureChannelRequest",function(done){

        var obj = require("./fixture_OpenSecureChannelRequest").fixture1;

        encode_decode_round_trip_test(obj);
        done();
    });


});

function makebuffer(listOfBytes)
{
    var l = listOfBytes.split(" ");
    var b = new Buffer(l.length);
    var i=0;
    l.forEach(function(value) {
        b.writeUInt8(parseInt(value,16),i);
        i+=1;
    })
    return b;
}




var packet_analyzer = require("../lib/packet_analyzer").packet_analyzer;
var MessageBuilder = require("../lib/secure_channel_service").MessageBuilder;
var s = require("../lib/secure_channel_service");
var opcua = require("../lib/nodeopcua");


function verify_single_chunk_message(messageChunk)
{
    // analyse security header
    var h = new s.AsymmetricAlgorithmSecurityHeader();
    packet_analyzer(messageChunk.slice(12),h);

    var messageBuild = new MessageBuilder();
    messageBuild.on("raw_buffer",function(fullMessage){
        packet_analyzer(fullMessage);
    });

    messageBuild.feed(messageChunk);
}

function redirectToFile(tmpfile,action_func,callback)
{
    var fs = require('fs');
    var log_file = fs.createWriteStream(__dirname + '/../tmp/' + tmpfile, {flags : 'w'});
    var old_console_log = console.log;
    var util = require('util');

    console.log = function(d) { //
        log_file.write(util.format(d) + '\n');
    };

    if (callback) {
        // async version
        action_func(function() {
            console.log = old_console_log;
            callback.call(arguments);
        });
    } else {
        // synchrone version
        action_func();
        console.log = old_console_log;
    }

};


describe("checking encoding from WireShark packet",function(){

    it("should decode a real OpenSecureChannelRequest message",function() {


        // a real OpenSecureChannelRequest captured with wireshark
        var ws_OpenSecureChannelRequest = makebuffer(
            "4f 50 4e 46 85 00 00 00 00 00 00 00 2f 00 00 00 " +
            "68 74 74 70 3a 2f 2f 6f 70 63 66 6f 75 6e 64 61 " +
            "74 69 6f 6e 2e 6f 72 67 2f 55 41 2f 53 65 63 75 " +
            "72 69 74 79 50 6f 6c 69 63 79 23 4e 6f 6e 65 ff " +
            "ff ff ff ff ff ff ff 33 00 00 00 01 00 00 00 01 " +
            "00 be 01 00 00 92 c2 53 d3 0c f7 ce 01 00 00 00 " +
            "00 00 00 00 00 ff ff ff ff 00 00 00 00 00 00 00 " +
            "00 00 00 00 00 00 00 00 01 00 00 00 01 00 00 00 " +
            "00 e0 93 04 00"
        );

        redirectToFile("OpenSecureChannelResponse.log",function(){
            verify_single_chunk_message(ws_OpenSecureChannelRequest);
        });


    });


    it("should decode a real OpenSecureChannelResponse message",function() {

        // a real OpenSecureChannelResponse captured with wireshark
        var ws_OpenSecureChannelResponse = makebuffer(
            "4f 50 4e 46 87 00 00 00 01 00 " +
            "00 00 2f 00 00 00 68 74 74 70 3a 2f 2f 6f 70 63 " +
            "66 6f 75 6e 64 61 74 69 6f 6e 2e 6f 72 67 2f 55 " +
            "41 2f 53 65 63 75 72 69 74 79 50 6f 6c 69 63 79 " +
            "23 4e 6f 6e 65 ff ff ff ff ff ff ff ff 00 00 00 " +
            "00 01 00 00 00 01 00 c1 01 a2 e9 53 d3 0c f7 ce " +
            "01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 " +
            "00 00 00 00 00 01 00 00 00 02 00 00 00 a2 e9 53 " +
            "d3 0c f7 ce 01 60 ea 00 00 ff ff ff ff"
        );

        redirectToFile("OpenSecureChannelResponse.log",function(){
            verify_single_chunk_message(ws_OpenSecureChannelResponse);
        });

    });
});

