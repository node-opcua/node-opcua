/**
 * @module node-opcua-service-discovery
 */
// tslint:disable:no-console
import * as bonjour from "bonjour";
import * as   _ from "underscore";
import {callbackify} from "util";
import {promisify} from "util";

import {assert} from "node-opcua-assert";
import {checkDebugFlag, make_debugLog} from "node-opcua-debug";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


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

export async function _announceServerOnMulticastSubnet(
    multicastDNS: bonjour.Bonjour,
    options: Announcement
): Promise<bonjour.Service> {
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
        debugLog("bonjour ERROR received ! ", err.message);
        debugLog("params = ", params);
    });

    // istanbul ignore next
    if (doDebug) {
        debugLog("Announcing ", params.name , "on port ", port , " txt ", JSON.stringify(params.txt));
    }


    service.start();
    return service;
}

interface ServiceFixed extends NodeJS.EventEmitter {
    name: string;
    type: string;
    subtypes: string[];
    protocol: string;
    host: string;
    port: number;
    fqdn: string;
    txt: Object;
    published: boolean;

    stop(callback: (err: Error|null) => void): void;
    start(): void;
}
export class BonjourHolder {

    public announcement?: Announcement;

    private _multicastDNS?: bonjour.Bonjour;
    private _service?: bonjour.Service;

    public async _announcedOnMulticastSubnet(
        options: Announcement
    ): Promise<boolean> {
        if (this._service && this.announcement) {
            // verify that Announcement has changed
            if (sameAnnouncement(options, this.announcement!)) {
                debugLog(" Announcement ignored as it has been already made", options.name);
                return false; // nothing changed
            }
        }
        assert(!this._multicastDNS, "already called ?");
        this._multicastDNS = acquireBonjour();
        this._service = await _announceServerOnMulticastSubnet(this._multicastDNS, options);
        this.announcement = options;
        return true;
    }

    public _announcedOnMulticastSubnetWithCallback(
        options: Announcement,
        callback: (err: Error | null, result?: boolean) => void) {
        callback(new Error("Internal Error"));
    }

    public async _stop_announcedOnMulticastSubnet(): Promise<void> {

        debugLog("_stop_announcedOnMulticastSubnet = ");

        if (this._service) {
            // due to a wrong declaration of Service.stop in the d.ts file we
            // need to use a workaround here
            const this_service = this._service as any as ServiceFixed;
            this._service = undefined;
            this._multicastDNS = undefined;
            this.announcement = undefined;
            const stop = promisify((callback: (err: Error|null) => void)=>{
                this_service.stop(()=>{
                    callback(null);
                })
            });
            await stop.call(this);
            releaseBonjour();
            debugLog("stop announcement completed");
        }
    }

    public _stop_announcedOnMulticastSubnetWithCallback(
        callback: (err: Error | null) => void) {
        callback(new Error("Internal Error"));
    }

}

BonjourHolder.prototype._announcedOnMulticastSubnetWithCallback =
    callbackify(BonjourHolder.prototype._announcedOnMulticastSubnet);
BonjourHolder.prototype._stop_announcedOnMulticastSubnetWithCallback =
    callbackify(BonjourHolder.prototype._stop_announcedOnMulticastSubnet);
