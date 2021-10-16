// tslint:disable:no-bitwise
import "should";

import { AccessRestrictionsFlag, AttributeIds, makeAccessLevelExFlag, makeAccessRestrictionsFlag } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import { AddressSpace, Namespace } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing AccessRestrictions ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    it("ART-1 accessRestrictions: (at construction time)", () => {
        const v = namespace.addVariable({
            browseName: "Var",
            dataType: "Double",
            accessRestrictions: makeAccessRestrictionsFlag("SigningRequired | SessionRequired")
        });

        const dataValue = v.readAttribute(null, AttributeIds.AccessRestrictions);

        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.dataType.should.eql(DataType.UInt16);
        dataValue.value.value.should.eql(AccessRestrictionsFlag.SessionRequired + AccessRestrictionsFlag.SigningRequired);
    });

    it("ART-2 accessRestrictions: (setAccessRestrictions)", () => {
        const v = namespace.addVariable({
            browseName: "Var",
            dataType: "Double"
        });
        v.setAccessRestrictions(makeAccessRestrictionsFlag("SigningRequired | SessionRequired"));

        const dataValue = v.readAttribute(null, AttributeIds.AccessRestrictions);

        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.dataType.should.eql(DataType.UInt16);
        dataValue.value.value.should.eql(AccessRestrictionsFlag.SessionRequired + AccessRestrictionsFlag.SigningRequired);
    });
});
