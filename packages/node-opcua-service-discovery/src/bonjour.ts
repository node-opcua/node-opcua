import { assert } from "node-opcua-assert";
import * as   _ from "underscore";

const bonjour = require("bonjour");

let gBonjour: any = null;
let gBonjourRefCount = 0;


export function acquireBonjour() {
    if (gBonjourRefCount === 0) {
        // will start the BOnjour service
        gBonjour = bonjour();
    }
    gBonjourRefCount++;
    return gBonjour;
}

export function releaseBonjour() {
    gBonjourRefCount--;
    assert(gBonjourRefCount >= 0);
    if (gBonjourRefCount === 0) {
        // will start the BOnjour service
        gBonjour.destroy();
        gBonjour = null;
    }
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
export function _announcedOnMulticastSubnet(self: any, options: { port: number, path: string, applicationUri: string, capabilities: string[] }) {

    assert(self, "must be call with call(this,options)");

    const port = options.port;
    assert(_.isNumber(port));
    assert(typeof options.path === "string");
    assert(typeof options.applicationUri === "string");
    assert(!self.bonjour, "already called ?");
    assert(_.isArray(options.capabilities));

    self.bonjour = acquireBonjour();

    const params = {
        name: options.applicationUri,
        type: "opcua-tcp",
        protocol: "tcp",
        port,
        txt: {
            path: options.path,
            caps: options.capabilities.join(",")
        }
    };
    self._bonjourPublish = self.bonjour.publish(params);
    self._bonjourPublish.start();
}

export function _stop_announcedOnMulticastSubnet(self: any): void {
    assert(self, "must be call with call(this,options)");
    if (self._bonjourPublish) {
        self._bonjourPublish.stop();
        self._bonjourPublish = null;
        self.bonjour = null;
        releaseBonjour();
    }
}
