"use strict";
 /*global require,setInterval,console */
var path = require("path");
var opcua = require("node-opcua");
function constructFilename(filename) {
    return path.join(__dirname,"../",filename);
}
var server_certificate_file            = constructFilename("certificates/server_selfsigned_cert_2048.pem");
var server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

var nodeset_filenames = [ opcua.standard_nodeset_file ];

var server = new opcua.OPCUAServer({
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port: 4334, // the port of the listening socket of the server
    resourcePath: "UA/MyLittleServer", // this path will be added to the endpoint resource name
    buildInfo : {
        productName: "DemoAlarmServer",
        buildNumber: "1",
        buildDate: new Date(2016,9,27)
    },
    nodeset_filename: nodeset_filenames
});


function post_initialize() {
    function construct_my_address_space(server) {

        var addressSpace = server.engine.addressSpace;

        var data = {};
        opcua.construct_demo_alarm_in_address_space(data,addressSpace);

        var time  = 1;
        function simulate_variation() {
            var value = (1.0 + Math.sin(time/360*3))/2.0;
            data.tankLevel.setValueFromSource({dataType: "Double",value:value});

            data.tankLevel2.setValueFromSource({dataType: "Double",value:value});

            time +=1;
        }
        setInterval(simulate_variation,200);
        simulate_variation();


    }
    construct_my_address_space(server);

    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
    });
}
server.initialize(post_initialize);