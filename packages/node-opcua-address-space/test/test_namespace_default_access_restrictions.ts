import { AccessRestrictionsFlag, AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import should from "should";
import { AddressSpace, type INamespace, PseudoSession, setNamespaceMetaData, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

describe("namespace default access restrictions", () => {
    let addressSpace: AddressSpace;
    let withMetaData: INamespace;
    let withoutMetaData: INamespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://with-metadata");
        addressSpace.registerNamespace("http://without-metadata");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        withMetaData = addressSpace.getNamespace("http://with-metadata");
        withoutMetaData = addressSpace.getNamespace("http://without-metadata");

        withMetaData.setDefaultAccessRestrictions(AccessRestrictionsFlag.SigningRequired);
        setNamespaceMetaData(withMetaData);
        withoutMetaData.setDefaultAccessRestrictions(AccessRestrictionsFlag.SigningRequired);
    });
    after(() => {
        addressSpace.dispose();
    });

    function addVariable(namespace: INamespace): UAVariable {
        const variable = namespace.addVariable({
            browseName: "V",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects
        });
        variable.setValueFromSource({ dataType: "Double", value: 1 });
        return variable;
    }

    const contextNone = makeMockSessionContext({ userName: "anonymous", securityMode: MessageSecurityMode.None });
    const contextSign = makeMockSessionContext({ userName: "anonymous", securityMode: MessageSecurityMode.Sign });

    for (const [label, getNamespace] of [
        ["exposed in NamespaceMetadata", () => withMetaData],
        ["set on the namespace only", () => withoutMetaData]
    ] as const) {
        it(`enforces a default ${label} on a read over an unsigned channel`, async () => {
            const variable = addVariable(getNamespace());
            should(variable.accessRestrictions).eql(undefined);

            const refused = await new PseudoSession(addressSpace, contextNone).read({
                nodeId: variable.nodeId,
                attributeId: AttributeIds.Value
            });
            should(refused.statusCode).eql(StatusCodes.BadSecurityModeInsufficient);

            const accepted = await new PseudoSession(addressSpace, contextSign).read({
                nodeId: variable.nodeId,
                attributeId: AttributeIds.Value
            });
            should(accepted.statusCode).eql(StatusCodes.Good);
        });
    }

    it("leaves namespace 0 unrestricted: its metadata declares the property without a value", () => {
        const serverStatus = addressSpace.findNode("i=2256") as UAVariable;
        should(contextNone.isAccessRestricted(serverStatus)).eql(false);
    });
});
