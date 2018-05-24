
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
    const port = options.port;
    assert(_.isNumber(port));
    assert(typeof options.path === "string");
    assert(typeof options.applicationUri === "string");
    assert(!self.bonjour,"already called ?");
    assert(_.isArray(options.capabilities));

    self.bonjour = acquireBonjour();

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
    self._bonjourPublish = self.bonjour.publish(params);
    self._bonjourPublish.start();
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