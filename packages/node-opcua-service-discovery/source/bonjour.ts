/**
 * @module node-opcua-service-discovery
 */
// tslint:disable:no-console
import { callbackify, promisify } from "util";
import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { Bonjour, Service, ServiceConfig } from "sterfive-bonjour-service";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

let gBonjour: Bonjour | undefined;
let gBonjourRefCount = 0;

const registry = new ObjectRegistry();

function errorCallback(err: Error) {
    console.log(" ERROR received from Bonjour", err.message);
}

export function acquireBonjour(): Bonjour {
    const bonjour = new Bonjour();
    registry.unregister(bonjour);
    return bonjour;
}

export function releaseBonjour(bonjour: Bonjour, callback: () => void) {
    bonjour!.unpublishAll(() => {
        bonjour!.destroy(callback);
        registry.unregister(bonjour);
    });
}

export function acquireBonjour2(): Bonjour {
    if (gBonjourRefCount === 0) {
        // will start the Bonjour service
        debugLog("Starting Bonjour");
        gBonjour = new Bonjour(undefined, errorCallback);
        registry.register(gBonjour);
    }
    gBonjourRefCount++;
    return gBonjour!;
}

export function releaseBonjour2(bonjour: Bonjour) {
    gBonjourRefCount--;
    assert(gBonjourRefCount >= 0);
    if (gBonjourRefCount === 0) {
        if (!gBonjour) {
            throw new Error("internal error");
        }
        const tmp = gBonjour;
        gBonjour = undefined;
        // will stop the Bonjour service
        tmp!.unpublishAll(() => {
            tmp!.destroy();
            registry.unregister(tmp);
            debugLog("Releasing Bonjour");
        });
    }
}

export interface Announcement {
    port: number;
    path: string;
    name: string;
    capabilities: string[];
}

export function announcementToServiceConfig(announcement: Announcement): ServiceConfig {
    const serviceConfig: ServiceConfig = {
        name: announcement.name,
        port: announcement.port,
        protocol: "tcp",
        txt: {
            caps: announcement.capabilities.sort().join(","),
            path: announcement.path
        },
        type: "opcua-tcp"
    };

    return serviceConfig;
}

