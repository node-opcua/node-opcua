/**
 * @module node-opcua-service-discovery
 */
// tslint:disable:no-console
import { assert } from "node-opcua-assert";
import * as   _ from "underscore";

// tslint:disable:no-var-requires
const bonjourLib = require("bonjour");

let gBonjour: any = null;
let gBonjourRefCount = 0;

export function acquireBonjour() {
    if (gBonjourRefCount === 0) {
        // will start the BOnjour service
        gBonjour = bonjourLib();
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

export function _announceServerOnMulticastSubnet(
    bonjour: any,
    options: { port: number, path: string, applicationUri: string, capabilities: string[] }
) {

    const port = options.port;
    assert(_.isNumber(port));
    assert(bonjour, "bonjour must have been initialized?");

    assert(typeof options.path === "string");
    assert(typeof options.applicationUri === "string");
    assert(_.isArray(options.capabilities));

    const params = {
        name: options.applicationUri,
        port,
        protocol: "tcp",
        txt: {
            caps: options.capabilities.join(","),
            path: options.path ,
        },
        type: "opcua-tcp",
    };
    const _bonjourPublish = bonjour.publish(params);
    _bonjourPublish.on("error", (err: Error) => {
        console.log(" bonjour ERROR received ! ", err.message);
        console.log(" params = ", params);
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

export function _announcedOnMulticastSubnet(
    self: any,
    options: { port: number, path: string, applicationUri: string, capabilities: string[] }
) {

    assert(self, "must be call with call(this,options)");
    assert(!self.bonjour, "already called ?");
    self.bonjour = acquireBonjour();
    self._bonjourPublish = _announceServerOnMulticastSubnet(self.bonjour, options);
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
