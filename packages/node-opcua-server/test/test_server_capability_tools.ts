import type { UAVariable } from "node-opcua-address-space";
import { VariableIds } from "node-opcua-constants";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    addServerCapabilityIdentifier,
    addServerProfile,
    removeServerCapabilityIdentifier,
    removeServerProfile,
    ServerEngine
} from "../source/index.js";

const globalCertificateManagement = "http://opcfoundation.org/UA-Profile/Server/GlobalCertificateManagement";

describe("server capability tools", () => {
    describe("ServerCapabilityIdentifiers (capabilitiesForMDNS)", () => {
        it("should replace the NA default of an OPCUAServer", () => {
            const server = { capabilitiesForMDNS: ["NA"] };
            should(addServerCapabilityIdentifier(server, "GDS")).eql(true);
            should(addServerCapabilityIdentifier(server, "DA")).eql(true);
            should(addServerCapabilityIdentifier(server, "gds")).eql(false);
            should(server.capabilitiesForMDNS).eql(["DA", "GDS"]);
        });

        it("should restore NA when the last identifier is withdrawn", () => {
            const server = { capabilitiesForMDNS: ["DA", "GDS"] };
            should(removeServerCapabilityIdentifier(server, "GDS")).eql(true);
            should(removeServerCapabilityIdentifier(server, "DA")).eql(true);
            should(removeServerCapabilityIdentifier(server, "DA")).eql(false);
            should(server.capabilitiesForMDNS).eql(["NA"]);
        });

        it("should create the list when the server has none", () => {
            const server: { capabilitiesForMDNS?: string[] } = {};
            should(addServerCapabilityIdentifier(server, "DA")).eql(true);
            should(server.capabilitiesForMDNS).eql(["DA"]);
        });

        it("should reject a malformed identifier", () => {
            const server = { capabilitiesForMDNS: ["NA"] };
            should(() => addServerCapabilityIdentifier(server, "D A")).throw(/Invalid ServerCapabilityIdentifier/);
            should(server.capabilitiesForMDNS).eql(["NA"]);
        });
    });

    describe("ServerProfileArray", () => {
        let engine: ServerEngine;

        before((done) => {
            engine = new ServerEngine({ applicationUri: "application:uri" });
            engine.initialize({ nodeset_filename: nodesets.standard }, () => done());
        });

        after(async () => {
            await engine.shutdown();
        });

        function readServerProfileArray(): string[] {
            const node = engine.addressSpace?.findNode(
                VariableIds.Server_ServerCapabilities_ServerProfileArray
            ) as UAVariable | null;
            should.exist(node);
            return node?.readValue().value.value as string[];
        }

        it("should ship the default ServerProfileArray sorted and without duplicates", () => {
            const profiles = engine.serverCapabilities.serverProfileArray;
            should(profiles).containEql("http://opcfoundation.org/UA-Profile/Server/Standard");
            should(profiles).eql([...new Set(profiles)].sort());
        });

        it("should advertise a Facet through the ServerProfileArray node, once", () => {
            should(addServerProfile({ engine }, globalCertificateManagement)).eql(true);
            should(addServerProfile({ engine }, globalCertificateManagement)).eql(false);

            const profiles = readServerProfileArray();
            should(profiles.filter((p) => p === globalCertificateManagement)).eql([globalCertificateManagement]);
            should(profiles).eql([...profiles].sort());
        });

        it("should withdraw a Facet from the ServerProfileArray node", () => {
            should(removeServerProfile({ engine }, globalCertificateManagement)).eql(true);
            should(removeServerProfile({ engine }, globalCertificateManagement)).eql(false);
            should(readServerProfileArray()).not.containEql(globalCertificateManagement);
        });

        it("should reject a malformed profile URI", () => {
            should(() => addServerProfile({ engine }, "GlobalCertificateManagement")).throw(/Invalid profile URI/);
        });

        it("should refuse a server that is not initialized yet", () => {
            should(() => addServerProfile({}, globalCertificateManagement)).throw(/server.initialize\(\)/);
        });
    });
});
