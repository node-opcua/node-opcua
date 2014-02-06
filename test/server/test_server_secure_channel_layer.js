
var ServerSecureChannelLayer = require("../../lib/server/server_secure_channel_layer").ServerSecureChannelLayer;

var should  = require("should");

var debugLog  = require("../../lib/utils").make_debugLog(__filename);

var DirectTransport = require("../../lib/transport/fake_socket").DirectTransport;


describe("testing ServerSecureChannelLayer ",function(){

    it("should create a ServerSecureChannelLayer",function(){


        var server_scl = new ServerSecureChannelLayer();
        server_scl.timeout.should.be.greaterThan(100);

    });
    it("should end with a timeout if no message is received from client",function(done){

        var node = new DirectTransport();
        var server_scl = new ServerSecureChannelLayer();
        server_scl.timeout = 50;
        server_scl.init(node.server,function(err){

            err.message.should.match(/Timeout/);
            done();
        });

        server_scl.on("abort",function(){

        });
    });
    it("should end with a timeout if HEL/ACK is OK but no further message is received from client",function(done){


        var node = new DirectTransport();

        var server_scl = new ServerSecureChannelLayer();
        server_scl.timeout = 200;
        server_scl.init(node.server,function(err){
            err.message.should.match(/Timeout waiting for OpenChannelRequest/);
            done();
        });

        server_scl.on("abort",function(){

        });
        var fake_HelloMessage = require("../fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);


    });


    it("should return an error and shutdown if first message is not OpenSecureChannelRequest ",function(done){

        var node = new DirectTransport();

        var server_scl = new ServerSecureChannelLayer();
        server_scl.timeout = 200;
        server_scl.init(node.server,function(err){
            err.message.should.match(/Expecting OpenSecureChannelRequest/);
            done();
        });


        server_scl.on("abort",function(){

        });
        var fake_HelloMessage = require("../fixture_full_tcp_packets").packet_cs_1; // HEL
        node.client.write(fake_HelloMessage);

        var fake_NotAOpenSecureChannelMessage = require("../fixture_full_tcp_packets").packet_cs_3; // GEP
        node.client.write(fake_NotAOpenSecureChannelMessage);
    });


});
