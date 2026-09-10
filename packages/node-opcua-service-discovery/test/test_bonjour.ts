import { EventEmitter } from "node:events";
import { make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";
import Bonjour from "sterfive-bonjour-service";
import {
    type Announcement,
    announcementToServiceConfig,
    BonjourHolder,
    multicastDNSInstanceCount,
    serviceToString
} from "../dist/index.js";

const port = 1234;

const debugLog = make_debugLog("Bonjour")!;

describe("Bonjour", () => {
    it("should create a BonjourHolder", () => {
        const holder = new BonjourHolder();
        should(holder).be.instanceOf(BonjourHolder);
        should(holder.serviceConfig).eql(undefined);
    });

    it("should convert an Announcement to a ServiceConfig", () => {
        const announcement: Announcement = {
            name: "name",
            capabilities: ["capability1", "capability2"],
            host: "host",
            path: "path",
            port
        };
        const serviceConfig = announcementToServiceConfig(announcement);
        should(serviceConfig).eql({
            name: "name",
            type: "opcua-tcp",
            protocol: "tcp",
            host: "host",
            port,
            txt: {
                caps: "capability1,capability2",
                path: "path"
            }
        });
    });
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    function startListner() {
        const bonjour = new Bonjour();
        const browser = bonjour.find({
            protocol: "tcp",
            type: "opcua-tcp"
        });

        browser.on("up", (service) => {
            // c8 ignore next
            debugLog("MDNSResponder : service is up with  ", serviceToString(service));
        });
        browser.on("down", (service) => {
            // c8 ignore next
            debugLog("MDNSResponder : service is down with  ", serviceToString(service));
        });

        const spyUp = sinon.spy();
        const spyDown = sinon.spy();
        browser.on("up", spyUp);
        browser.on("down", spyDown);

        return {
            spyUp,
            spyDown,
            bonjour,
            browser,
            shutdown() {
                browser.stop();
                bonjour.destroy();
            }
        };
    }
    it("should start/stop a BonjourHolder", async () => {
        const { spyUp, spyDown, shutdown } = startListner();

        const holder = new BonjourHolder();
        should(holder.serviceConfig).eql(undefined);

        const announcement: Announcement = {
            name: "name",
            capabilities: ["capability1", "capability2"],
            host: "host",
            path: "path",
            port
        };
        holder.announcedOnMulticastSubnet(announcement);

        await pause(1000);
        should(holder.isStarted()).eql(true);
        should(holder.serviceConfig).not.eql(undefined);

        await pause(500);

        spyUp.callCount.should.eql(1);
        spyDown.callCount.should.eql(0);

        await holder.stopAnnouncedOnMulticastSubnet();
        await pause(500);

        should(holder.isStarted()).eql(false);
        should(holder.serviceConfig).eql(undefined);

        spyDown.callCount.should.eql(1);
        spyUp.callCount.should.eql(1);
        shutdown();
    });
});

// ── releasing the multicast-DNS instance ────────────────────────────────────────
//
// Every exit path of stopAnnouncedOnMulticastSubnet has to release the Bonjour instance it
// acquired. One left behind holds a socket on udp/5353 and keeps the event loop alive, so the
// failure is not an assertion: it is a mocha run that prints its results and then hangs. That
// was seen once for 1h35m, holding six of these sockets.

describe("BonjourHolder multicast-DNS lifetime", () => {
    it("MDNS-1 releases the instance when an announcement was made", async () => {
        const before = multicastDNSInstanceCount();
        const holder = new BonjourHolder();
        await holder.announcedOnMulticastSubnet({ name: "mdns-1", capabilities: ["DA"], host: "host", path: "path", port });
        should(multicastDNSInstanceCount()).eql(before + 1);

        await holder.stopAnnouncedOnMulticastSubnet();
        should(multicastDNSInstanceCount()).eql(before);
        should(holder.isStarted()).eql(false);
    });

    it("MDNS-2 stopping without an announcement releases nothing and returns", async () => {
        const before = multicastDNSInstanceCount();
        const holder = new BonjourHolder();
        await holder.stopAnnouncedOnMulticastSubnet();
        should(multicastDNSInstanceCount()).eql(before);
    });

    it("MDNS-3 stopping twice is safe", async () => {
        const before = multicastDNSInstanceCount();
        const holder = new BonjourHolder();
        await holder.announcedOnMulticastSubnet({ name: "mdns-3", capabilities: ["DA"], host: "host", path: "path", port });
        await holder.stopAnnouncedOnMulticastSubnet();
        await holder.stopAnnouncedOnMulticastSubnet();
        should(multicastDNSInstanceCount()).eql(before);
    });

    it("MDNS-4 releases the instance when the announcement failed", async () => {
        // the announcement rejects on an error event or a 10s timeout. Before the fix the
        // instance was acquired but never reached the release, because stop() returned early
        // on `!this.#_service` - and the pending flag stayed set, so a later stop recursed
        // forever rather than failing.
        const before = multicastDNSInstanceCount();
        const holder = new BonjourHolder();
        const publish = sinon.stub(Bonjour.prototype, "publish").callsFake(() => {
            const service = new EventEmitter() as unknown as ReturnType<Bonjour["publish"]>;
            setImmediate(() => (service as unknown as EventEmitter).emit("error", new Error("announce refused")));
            return service;
        });
        try {
            await holder
                .announcedOnMulticastSubnet({ name: "mdns-4", capabilities: ["DA"], host: "host", path: "path", port })
                .then(
                    () => undefined,
                    () => undefined
                );
        } finally {
            publish.restore();
        }
        await holder.stopAnnouncedOnMulticastSubnet();
        should(multicastDNSInstanceCount()).eql(before);
    });
});
