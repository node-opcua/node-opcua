
import should from "should";
import { OPCUAClient, DataType, AttributeIds, readUAAnalogItem, BrowseDirection, OPCUAServer, ClientSession, NodeIdLike }from "node-opcua";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const port = 2009;


describe("testing AnalogItem on client side", function(this: Mocha.Runnable) {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

    this.timeout(Math.max(600000, this.timeout()));

    let g_session: ClientSession | null = null;
    before(async () => {
        server = await build_server_with_temperature_device({ port });
        endpointUrl = server.getEndpointUrl();
    });

    beforeEach(async () => {
        client = OPCUAClient.create({});
        await client.connect(endpointUrl);
        g_session = await client.createSession();
    });

    afterEach(async () => {
        if (g_session) {
            await g_session.close();
            g_session = null;
        }
        await client.disconnect();
    });

    after(function(done) {
        server.shutdown(done);
    });

    it("readUAAnalogItem should extract all properties of a UAAnalogItem ", async () => {
        const nodeId = "ns=1;s=TemperatureAnalogItem";
        const data = await readUAAnalogItem(g_session!, nodeId);
        data.should.have.ownProperty("engineeringUnits");
        data.should.have.ownProperty("engineeringUnitsRange");
        data.should.have.ownProperty("instrumentRange");
        data.should.have.ownProperty("valuePrecision");
        data.should.have.ownProperty("definition");

    });

    it("readUAAnalogItem should return an error if not doesn't exist", async () => {
        const nodeId = "ns=4;s=invalidnode";
        let err = null;
        try {
            await readUAAnalogItem(g_session!, nodeId);
        } catch (_err) { 
            err = _err; 
        }
        should.exist(err);
    });

    /**
     * find the nodeId that matches  property  named 'browseName' on a given node
     * @param nodeId
     * @param browseName
     * @param callback
     */
    async function findProperty(
        session: ClientSession, 
        nodeId: NodeIdLike, 
        browseName: string
    ) {
        const browseDescription = {
            nodeId: nodeId,
            referenceTypeId: "HasProperty",
            browseDirection: BrowseDirection.Forward,
            resultMask: 0x3f
        };
        const result = await session.browse(browseDescription);
        if (result.statusCode.isNotGood()) {
            return null;
        }
        let tmp = result.references!.filter((e) => e.browseName.name === browseName);
        let tmp2 = tmp.map((e) => e.nodeId);
        const found = tmp2.length === 1 ? tmp2[0] : null;
        return found;
    }

    it("should read the EURange property of an analog item", async () => {
        const nodeId = "ns=1;s=TemperatureAnalogItem";

        const propertyId = await findProperty(g_session!, nodeId, "EURange");

        should.exist(propertyId);

        const nodeToRead = {
            nodeId: propertyId,
            attributeId: AttributeIds.Value
        };
        //xx console.log("propertyId = ", propertyId.toString());
        const dataValue = await g_session!.read(nodeToRead);

        //xx console.log("result = ",result.toString());
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);

        dataValue.value.value.low.should.eql(100);
        dataValue.value.value.high.should.eql(200);

    });
});
