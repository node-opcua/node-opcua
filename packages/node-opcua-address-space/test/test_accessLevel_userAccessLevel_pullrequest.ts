// tslint:disable:no-bitwise
import "should";
import * as should from "should";
import { AccessLevelFlag } from "node-opcua-data-model";
import { AddressSpace, Namespace } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead | CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead | CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentRead", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead | CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: CurrentRead | CurrentWrite\tuserAccessLevel: undefined", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead | CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        should.not.exist(v.userAccessLevel);
    });

    // accessLevel CurrentRead
    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead | CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentRead", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        v.userAccessLevel.should.eql(AccessLevelFlag.NONE);
    });

    it("accessLevel: CurrentRead \tuserAccessLevel: undefined", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead);
        should.not.exist(v.userAccessLevel);

    });

    // accessLevel CurrentWrite
    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead | CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentRead", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.NONE);
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: CurrentWrite", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: CurrentWrite \tuserAccessLevel: undefined", () => {
        const v = namespace.addVariable({
            accessLevel: "CurrentWrite",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentWrite);
        should.not.exist(v.userAccessLevel);
    });

    // accessLevel undefined
    it("accessLevel: undefined \tuserAccessLevel: CurrentRead | CurrentWrite", () => {
        const v = namespace.addVariable({
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead | CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentRead", () => {
        const v = namespace.addVariable({
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentRead);
    });

    it("accessLevel: undefined \tuserAccessLevel: CurrentWrite", () => {
        const v = namespace.addVariable({
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentWrite"
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        v.userAccessLevel.should.eql(AccessLevelFlag.CurrentWrite);
    });

    it("accessLevel: undefined \tuserAccessLevel: undefined", () => {
        const v = namespace.addVariable({
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Int32",
            minimumSamplingInterval: 10
        });

        v.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        should.not.exist(v.userAccessLevel);
    });
});
