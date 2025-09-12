import {
    Announcement,
    BonjourHolder,
    announcementToServiceConfig,
    serviceToString
} from "..";
import should from "should";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import Bonjour from "sterfive-bonjour-service";
import { make_debugLog } from "node-opcua-debug";
import sinon from "sinon";
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
            port: 1234
        };
        const serviceConfig = announcementToServiceConfig(announcement);
        should(serviceConfig).eql({
            name: "name",
            type: "opcua-tcp",
            protocol: "tcp",
            host: "host",
            port: 1234,
            txt: {
                caps: "capability1,capability2",
                path: "path",
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
            // istanbul ignore next
            debugLog("MDNSResponder : service is up with  ", serviceToString(service));
        });
        browser.on("down", (service) => {
            // istanbul ignore next
            debugLog("MDNSResponder : service is down with  ", serviceToString(service));
        });

        const spyUp = sinon.spy();
        const spyDown = sinon.spy();
        browser.on("up", spyUp);
        browser.on("down", spyDown);

        return { spyUp, spyDown,bonjour, browser, shutdown() {
            browser.stop();
            bonjour.destroy();
        }};
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
            port: 1234
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
