
var net = require("net");
var opcua = require("./nodeopcua");
var colors = require('colors');
var util = require('util');



function OPCUAClient()
{
    this._client = new net.Socket();

    // Add a 'data' event handler for the client socket
    // data is what the server sent to this socket
    this._client.on('data', function(data) {

        _stream = new opcua.BinaryStream(data);
        var acknowledgeMessage = opcua.decodeMessage(_stream,opcua.AcknowledgeMessage);
        //xx console.log(util.inspect(acknowledgeMessage,{ colors: true}));


    });

    // Add a 'close' event handler for the client socket
    this._client.on('close', function() {
        //xx console.log('Connection closed');
    });
}


OPCUAClient.prototype.sendMessage = function(msg,callback)
{
    opcua.sendMessage(this._client,"HEL",msg,callback);

};


OPCUAClient.prototype.connect = function(host, port , callback)
{
    var self = this;
    this._client.connect(port, host, function() {

        //xx console.log('Client connected to : ' + host + ':' + port);

        // Write a message to the socket as soon as the client is connected,
        // the server will receive it as message from the client
        msg = new opcua.HelloMessage();
        self.sendMessage(msg,function(err) {

            if (err) {

            } else {
                callback();

//                msg = new OpenSecureChannel();
//                self.sendMessage(msg,function callback(err) {
//                    callback();
//                });
            }
        });
    });

};

OPCUAClient.prototype.disconnect = function(callback)
{
    this._client.end();
    callback();
};


exports.OPCUAClient = OPCUAClient;

