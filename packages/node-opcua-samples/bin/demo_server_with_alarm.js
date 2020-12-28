#!/usr/bin/env node
"use strict";
const path = require("path");
const opcua = require("node-opcua");
const { construct_demo_alarm_in_address_space } = require("node-opcua-address-space/testHelpers");

function constructFilename(filename) {
    return path.join(__dirname, "../", filename);
}

const server_certificate_file = constructFilename("certificates/server_selfsigned_cert_2048.pem");
const server_certificate_privatekey_file = constructFilename("certificates/server_key_2048.pem");

const nodeset_filenames = [opcua.nodesets.standard];

const port = 4334;

const server = new opcua.OPCUAServer({
    certificateFile: server_certificate_file,
    privateKeyFile: server_certificate_privatekey_file,

    port, // the port of the listening socket of the server
    resourcePath: "/UA/MyLittleServer", // this path will be added to the endpoint resource name
    buildInfo: {
        productName: "urn:DemoAlarmServer",
        buildNumber: "1",
        buildDate: new Date(2016, 9, 27)
    },
    nodeset_filename: nodeset_filenames
});


function post_initialize() {
    function construct_my_address_space(server) {

        const addressSpace = server.engine.addressSpace;

        const data = {};
        construct_demo_alarm_in_address_space(data, addressSpace);

        let time = 1;
        function simulate_variation() {
            const value = (1.0 + Math.sin(time / 360 * 3)) / 2.0;
            data.tankLevel.setValueFromSource({ dataType: "Double", value: value });

            data.tankLevel2.setValueFromSource({ dataType: "Double", value: value });

            time += 1;
        }
        setInterval(simulate_variation, 200);
        simulate_variation();


    }
    construct_my_address_space(server);

    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.getEndpointUrl();
        console.log(" the primary server endpoint url is ", endpointUrl);
    });
}
server.initialize(post_initialize);
