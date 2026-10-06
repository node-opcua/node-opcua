import type { CompactAddressSpace } from "node-opcua-address-space";
import { SessionContext } from "node-opcua-address-space";
import { nodesetSourceFromFile } from "node-opcua-address-space/nodeJS.js";
import { AttributeIds, BrowseDirection, ResultMask } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { ReadRequest } from "node-opcua-service-read";
import { StatusCodes } from "node-opcua-status-code";
import { BrowseDescription } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../dist/server_engine.js";

describe("ServerEngine with a compact address space: one namespace table for both spaces", function () {
    this.timeout(60000);
    let engine: ServerEngine;
    let compact: CompactAddressSpace;
    const context = SessionContext.defaultContext;

    before((done) => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact:ns" });
        // the server's own namespace takes index 1 before any companion model; DI is given as a
        // source object, not a path, as an application may
        engine.initialize({ nodesets: [nodesets.standard, nodesetSourceFromFile(nodesets.di)], compactAddressSpace: true }, () => {
            compact = engine.compactAddressSpace as CompactAddressSpace;
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    it("gives a companion nodeset the same index in both spaces", () => {
        const uris = engine.addressSpace?.getNamespaceArray().map((n) => n.namespaceUri) ?? [];
        should(uris[2]).eql("http://opcfoundation.org/UA/DI/");
        should(compact.namespaceUris).eql(uris);
        const deviceSet = compact.findNode("ns=2;i=5001");
        should(deviceSet?.browseName.toString()).eql("2:DeviceSet");
        should(compact.findNode("ns=1;i=5001")).eql(null, "nothing of DI sits under the server's own index");
    });

    it("serves a compact node typed by the companion nodeset, registered after it", async () => {
        const ns = engine.registerCompactNamespace("urn:test:compact:ns:plant");
        should(ns).eql(3);
        should(compact.namespaceUris.length).eql(4);
        const deviceSet = compact.findNode("ns=2;i=5001") as never;
        const device = compact.addObject({
            browseName: "Pump",
            organizedBy: deviceSet,
            typeDefinition: "ns=2;i=1002" /* DeviceType */
        });
        compact.addVariable({
            nodeId: `ns=${ns};s=Speed`,
            browseName: "Speed",
            componentOf: device,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        });
        const values = engine.readSync(
            context,
            new ReadRequest({ nodesToRead: [{ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value }] })
        );
        should(values[0].statusCode).eql(StatusCodes.Good);
        const browse = (
            await engine.browse(context, [
                new BrowseDescription({
                    nodeId: "ns=2;i=5001",
                    browseDirection: BrowseDirection.Forward,
                    referenceTypeId: "ns=0;i=33",
                    includeSubtypes: true,
                    nodeClassMask: 0,
                    resultMask: ResultMask.BrowseName | ResultMask.TypeDefinition
                })
            ])
        )[0];
        const pump = (browse.references ?? []).find((r) => r.browseName.name === "Pump");
        should(pump?.nodeId.namespace).eql(ns);
        should(pump?.typeDefinition.toString()).eql("ns=2;i=1002");
    });
});
