var argv = require('optimist').argv;
var net = require("net");
var hexy = require("hexy");
var opcua = require("../lib/nodeopcua");
var MessageBuilder = require("../lib/secure_channel_service").MessageBuilder;
var packet_analyzer = require("../lib/packet_analyzer").packet_analyzer;

require("colors");

var remote_port = 4841;
hostname = "localhost";

var my_port = remote_port + 1;



var TrafficAnalyser = function(id)
{
    this.id = id;
};

TrafficAnalyser.prototype.add = function(data)
{

    var stream = new opcua.BinaryStream(data);

    var messageBuild = new MessageBuilder();
    messageBuild.on("raw_buffer",function(fullMessage){

        console.log(hexy.hexy(fullMessage));

        packet_analyzer(fullMessage);

    });


    var messageHeader = opcua.readMessageHeader(stream);

    if (this.id%2) {
        console.log( JSON.stringify(messageHeader,null,"").red.bold);
    } else {
        console.log( JSON.stringify(messageHeader,null,"").yellow.bold);
    }

    switch(messageHeader.msgType) {

        case "HEL":
            break;
        case "ACK":
            break;

        case "OPN": // open secure channel
        case "CLO": // close secure channel
        case "MSG": // message
            // decode secure message
            messageBuild.feed(data);
            break;
        case "ERR":
            console.log(hexy.hexy(data));
            break;
        default:
            break;

    }

};


require('net').createServer(function (socket) {

    console.log("connected");
    var ta_client = new  TrafficAnalyser(1);

    var ta_server = new  TrafficAnalyser(2);

    var proxy_client  = net.Socket();
    proxy_client.connect(remote_port,hostname);

    proxy_client.on('data',function(data) {
        console.log(" server -> client : packet length " + data.length);
        socket.write(data);
        ta_server.add(data);
    });

    socket.on('data', function (data) {
        console.log(" client -> server : packet length " + data.length);
        proxy_client.write(data);
        ta_client.add(data);
    });


}).listen(my_port);

console.log(" registering OPCUA server on port " + my_port);
console.log("  +-> redirecting conversation to server port " + remote_port);