export function isSameService(a?: ServiceConfig, b?: ServiceConfig): boolean {
    if (!a && !b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.port === b.port && a.txt?.path === b.txt?.path && a.name === b.name && a.txt?.caps === b.txt?.caps;
}

export const serviceToString = (service: ServiceConfig) => {
    return "type=" + service.type + service.name + " on port " + service.port + " txt " + JSON.stringify(service.txt);
};

// function waitServiceUp(serviceConfig: ServiceConfig, callback: () => void) {
//     const multicastDNS = new Bonjour();
//     const browser = multicastDNS.find({
//         protocol: "tcp",
//         type: "opcua-tcp"
//     });
//     const onUp = (service: Service) => {
//         if (doDebug) {
//             debugLog(chalk.cyan("    waitServiceUp is up with  ", serviceToString(service)));
//         }
//         if (isSameService(service, serviceConfig)) {
//             browser.removeAllListeners("up");
//             multicastDNS.destroy();
//             callback();
//         }
//     };
//     browser.on("up", onUp);
// }

// function waitServiceDown(serviceConfig: ServiceConfig, callback: () => void) {
//     const multicastDNS = new Bonjour();
//     const browser = multicastDNS.find({
//         protocol: "tcp",
//         type: "opcua-tcp"
//     });
//     const onDown = (service: Service) => {
//         if (doDebug) {
//             debugLog(chalk.cyan("    waitServiceDown down with  ", serviceToString(service)));
//         }
//         if (isSameService(service, serviceConfig)) {
//             browser.removeAllListeners("down");
//             multicastDNS.destroy();
//             callback();
//         }
//     };
//     browser.on("down", onDown);
// }

export async function _announceServerOnMulticastSubnet(multicastDNS: Bonjour, serviceConfig: ServiceConfig): Promise<Service> {
    return new Promise((resolve, reject) => {
        const port = serviceConfig.port;
        assert(typeof port === "number");
        assert(multicastDNS, "bonjour must have been initialized?");

        debugLog(chalk.cyan("  announceServerOnMulticastSubnet", serviceToString(serviceConfig)));

        // waitServiceUp(serviceConfig, () => {
        //     // istanbul ignore next
        //     if (doDebug) {
        //         debugLog(chalk.cyan("  announcedOnMulticastSubnet done ", serviceToString(serviceConfig)));
        //     }
        //     //    resolve(service);
        // });

        const service: Service = multicastDNS.publish({ ...serviceConfig, probe: false });
        service.on("error", (err: Error) => {
            debugLog("bonjour ERROR received ! ", err.message);
            debugLog("params = ", serviceConfig);
        });
        service.on("up", () => {
            debugLog("_announceServerOnMulticastSubnet: bonjour UP received ! ", serviceToString(serviceConfig));
            resolve(service);
        });
        service.start();
    });
}

export class BonjourHolder {
    public serviceConfig?: ServiceConfig;

    private _multicastDNS?: Bonjour;
    private _service?: Service;
    private pendingAnnouncement = false;
    /**
     *
     * @param announcement
     * @returns
     */
    public async announcedOnMulticastSubnet(announcement: Announcement): Promise<boolean> {
        debugLog(chalk.yellow("\n\nentering announcedOnMulticastSubnet"));
        const serviceConfig = announcementToServiceConfig(announcement);
        if (this._service && this.serviceConfig) {
            // verify that Announcement has changed
            if (isSameService(serviceConfig, this.serviceConfig!)) {
                debugLog(" Announcement ignored as it has been already made", announcement.name);
                debugLog("exiting announcedOnMulticastSubnet-2", false);
                return false; // nothing changed
            }
        }
        assert(!this._multicastDNS, "already called ?");

        this._multicastDNS = acquireBonjour();

        this.pendingAnnouncement = true;
        this.serviceConfig = serviceConfig;
        this._service = await _announceServerOnMulticastSubnet(this._multicastDNS, serviceConfig);
        this.pendingAnnouncement = false;
        debugLog(chalk.yellow("exiting announcedOnMulticastSubnet-3", true));
        return true;
    }

    public isStarted(): boolean {
        return !!this._multicastDNS;
    }

    /**
     *
     * @param announcement
     * @param callback
     * @private
     */
    public announcedOnMulticastSubnetWithCallback(
        announcement: Announcement,
        callback: (err: Error | null, result?: boolean) => void
    ) {
        callback(new Error("Internal Error"));
    }

    /**
     * @private
     */
    public async stopAnnnouncedOnMulticastSubnet(): Promise<void> {
        if (this.pendingAnnouncement) {
            debugLog(chalk.bgWhite.redBright("stopAnnnouncedOnMulticastSubnet is pending : let's wait a little bit and try again"));
            // wait until announcement is done
            await new Promise((resolve) => setTimeout(resolve, 500));
            return this.stopAnnnouncedOnMulticastSubnet();
        }

        debugLog(
            chalk.green(
                "\n\nentering stop_announcedOnMulticastSubnet = ",
                this.serviceConfig ? serviceToString(this.serviceConfig) : "<null>"
            )
        );

        if (!this._service) {
            debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet = no service"));
            return;
        }
        // due to a wrong declaration of Service.stop in the d.ts file we
        // need to use a workaround here
        const that_service = this._service;
        const that_multicastDNS = this._multicastDNS!;
        this._service = undefined;
        this._multicastDNS = undefined;

        this.serviceConfig = undefined;
        const proxy = (callback: (err?: Error) => void) => {
            if (that_multicastDNS && that_service.stop) {
                // waitServiceDown(that_service, () => {
                //     debugLog(chalk.green("stop_announcedOnMulticastSubnet, ", serviceToString(that_service)));
                // });
                that_service.stop((err?: Error) => {
                    debugLog(chalk.green("service stopped err=", err));
                    that_multicastDNS.unpublishAll(() => {
                        releaseBonjour(that_multicastDNS, () => {
                            callback();
                        });
                    });
                });
                return;
            } else {
                callback();
            }
        };
        const stop = promisify(proxy);
        await stop.call(this);

        debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet = done"));
        debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet stop announcement completed"));
    }

    public stopAnnouncedOnMulticastSubnetWithCallback(callback: (err: Error | null) => void) {
        callback(new Error("Internal Error"));
    }
}

BonjourHolder.prototype.announcedOnMulticastSubnetWithCallback = callbackify(BonjourHolder.prototype.announcedOnMulticastSubnet);
BonjourHolder.prototype.stopAnnouncedOnMulticastSubnetWithCallback = callbackify(
    BonjourHolder.prototype.stopAnnnouncedOnMulticastSubnet
);
