import { makeAccessRestrictionsFlag, NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, makeRoles, type UAVariable, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

/**
 * FEAT-34 (CTT Base Info Core Structure 2 / 001.js): a Read with TimestampsToReturn Both
 * of Server/PublishSubscribe/SecurityGroups/AddSecurityGroup/OutputArguments (i=15446)
 * and KeyPushTargets/AddPushTarget/OutputArguments (i=25443) came back with no
 * SourceTimestamp.
 *
 * Opc.Ua.NodeSet2.xml reserves Read of both nodes to the SecurityKeyServerAdmin role, so an
 * anonymous session is denied, and the DataValue that says so carried no timestamp at all.
 * A DataValue may carry timestamps whatever its status and the CTT expects the requested
 * ones on every result (the same rule already stamps BadDataEncodingInvalid, Attribute
 * Read 037): a Bad result the variable makes up at read time is stamped with the clock of
 * that moment.
 */
describe("FEAT-34 a denied Value read carries the requested timestamps", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let addressSpace: AddressSpace;

    const server = {
        userManager: {
            getUserRoles(_username: string) {
                return makeRoles(WellKnownRoles.Anonymous);
            }
        }
    };
    const anonymous = makeMockSessionContext({ userName: "anonymous", server });
    const anonymousEncrypted = makeMockSessionContext({
        userName: "anonymous",
        securityMode: MessageSecurityMode.SignAndEncrypt,
        server
    });

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn:feat-34");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const expectStamped = (dataValue: { sourceTimestamp?: Date | null; serverTimestamp?: Date | null }) => {
        should(dataValue.sourceTimestamp).be.instanceOf(Date);
        should(dataValue.serverTimestamp).be.instanceOf(Date);
    };

    for (const nodeId of ["i=15446", "i=25443"]) {
        it(`${nodeId} OutputArguments: BadUserAccessDenied, with both timestamps`, () => {
            const variable = addressSpace.findNode(nodeId) as UAVariable;
            should.exist(variable);
            const dataValue = variable.readValue(anonymousEncrypted);
            dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
            should(dataValue.value.dataType).eql(DataType.Null);
            expectStamped(dataValue);
        });
    }

    it("i=15446 read asynchronously: BadUserAccessDenied, with both timestamps", async () => {
        const variable = addressSpace.findNode("i=15446") as UAVariable;
        const dataValue = await variable.readValueAsync(anonymousEncrypted);
        dataValue.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        expectStamped(dataValue);
    });

    it("a variable that requires encryption, read over None: BadSecurityModeInsufficient, with both timestamps", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "EncryptedOnly",
            dataType: DataType.Int32,
            value: { dataType: DataType.Int32, value: 1 }
        });
        variable.setAccessRestrictions(makeAccessRestrictionsFlag("SigningRequired | EncryptionRequired"));
        const dataValue = variable.readValue(anonymous);
        dataValue.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        expectStamped(dataValue);
        const dataValue2 = await variable.readValueAsync(anonymous);
        dataValue2.statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
        expectStamped(dataValue2);
    });

    it("a variable without CurrentRead: BadNotReadable, with both timestamps", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName: "WriteOnly",
            dataType: DataType.Int32,
            accessLevel: "CurrentWrite",
            value: { dataType: DataType.Int32, value: 1 }
        });
        const dataValue = variable.readValue(anonymous);
        dataValue.statusCode.should.eql(StatusCodes.BadNotReadable);
        expectStamped(dataValue);
        const dataValue2 = await variable.readValueAsync(anonymous);
        dataValue2.statusCode.should.eql(StatusCodes.BadNotReadable);
        expectStamped(dataValue2);
    });

    it("every Variable of namespace 0 read by an anonymous session carries both timestamps, Good or Bad", () => {
        const missing: string[] = [];
        const statuses = new Map<string, number>();
        let count = 0;
        for (const node of addressSpace.getNamespace(0).nodeIterator()) {
            if (node.nodeClass !== NodeClass.Variable) continue;
            count++;
            const dataValue = (node as UAVariable).readValue(anonymousEncrypted);
            const status = dataValue.statusCode.name;
            statuses.set(status, (statuses.get(status) || 0) + 1);
            if (!dataValue.sourceTimestamp || !dataValue.serverTimestamp) {
                missing.push(`${node.nodeId.toString()} ${node.browseName.toString()} ${status}`);
            }
        }
        count.should.be.greaterThan(3000);
        // the nodeset denies the anonymous session a few values: those results are stamped too
        should(statuses.get("BadUserAccessDenied")).be.greaterThan(0);
        missing.should.eql([]);
    });
});
