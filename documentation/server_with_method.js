/* global console, require */
var opcua = require("node-opcua");

var server = new opcua.OPCUAServer({
    port: 4334 // the port of the listening socket of the server
});

function post_initialize() {

    var addressSpace = server.engine.addressSpace;

    var myDevice = addressSpace.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "MyDevice"
    });

    var method = addressSpace.addMethod(myDevice, {

        browseName: "Bark",

        inputArguments: [
            {
                name: "nbBarks",
                description: {text: "specifies the number of time I should bark"},
                dataType: opcua.DataType.UInt32
            }, {
                name: "volume",
                description: {text: "specifies the sound volume [0 = quiet ,100 = loud]"},
                dataType: opcua.DataType.UInt32
            }
        ],

        outputArguments: [{
            name: "Barks",
            description: {text: "the generated barks"},
            dataType: opcua.DataType.String,
            valueRank: 1
        }]
    });


    method.bindMethod(function (inputArguments, context, callback) {

        var nbBarks = inputArguments[0].value;
        var volume = inputArguments[1].value;

        console.log("Hello World ! I will bark ", nbBarks, " times");
        console.log("the requested volume is ", volume, "");
        var sound_volume = Array(volume).join("!");

        var barks = [];
        for (var i = 0; i < nbBarks; i++) {
            barks.push("Whaff" + sound_volume);
        }

        var callMethodResult = {
            statusCode: opcua.StatusCodes.Good,
            outputArguments: [{
                dataType: opcua.DataType.String,
                arrayType: opcua.VariantArrayType.Array,
                dimensions: [barks.length],
                value: barks
            }]
        };
        callback(null, callMethodResult);
    });

}

server.initialize(post_initialize);

server.start(function () {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
});
