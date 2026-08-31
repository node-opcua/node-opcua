import "mocha";
import type { AddressSpace, UAObject, UAVariable } from "node-opcua-address-space";
import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { AliasNameError, addAlias, findAlias, removeAlias } from "../source/add_alias.js";
import { ALIAS_FOR, WellKnownCategories } from "../source/well_known.js";
import { disposeSharedAddressSpace, sharedAddressSpace, uniqueCategory, uniqueObject, uniqueVariable } from "./helpers.js";

describe("OPC 10000-17: addAlias / removeAlias", () => {
    let addressSpace: AddressSpace;
    let sensor: UAVariable;
    /**
     * A private subcategory of TagVariables, fresh for each test.
     *
     * Isolation comes from the category, not from a new address space: FindAlias
     * and findAlias are both scoped to the category they are given, so aliases
     * added here are invisible to every other test. The clause 9.3 restriction
     * still applies, because it applies to the whole TagVariables hierarchy.
     */
    let tagVariables: UAObject;

    before(async () => {
        addressSpace = await sharedAddressSpace();
    });

    // the address space is created lazily by the first suite that asks for it, so that suite
    // owns it: the leak detector checks the registry when this suite ends.
    after(() => {
        disposeSharedAddressSpace();
    });

    beforeEach(() => {
        sensor = uniqueVariable(addressSpace, "Temperature");
        tagVariables = uniqueCategory(addressSpace, WellKnownCategories.TagVariables, "Tags");
    });

    describe("clause 6.2: the AliasNameType contract", () => {
        it("should use the alias name as the string part of the BrowseName", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            should(alias.browseName.name).eql("TI101");
        });

        it("should give the DisplayName an empty locale and no other locale", () => {
            // "The string part of the BrowseName shall be the DisplayName with an
            // empty locale id and no other locale shall be provided."
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            alias.displayName.should.have.length(1, "exactly one locale");
            should(alias.displayName[0].text).eql("TI101");
            should.not.exist(alias.displayName[0].locale, "the locale must be empty");
        });

        it("should make the DisplayName equal the BrowseName's string part", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            should(alias.displayName[0].text).eql(alias.browseName.name!);
        });

        it("should create at least one AliasFor Reference", () => {
            // "This Object shall have at least one AliasFor Reference (or subtype of)"
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const references = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward);
            references.should.have.length(1);
            references[0].nodeId.toString().should.eql(sensor.nodeId.toString());
        });

        it("should be an instance of AliasNameType", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            should(alias.typeDefinitionObj.browseName.name).eql("AliasNameType");
        });

        it("should be Organized by the category", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            should.exist(findAlias(addressSpace, tagVariables, "TI101"));
            alias.nodeId.toString().should.eql(findAlias(addressSpace, tagVariables, "TI101")!.nodeId.toString());
        });

        it("should offer no rename: a change is a delete then an add, yielding a new NodeId", () => {
            // "The AliasName Object's BrowseName shall not be modified once it is
            // defined [...] The deletion and then addition of an AliasName results
            // in a new NodeId for the AliasName."
            const first = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const firstNodeId = first.nodeId.toString();

            removeAlias(addressSpace, tagVariables, "TI101");
            const second = addAlias(addressSpace, tagVariables, "TI102", sensor);

            second.nodeId.toString().should.not.eql(firstNodeId);
            should.not.exist(findAlias(addressSpace, tagVariables, "TI101"));
        });

        it("should reject an empty alias name", () => {
            should(() => addAlias(addressSpace, tagVariables, "", sensor)).throw(AliasNameError);
        });

        it("should add a second target to an existing name rather than duplicating the node", () => {
            const spare = uniqueVariable(addressSpace, "SpareTemperature");
            const first = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const second = addAlias(addressSpace, tagVariables, "TI101", spare);

            second.nodeId.toString().should.eql(first.nodeId.toString(), "the same AliasName Object");
            first.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(2);
        });

        it("should ignore an exact duplicate of (name, target)", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            addAlias(addressSpace, tagVariables, "TI101", sensor);
            alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(1);
        });
    });

    describe("clause 8.2: the ReferenceType", () => {
        it("should default to AliasFor", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const reference = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)[0];
            reference.referenceType.value.should.eql(ALIAS_FOR.value);
        });

        it("should accept a subtype of AliasFor", () => {
            // a unique name: the address space is shared across the suite
            const subtype = addressSpace.getOwnNamespace().addReferenceType({
                browseName: `AliasForVariant_${tagVariables.browseName.name}`,
                isAbstract: false,
                inverseName: `HasAliasVariant_${tagVariables.browseName.name}`,
                subtypeOf: "AliasFor"
            });
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor, { referenceType: subtype.nodeId });
            const reference = alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)[0];
            reference.referenceType.value.should.eql(subtype.nodeId.value);
        });

        it("should reject a ReferenceType that is not AliasFor or a subtype", () => {
            const organizes = addressSpace.findReferenceType("Organizes")!;
            should(() => addAlias(addressSpace, tagVariables, "TI101", sensor, { referenceType: organizes.nodeId })).throw(
                AliasNameError
            );
        });
    });

    describe("clause 9.3: TagVariables restricts targets to Variables", () => {
        it("should accept a Variable", () => {
            should(() => addAlias(addressSpace, tagVariables, "TI101", sensor)).not.throw();
        });

        it("should reject an Object", () => {
            const object = uniqueObject(addressSpace);
            should(() => addAlias(addressSpace, tagVariables, "TI101", object)).throw(/clause 9.3/);
        });

        it("should apply to a nested vendor subcategory too", () => {
            // "This is the root folder for AliasNameType instances that contain an
            // AliasFor reference to Variables" - the restriction is on the hierarchy
            const wells = uniqueCategory(addressSpace, tagVariables, "Wells");
            const object = uniqueObject(addressSpace);
            should(() => addAlias(addressSpace, wells, "TI101", object)).throw(/clause 9.3/);
        });
    });

    describe("clause 9.4: Topics restricts targets to PublishedDataSetType", () => {
        // a private subcategory of Topics: the restriction applies to the whole
        // Topics hierarchy, so it is enforced here exactly as at the root
        it("should reject a Variable", () => {
            const topics = uniqueCategory(addressSpace, WellKnownCategories.Topics, "Topics");
            should(() => addAlias(addressSpace, topics, "TOPIC1", sensor)).throw(/clause 9.4/);
        });

        it("should accept a PublishedDataSetType instance", () => {
            const topics = uniqueCategory(addressSpace, WellKnownCategories.Topics, "Topics");
            const publishedDataSetType = addressSpace.findObjectType("PublishedDataSetType")!;
            const dataSet = publishedDataSetType.instantiate({
                browseName: `WellDataSet_${topics.browseName.name}`,
                namespace: addressSpace.getOwnNamespace()
            }) as UAObject;
            should(() => addAlias(addressSpace, topics, "TOPIC1", dataSet)).not.throw();
        });
    });

    describe("categories with no restriction", () => {
        it("should let a category outside TagVariables and Topics name any NodeClass", () => {
            const plain = uniqueCategory(addressSpace, WellKnownCategories.Aliases, "Plain");
            const object = uniqueObject(addressSpace);
            should(() => addAlias(addressSpace, plain, "ANY1", object)).not.throw();
        });
    });

    describe("removeAlias", () => {
        it("should report false when the alias is not there", () => {
            removeAlias(addressSpace, tagVariables, "NOPE").should.eql(false);
        });

        it("should delete the AliasNameType node when no target is given", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const nodeId = alias.nodeId;
            removeAlias(addressSpace, tagVariables, "TI101").should.eql(true);
            should.not.exist(addressSpace.findNode(nodeId));
        });

        it("should remove one target and keep the alias when others remain", () => {
            const spare = uniqueVariable(addressSpace, "SpareTemperature");
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            addAlias(addressSpace, tagVariables, "TI101", spare);

            removeAlias(addressSpace, tagVariables, "TI101", sensor).should.eql(true);

            should.exist(addressSpace.findNode(alias.nodeId), "the alias still names the spare");
            alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(1);
        });

        it("should delete the alias when its last target goes (clause 7.2)", () => {
            // "It will always have at least one entry in the ReferencedNodes array"
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor);
            const nodeId = alias.nodeId;
            removeAlias(addressSpace, tagVariables, "TI101", sensor).should.eql(true);
            should.not.exist(addressSpace.findNode(nodeId));
        });

        it("should report false for a target the alias does not name", () => {
            const other = uniqueVariable(addressSpace, "Other");
            addAlias(addressSpace, tagVariables, "TI101", sensor);
            removeAlias(addressSpace, tagVariables, "TI101", other).should.eql(false);
        });
    });

    describe("input coercion", () => {
        it("should accept a category given by NodeId", () => {
            // by NodeId rather than by node object; still a private category
            const alias = addAlias(addressSpace, tagVariables.nodeId, "TI101", sensor);
            should(alias.browseName.name).eql("TI101");
        });

        it("should accept a target given by NodeId", () => {
            const alias = addAlias(addressSpace, tagVariables, "TI101", sensor.nodeId);
            alias.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)[0].nodeId.toString().should.eql(sensor.nodeId.toString());
        });

        it("should reject a target NodeId that does not exist", () => {
            const missing = new NodeId(NodeIdType.NUMERIC, 999999, addressSpace.getOwnNamespace().index);
            should.not.exist(addressSpace.findNode(missing), "precondition: the Node really is absent");
            should(() => addAlias(addressSpace, tagVariables, "TI101", missing)).throw(AliasNameError);
        });

        it("should reject a category that is not an AliasNameCategoryType instance", () => {
            const notACategory = uniqueObject(addressSpace, "NotACategory");
            should(() => addAlias(addressSpace, notACategory.nodeId, "TI101", sensor)).throw(AliasNameError);
        });
    });
});
