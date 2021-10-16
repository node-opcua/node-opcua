import * as should from "should";
import { AddressSpace, UAObject } from "..";
import { getMiniAddressSpace } from "../testHelpers";

describe("test component/property/method and method accessors", () => {
    let addressSpace: AddressSpace;
    let uaObject: UAObject;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        const namespace1 = addressSpace.registerNamespace("urn:namespace1");
        const namespace2 = addressSpace.registerNamespace("urn:namespace2");
        const namespace3 = addressSpace.registerNamespace("urn:namespace3");

        uaObject = namespace1.addObject({
            browseName: "SomeObject"
        });
        const cu1 = namespace1.addObject({
            browseName: "SomeUniqueComponent",
            componentOf: uaObject
        });
        const c1 = namespace1.addObject({
            browseName: { namespaceIndex: namespace2.index, name: "SomeComponent" },
            componentOf: uaObject
        });
        const c12 = namespace1.addObject({
            browseName: { namespaceIndex: namespace3.index, name: "SomeComponent" },
            componentOf: uaObject
        });
        const pu1 = namespace1.addVariable({
            browseName: "SomeUniqueProperty",
            dataType: "Double",
            propertyOf: uaObject
        });
        const p1 = namespace1.addVariable({
            browseName: { namespaceIndex: namespace2.index, name: "SomeProperty" },
            dataType: "Double",
            propertyOf: uaObject
        });
        const p2 = namespace1.addVariable({
            browseName: { namespaceIndex: namespace3.index, name: "SomeProperty" },
            dataType: "Double",
            propertyOf: uaObject
        });

        const mu1 = namespace1.addMethod(uaObject, {
            browseName: "SomeUniqueMethod"
        });
        const m1 = namespace1.addMethod(uaObject, {
            browseName: { namespaceIndex: namespace2.index, name: "SomeMethod" }
        });
        const m2 = namespace1.addMethod(uaObject, {
            browseName: { namespaceIndex: namespace3.index, name: "SomeMethod" }
        });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("getComponentByName form 0", () => {
        const t1 = uaObject.getComponentByName("SomeUniqueComponent");
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 2, name: "SomeUniqueComponent" });
    });
    it("getComponentByName form 0 - should throw if multiple component exist with the same name (regardless of namespace)", () => {
        should.throws(() => {
            const t1 = uaObject.getComponentByName("SomeComponent");
        }, "it should throw because 2 components exists with name SomeProperty in two different namespace => we need to provide a  namespace ");
    });
    it("getComponentByName form 1", () => {
        const t1 = uaObject.getComponentByName("SomeComponent", 3);
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeComponent" });
    });
    it("getComponentByName form 3", () => {
        const t1 = uaObject.getComponentByName({ namespaceIndex: 3, name: "SomeComponent" });
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeComponent" });
    });

    it("getPropertyByName form 0", () => {
        const t1 = uaObject.getPropertyByName("SomeUniqueProperty");
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 2, name: "SomeUniqueProperty" });
    });
    it("getPropertyByName form 0 - should throw if multiple property exist with the same name (regardless of namespace)", () => {
        should.throws(() => {
            const t1 = uaObject.getPropertyByName("SomeProperty");
        }, "it should throw because 2 components exists with name SomeProperty in two different namespace => we need to provide a  namespace ");
    });
    it("getPropertyByName form 1", () => {
        const t1 = uaObject.getPropertyByName("SomeProperty", 3);
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeProperty" });
    });
    it("getPropertyByName form 3", () => {
        const t1 = uaObject.getPropertyByName({ namespaceIndex: 3, name: "SomeProperty" });
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeProperty" });
    });

    // --------------------------
    it("getMethodByName form 0", () => {
        const t1 = uaObject.getMethodByName("SomeUniqueMethod");
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 2, name: "SomeUniqueMethod" });
    });
    it("getMethodByName form 0 - should throw if multiple Method exist with the same name (regardless of namespace)", () => {
        should.throws(() => {
            const t1 = uaObject.getMethodByName("SomeMethod");
        }, "it should throw because 2 components exists with name SomeMethod in two different namespace => we need to provide a  namespace ");
    });
    it("getMethodByName form 1", () => {
        const t1 = uaObject.getMethodByName("SomeMethod", 3);
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeMethod" });
    });
    it("getMethodByName form 3", () => {
        const t1 = uaObject.getMethodByName({ namespaceIndex: 3, name: "SomeMethod" });
        should.exist(t1);
        t1?.browseName.toJSON().should.eql({ namespaceIndex: 3, name: "SomeMethod" });
    });
});
