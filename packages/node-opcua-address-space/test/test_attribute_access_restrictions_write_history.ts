/**
 * AccessRestrictions (for example EncryptionRequired) gate Read, Write and HistoryRead alike: the
 * operation is allowed only over a channel that meets them. This asserts that Write (the Value and
 * the Historizing attributes) and HistoryRead apply the same check readValue() applies - for a
 * restriction set on the node and for one inherited from the namespace default - and that an
 * encrypted channel is allowed.
 *
 * The lab uses a mini address space and a mock session context with a chosen security mode, so no
 * server or socket is needed.
 */
import { AccessRestrictionsFlag, AttributeIds, makeAccessRestrictionsFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { type HistoryData, ReadRawModifiedDetails } from "node-opcua-service-history";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, ContinuationPointManager, makeRoles, WellKnownRoles } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

describe("AccessRestrictions enforced on Write and HistoryRead, not only Read", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let addressSpace: AddressSpace;

    // the server resolves every session to the Anonymous role; the nodes below carry no role
    // permissions, so RBAC never denies - only the security-mode restriction can.
    const server = {
        userManager: {
            getUserRoles(_username: string) {
                return makeRoles(WellKnownRoles.Anonymous);
            }
        }
    };
    const anonymousNone = makeMockSessionContext({ userName: "anonymous", server });
    const anonymousEncrypted = makeMockSessionContext({
        userName: "anonymous",
        securityMode: MessageSecurityMode.SignAndEncrypt,
        server,
        // a real manager so the control HistoryRead can register its continuation point
        continuationPointManager: new ContinuationPointManager()
    });

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn:access-restrictions-write-history");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("ARWH-1 refuses a Write over a None channel, allows it once encrypted", async () => {
        const v = addressSpace.getOwnNamespace().addVariable({
            browseName: "ProtectedWrite",
            dataType: DataType.Int32,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            value: { dataType: DataType.Int32, value: 1 }
        });
        v.setAccessRestrictions(makeAccessRestrictionsFlag("EncryptionRequired"));

        // control: a Read over None is already refused for the security mode
        should(v.readValue(anonymousNone).statusCode).eql(StatusCodes.BadSecurityModeInsufficient);

        // a Write over None must be refused the same way, and the value must not change
        const denied = await v.writeValue(
            anonymousNone,
            new DataValue({ value: new Variant({ dataType: DataType.Int32, value: 42 }) })
        );
        should(denied).eql(StatusCodes.BadSecurityModeInsufficient);
        should(v.readValue(anonymousEncrypted).value.value).eql(1, "the value must be unchanged after the denied Write");

        // control: over an encrypted channel the same Write is allowed
        const allowed = await v.writeValue(
            anonymousEncrypted,
            new DataValue({ value: new Variant({ dataType: DataType.Int32, value: 7 }) })
        );
        should(allowed).eql(StatusCodes.Good);
        should(v.readValue(anonymousEncrypted).value.value).eql(7);
    });

    it("ARWH-2 refuses a HistoryRead over a None channel, allows it once encrypted", async () => {
        const v = addressSpace.getOwnNamespace().addVariable({
            browseName: "ProtectedHistory",
            dataType: DataType.Double,
            accessLevel: "CurrentRead | CurrentWrite | HistoryRead",
            userAccessLevel: "CurrentRead | CurrentWrite | HistoryRead",
            value: { dataType: DataType.Double, value: 0 }
        });
        addressSpace.installHistoricalDataNode(v);

        const t0 = new Date();
        for (let k = 0; k < 5; k++) {
            v.setValueFromSource({ dataType: DataType.Double, value: k }, StatusCodes.Good, new Date(t0.getTime() + k * 1000));
        }
        v.setAccessRestrictions(makeAccessRestrictionsFlag("EncryptionRequired"));

        const details = new ReadRawModifiedDetails({
            startTime: new Date(t0.getTime() - 10_000),
            endTime: new Date(t0.getTime() + 10_000),
            numValuesPerNode: 1000,
            isReadModified: false,
            returnBounds: false
        });

        // control: a live Read over None is refused for the security mode
        should(v.readValue(anonymousNone).statusCode).eql(StatusCodes.BadSecurityModeInsufficient);

        // a HistoryRead over None must be refused too - the whole series must stay undisclosed
        const denied = await v.historyRead(anonymousNone, details, null, null, { continuationPoint: null });
        should(denied.statusCode).eql(StatusCodes.BadSecurityModeInsufficient);
        should(denied.historyData == null || (denied.historyData as HistoryData).dataValues == null).eql(
            true,
            "no history is returned to the denied session"
        );

        // control: over an encrypted channel the HistoryRead is allowed and returns the series
        const allowed = await v.historyRead(anonymousEncrypted, details, null, null, { continuationPoint: null });
        should(allowed.statusCode).eql(StatusCodes.Good);
        const dataValues = (allowed.historyData as HistoryData).dataValues || [];
        should(dataValues).be.an.Array();
        should(dataValues.length).be.aboveOrEqual(5, "the full series is returned once the channel is encrypted");
    });

    it("ARWH-3 refuses a write of the Historizing attribute over a None channel", async () => {
        const v = addressSpace.getOwnNamespace().addVariable({
            browseName: "ProtectedHistorizing",
            dataType: DataType.Double,
            accessLevel: "CurrentRead | CurrentWrite | HistoryRead | HistoryWrite",
            userAccessLevel: "CurrentRead | CurrentWrite | HistoryRead | HistoryWrite",
            value: { dataType: DataType.Double, value: 0 }
        });
        addressSpace.installHistoricalDataNode(v);
        v.setAccessRestrictions(makeAccessRestrictionsFlag("EncryptionRequired"));

        // the Value branch is not the only one that must be gated: a write of Historizing over a
        // None channel must be refused too, before the attribute switch.
        const denied = await v.writeAttribute(anonymousNone, {
            attributeId: AttributeIds.Historizing,
            value: new DataValue({ value: new Variant({ dataType: DataType.Boolean, value: false }) })
        });
        should(denied).eql(StatusCodes.BadSecurityModeInsufficient);
    });

    it("ARWH-4 refuses a Write over None when the restriction is the namespace default", async () => {
        const ns = addressSpace.getOwnNamespace();
        ns.setDefaultAccessRestrictions(makeAccessRestrictionsFlag("EncryptionRequired"));
        try {
            const v = ns.addVariable({
                browseName: "NamespaceDefaultProtected",
                dataType: DataType.Int32,
                accessLevel: "CurrentRead | CurrentWrite",
                userAccessLevel: "CurrentRead | CurrentWrite",
                value: { dataType: DataType.Int32, value: 1 }
            });
            // the node carries no AccessRestrictions of its own; the namespace default applies
            should(v.readValue(anonymousNone).statusCode).eql(StatusCodes.BadSecurityModeInsufficient);
            const denied = await v.writeValue(
                anonymousNone,
                new DataValue({ value: new Variant({ dataType: DataType.Int32, value: 9 }) })
            );
            should(denied).eql(StatusCodes.BadSecurityModeInsufficient);
            should(v.readValue(anonymousEncrypted).value.value).eql(1, "the value must be unchanged after the denied Write");
        } finally {
            ns.setDefaultAccessRestrictions(AccessRestrictionsFlag.None);
        }
    });
});
