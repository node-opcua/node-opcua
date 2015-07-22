"use strict";
require("requirish")._(module);

var OPCUAClientBase = require("lib/client/client_base").OPCUAClientBase;
/**
 * extract the server endpoints exposed by a discovery server
 * @method perform_findServersRequest
 * @async
 * @param discovery_server_endpointUrl
 * @param callback
 */
function perform_findServersRequest(discovery_server_endpointUrl, callback) {


    var client = new OPCUAClientBase();

    client.connect(discovery_server_endpointUrl, function (err) {
        if (!err) {
            client.findServers(function (err, servers) {
                client.disconnect(function () {
                    callback(err, servers);
                });
            });
        } else {
            client.disconnect(function () {
                callback(err);
            });
        }
    });
}
exports.perform_findServersRequest = perform_findServersRequest;
