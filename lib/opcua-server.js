
var net = require('net');
var colors = require('colors');
var util = require('util');



function OPCUAServer()
{
    var self = this;

    self._helloreceived = false;

    this._server = net.createServer(


        function(socket) {

            //'connection' listener
            console.log('server connected');

            var _stream = new Buffer(8192);

            socket.on('data',function(data)  {

                _stream = new opcua.BinaryStream(data);

                var helloMessage = opcua.decodeMessage(_stream,opcua.HelloMessage);

                console.log(util.inspect(helloMessage,{ colors: true}));

                // the helloMessage shall only be received once.
                self._helloreceived = true;
                var acknowledgeMessage = new opcua.AcknowledgeMessage();
                opcua.sendMessage(socket,"ACK",acknowledgeMessage,function callback() {

                    console.log("send reply");
                });


            });

            socket.on('close', function() {
                console.log('server disconnected (CLOSE)');
            });

            socket.on('end', function() {
                console.log('server disconnected (END)');
            });

            // socket.write('hello\r\n');
            // socket.pipe(socket);

            self.connected_client_count+=1;

        }
    );
    this._server.on("connection",function(socket){
        console.log('CONNECTED: ' + socket.remoteAddress +':'+ socket.remotePort);
    });

    this.connected_client_count = 0;
}

OPCUAServer.prototype.listen = function(port)
{
    port = parseInt(port);

    this._server.listen(port, function() { //'listening' listener
        console.log('server bound');
    });

};

OPCUAServer.prototype.shutdown = function(callback)
{

    delete this._server;
    callback();
};

exports.OPCUAServer = OPCUAServer;

