/**
 * @module node-opcua-service-discovery
 */

import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { Bonjour, type Service, type ServiceConfig } from "sterfive-bonjour-service";

import type { Announcement } from "./Announcement.js";
import { announcementToServiceConfig } from "./announcement_to_service_config.js";
import { isSameService, serviceToString } from "./tools.js";

const debugLog = make_debugLog("Bonjour");
const doDebug = checkDebugFlag("Bonjour");
const errorLog = make_errorLog("Bonjour");
const warningLog = make_warningLog("Bonjour");

const registry = new ObjectRegistry();

async function releaseMulticastDNS(bonjour: Bonjour) {
    await new Promise<void>((resolve) => {
        bonjour?.unpublishAll(() => {
            resolve();
        });
    });
    await new Promise<void>((resolve) => {
        bonjour?.destroy(() => {
            resolve();
        });
    });
    registry.unregister(bonjour);
}

/**
 * How many multicast-DNS instances are currently held.
 *
 * A test seam, and the only way this leak is visible from inside the process: an instance left
 * behind holds a socket on udp/5353, which keeps the event loop alive, so the symptom is a test
 * run that finishes its assertions and then never exits.
 *
 * @internal
 */
export function multicastDNSInstanceCount(): number {
    return registry.count();
}

export function acquireMulticastDNS(): Bonjour {
    const bonjour = new Bonjour();
    registry.register(bonjour);
    return bonjour;
}

export async function _announceServerOnMulticastSubnet(multicastDNS: Bonjour, serviceConfig: ServiceConfig): Promise<Service> {
    return new Promise((resolve, reject) => {
        const port = serviceConfig.port;
        assert(typeof port === "number");
        assert(multicastDNS, "bonjour must have been initialized?");

        let timer: NodeJS.Timeout | undefined;
        /* c8 ignore next */
        doDebug && debugLog(chalk.cyan("  announceServerOnMulticastSubnet", serviceToString(serviceConfig)));

        // waitServiceUp(serviceConfig, () => {
        //     // c8 ignore next
        //     if (doDebug) {
        //         debugLog(chalk.cyan("  announcedOnMulticastSubnet done ", serviceToString(serviceConfig)));
        //     }
        //     //    resolve(service);
        // });

        const service: Service = multicastDNS.publish({ ...serviceConfig, probe: false });
        function onError(err: Error) {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            errorLog(" error during announcement ", err.message);
            service.removeListener("up", onUp);
            service.removeListener("error", onError);
            reject(err);
        }
        service.on("error", onError);

        const onUp = () => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            /* c8 ignore next */
            doDebug && debugLog("_announceServerOnMulticastSubnet: bonjour UP received ! ", serviceToString(serviceConfig));
            service.removeListener("error", onError);
            service.removeListener("up", onUp);
            resolve(service);
        };
        service.on("up", onUp);

        // set a timer to ensure that "up" or "error" event is raised within a reasonable time period
        timer = setTimeout(() => {
            timer = undefined;
            service.removeListener("error", onError);
            service.removeListener("up", onUp);
            const err = new Error(`Timeout waiting for bonjour to announce service ${serviceConfig.name}`);
            errorLog(err.message);
            reject(err);
        }, 10_000);

        service.start();
    });
}

export class BonjourHolder {
    public serviceConfig?: ServiceConfig;

    #_multicastDNS?: Bonjour;

    #_service?: Service;

    #pendingAnnouncement: boolean = false;
    /**
     *
     * @param announcement
     * @returns
     */
    public async announcedOnMulticastSubnet(announcement: Announcement): Promise<boolean> {
        // c8 ignore next
        doDebug && debugLog(chalk.yellow("\n\nentering announcedOnMulticastSubnet"));
        const serviceConfig = announcementToServiceConfig(announcement);
        if (this.#_service && this.serviceConfig) {
            // verify that Announcement has changed
            if (isSameService(serviceConfig, this.serviceConfig)) {
                // c8 ignore next
                if (doDebug) {
                    debugLog(" Announcement ignored as it has been already made", announcement.name);
                    debugLog("exiting announcedOnMulticastSubnet-2", false);
                }
                return false; // nothing changed
            }
        }
        assert(!this.#_multicastDNS, "already called ?");

        this.#_multicastDNS = acquireMulticastDNS();

        this.#pendingAnnouncement = true;
        this.serviceConfig = serviceConfig;
        try {
            this.#_service = await _announceServerOnMulticastSubnet(this.#_multicastDNS, serviceConfig);
        } finally {
            // the announcement rejects on a 10s timeout; leaving the flag set would make
            // stopAnnouncedOnMulticastSubnet retry forever and never release the instance
            this.#pendingAnnouncement = false;
        }
        // c8 ignore next
        doDebug && debugLog(chalk.yellow("exiting announcedOnMulticastSubnet-3", true));
        return true;
    }

    public isStarted(): boolean {
        return !!this.#_multicastDNS;
    }

    /**
     * @private
     */
    public async stopAnnouncedOnMulticastSubnet(): Promise<void> {
        if (this.#pendingAnnouncement) {
            // c8 ignore next
            doDebug &&
                debugLog(
                    chalk.bgWhite.redBright("stopAnnnouncedOnMulticastSubnet is pending : let's wait a little bit and try again")
                );
            // wait until announcement is done
            await new Promise((resolve) => setTimeout(resolve, 500));
            return this.stopAnnouncedOnMulticastSubnet();
        }

        // c8 ignore next
        doDebug &&
            debugLog(
                chalk.green(
                    "\n\nentering stop_announcedOnMulticastSubnet = ",
                    this.serviceConfig ? serviceToString(this.serviceConfig) : "<null>"
                )
            );

        // Take ownership of both handles first, then work on the locals. Everything below has
        // to reach releaseMulticastDNS: a Bonjour instance holds a socket on udp/5353, and one
        // left behind keeps the event loop alive, so a test run never exits.
        const that_service = this.#_service;
        const that_multicastDNS = this.#_multicastDNS;
        this.#_service = undefined;
        this.#_multicastDNS = undefined;
        this.serviceConfig = undefined;

        if (!that_multicastDNS) {
            // nothing was ever acquired
            // c8 ignore next
            doDebug && debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet = no multicast DNS"));
            return;
        }

        // A service exists only once the announcement completed; stopping is skipped when it
        // did not, but the instance is released either way. `stop` is declared wrongly in the
        // .d.ts, hence the check rather than a plain call.
        if (that_service?.stop) {
            await new Promise<void>((resolve) => {
                that_service.stop((err?: Error) => {
                    // c8 ignore next
                    doDebug && debugLog(chalk.green("service stopped err=", err));
                    err && warningLog(err.message);
                    that_multicastDNS.unpublishAll(() => {
                        resolve();
                    });
                });
            });
        }
        await releaseMulticastDNS(that_multicastDNS);

        // c8 ignore next
        if (doDebug) {
            debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet = done"));
            debugLog(chalk.green("leaving stop_announcedOnMulticastSubnet stop announcement completed"));
        }
    }
}
