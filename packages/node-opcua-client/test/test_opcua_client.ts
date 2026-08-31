import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { ClientSecureChannelLayer, OPCUAClient } from "../dist/index.js";

describe("OPCUA Client", () => {
    it("it should create a client", () => {
        const _client = OPCUAClient.create({});
    });
    it("should create a ClientSecureChannelLayer", () => {
        const channel = new ClientSecureChannelLayer({});
        channel.dispose();
    });
});
