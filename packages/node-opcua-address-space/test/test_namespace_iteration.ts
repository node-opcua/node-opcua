import should from "should";
import type { AddressSpace, INamespace, Namespace } from "../dist/api/index.js";
import { getMiniAddressSpace } from "../testHelpers.js";

/**
 * Enumerating a namespace through the published API.
 *
 * Everything here imports from the package entry and takes `INamespace`, with no cast: that
 * is the whole point. These methods existed before, spelled with a leading underscore and
 * absent from the published type, so three separate hand-written copies of the interface had
 * grown up around them.
 */
describe("Namespace iteration", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.registerNamespace("urn:namespace-iteration-test");
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    // taking INamespace, not NamespaceImpl: a caller outside the package can only have this
    const countTypes = (ns: INamespace) => ({
        objectTypes: ns.objectTypeCount(),
        variableTypes: ns.variableTypeCount(),
        dataTypes: ns.dataTypeCount(),
        referenceTypes: ns.referenceTypeCount(),
        aliases: ns.aliasCount()
    });

    it("counts nothing in a namespace that holds nothing", () => {
        countTypes(namespace).should.eql({
            objectTypes: 0,
            variableTypes: 0,
            dataTypes: 0,
            referenceTypes: 0,
            aliases: 0
        });
        [...namespace.nodeIterator()].length.should.eql(0);
    });

    it("yields each kind of type from its own iterator", () => {
        namespace.addObjectType({ browseName: "MyObjectType" });
        namespace.addVariableType({ browseName: "MyVariableType" });
        namespace.addReferenceType({ browseName: "MyReferenceType", inverseName: "MyInverseName", isAbstract: false });
        namespace.addEnumerationType({ browseName: "MyEnumeration", enumeration: [{ displayName: "A", value: 1 }] });

        [...namespace.objectTypeIterator()].map((n) => n.browseName.name).should.eql(["MyObjectType"]);
        [...namespace.variableTypeIterator()].map((n) => n.browseName.name).should.eql(["MyVariableType"]);
        [...namespace.referenceTypeIterator()].map((n) => n.browseName.name).should.eql(["MyReferenceType"]);
        [...namespace.dataTypeIterator()].map((n) => n.browseName.name).should.eql(["MyEnumeration"]);
    });

    it("counts agree with what the iterators yield", () => {
        namespace.addObjectType({ browseName: "A" });
        namespace.addObjectType({ browseName: "B" });
        namespace.addVariableType({ browseName: "V" });

        const counts = countTypes(namespace);
        counts.objectTypes.should.eql([...namespace.objectTypeIterator()].length);
        counts.variableTypes.should.eql([...namespace.variableTypeIterator()].length);
        counts.objectTypes.should.eql(2);
        counts.variableTypes.should.eql(1);
    });

    it("nodeIterator yields every node whatever its class", () => {
        const objectType = namespace.addObjectType({ browseName: "SomeType" });
        namespace.addObject({ browseName: "SomeObject", typeDefinition: objectType, organizedBy: addressSpace.rootFolder.objects });

        const names = [...namespace.nodeIterator()].map((n) => n.browseName.name);
        names.should.containEql("SomeType");
        names.should.containEql("SomeObject");
    });

    it("counts an alias", () => {
        const objectType = namespace.addObjectType({ browseName: "Aliased" });
        namespace.addAlias("AnAlias", objectType.nodeId);
        should(namespace.aliasCount()).eql(1);
    });

    it("still answers to the deprecated underscore spellings", () => {
        // callers reached these through a cast, so they keep working and delegate
        namespace.addObjectType({ browseName: "MyObjectType" });

        namespace._objectTypeCount().should.eql(namespace.objectTypeCount());
        [...namespace._objectTypeIterator()].should.eql([...namespace.objectTypeIterator()]);
        [...namespace._dataTypeIterator()].should.eql([...namespace.dataTypeIterator()]);
        namespace._aliasCount().should.eql(namespace.aliasCount());
    });

    it("does not leak nodes between namespaces", () => {
        const other = addressSpace.registerNamespace("urn:some-other-namespace");
        namespace.addObjectType({ browseName: "Mine" });
        other.addObjectType({ browseName: "Theirs" });

        [...namespace.objectTypeIterator()].map((n) => n.browseName.name).should.eql(["Mine"]);
        [...other.objectTypeIterator()].map((n) => n.browseName.name).should.eql(["Theirs"]);
    });
});
