/**
 * @module node-opcua-service-discovery
 */
// tslint:disable:no-console
import * as bonjour from "bonjour";
import * as   _ from "underscore";

import { assert } from "node-opcua-assert";

let gBonjour: bonjour.Bonjour | undefined;
let gBonjourRefCount = 0;

export function acquireBonjour(): bonjour.Bonjour {
    if (gBonjourRefCount === 0) {
        // will start the Bonjour service
        gBonjour = bonjour();
    }
    gBonjourRefCount++;
    return gBonjour!;
}

export function releaseBonjour() {
    gBonjourRefCount--;
    assert(gBonjourRefCount >= 0);
    if (gBonjourRefCount === 0) {
        // will start the Bonjour service
        gBonjour!.destroy();
        gBonjour = undefined;
    }
}

export interface Announcement {
    port: number;
    path: string;
    name: string;
    capabilities: string[];
}

export function sameAnnouncement(a: Announcement, b: Announcement): boolean {
    return a.port === b.port &&
      a.path === b.path &&
      a.name === b.name &&
      a.capabilities.join(" ") === b.capabilities.join(" ");
}

export function _announceServerOnMulticastSubnet(
  multicastDNS: bonjour.Bonjour,
  options: Announcement
): bonjour.Service {
    const port = options.port;
    assert(_.isNumber(port));
    assert(multicastDNS, "bonjour must have been initialized?");

    const params: bonjour.ServiceOptions = {
        name: options.name,
        port,
        protocol: "tcp",
        txt: {
            caps: options.capabilities.join(","),
            path: options.path
        },
        type: "opcua-tcp"
    };
    const service: bonjour.Service = multicastDNS.publish(params);
    service.on("error", (err: Error) => {
        console.log("bonjour ERROR received ! ", err.message);
        console.log("params = ", params);
    });
    service.start();
    return service;
}

export class BonjourHolder {

    public announcement?: Announcement;

    private _multicastDNS?: bonjour.Bonjour;
    private _service?: bonjour.Service;

    public _announcedOnMulticastSubnet(
      options: Announcement
    ): boolean {
        if (this._service && this.announcement) {
            // verify that Announcement has changed
            if (sameAnnouncement(options, this.announcement!)) {
                return false; // nothing changed
            }
        }
        assert(!this._multicastDNS, "already called ?");
        this._multicastDNS = acquireBonjour();
        this._service = _announceServerOnMulticastSubnet(this._multicastDNS, options);
        this.announcement = options;
        return true;
    }

    public _stop_announcedOnMulticastSubnet(): void {
        if (this._service) {
            this._service.stop(() => {
                /* empty */
            });
            this._service = undefined;
            this._multicastDNS = undefined;
            this.announcement = undefined;
            releaseBonjour();
        }
    }
}
