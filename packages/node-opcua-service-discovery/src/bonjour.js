"use strict";
let g_bonjour = null;
let g_bonjour_refCount = 0;
const Bonjour = require("bonjour");
const assert = require("node-opcua-assert").assert;
const  _ = require("underscore");

function acquireBonjour() {
    if (g_bonjour_refCount === 0) {
        // will start the BOnjour service
        g_bonjour = Bonjour();
    }
    g_bonjour_refCount++;
    return g_bonjour;
}

function releaseBonjour() {
    g_bonjour_refCount--;
    assert(g_bonjour_refCount>=0);
    if(g_bonjour_refCount === 0) {
        // will start the BOnjour service
        g_bonjour.destroy();
        g_bonjour = null;
    }
}

exports.acquireBonjour = acquireBonjour;
exports.releaseBonjour = releaseBonjour;


function _announceServerOnMulticastSubnet(bonjour, options) {

    const port = options.port;
    assert(_.isNumber(port));
    assert(bonjour, "bonjour must have been initialized?");

    assert(typeof options.path === "string");
    assert(typeof options.applicationUri === "string");
    assert(_.isArray(options.capabilities));

    const params = {
        name: options.applicationUri,
        type: "opcua-tcp",
        protocol: "tcp",
        port: port,
        txt: {
            path: options.path ,
            caps: options.capabilities.join(",")
        }
    };
    const _bonjourPublish = bonjour.publish(params);
    _bonjourPublish.on("error",function(err){

        console.log(" bonjour ERROR received ! ",err.message);
        console.log(" params = ",params);
    });
    _bonjourPublish.start();
    return _bonjourPublish;
}
//
/**
 *
 * @param options
 * @param options.port {number}
 * @param options.path {string}
 * @param options.applicationUri {string}
 * @param options.capabilities {string[]}
 * @private
 */
function _announcedOnMulticastSubnet(options) {

    assert(this,"must be call with call(this,options)");
    const self = this;
    assert(!self.bonjour,"already called ?");
    self.bonjour = acquireBonjour();
    self._bonjourPublish = _announceServerOnMulticastSubnet(self.bonjour,options);
}

function _stop_announcedOnMulticastSubnet()
{
    assert(this,"must be call with call(this,options)");
    const self = this;
    if (self._bonjourPublish) {
        self._bonjourPublish.stop();
        self._bonjourPublish = null;
        self.bonjour = null;
        releaseBonjour();
    }
}


exports._stop_announcedOnMulticastSubnet = _stop_announcedOnMulticastSubnet;
exports._announcedOnMulticastSubnet = _announcedOnMulticastSubnet;
exports._announceServerOnMulticastSubnet = _announceServerOnMulticastSubnet;
