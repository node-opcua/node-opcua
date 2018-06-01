"use strict";
const OPCUAClientBase = require("../client_base").OPCUAClientBase;
const async = require("async");
/**
 * extract the server endpoints exposed by a discovery server
 * @method perform_findServers
 * @async
 * @param discovery_server_endpointUrl
 * @param callback
 */
function perform_findServers(discovery_server_endpointUrl, callback) {


    const client = new OPCUAClientBase({});

    let servers = [];
    let endpoints =[];

    async.series([
        function (callback) {
            client.connect(discovery_server_endpointUrl, callback);
        },
        function (callback) {
            client.findServers(function (err, _servers) {
                servers = _servers;
                callback(err);
            });
        },
        function (callback) {
            client.getEndpoints({endpointUrl:null},function (err, _endpoints) {
                endpoints =  _endpoints;
                callback(err);
            });
        },

    ],function(err) {
        client.disconnect(function () {
            callback(err,servers,endpoints);
        });
    });
}
exports.perform_findServers = perform_findServers;

/**
 * extract the server endpoints exposed by a discovery server
 * @method perform_findServers
 * @async
 * @param discovery_server_endpointUrl
 * @param callback
 */
function perform_findServersOnNetwork(discovery_server_endpointUrl, callback) {


    const client = new OPCUAClientBase({});

    client.connect(discovery_server_endpointUrl, function (err) {
        if (!err) {
            client.findServersOnNetwork(function (err, servers) {
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
exports.perform_findServersOnNetwork = perform_findServersOnNetwork;
