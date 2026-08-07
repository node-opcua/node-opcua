import "mocha";
import type { AddressSpace, UAObject } from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { addAlias } from "../source/add_alias.js";
import { installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";
import { WellKnownCategories, WellKnownOptionalMethods } from "../source/well_known.js";
import { aliasNames, callFind, getMethod, getObject, makeAddressSpace, resultAliases } from "./helpers.js";

describe("OPC 10000-17: installAliasNames", () => {
    let addressSpace: AddressSpace;

    beforeEach(async () => {
        addressSpace = await makeAddressSpace();
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    describe("the conformance gap it closes", () => {
        it("should leave FindAlias unbound before installation", () => {
            const aliases = getObject(addressSpace, WellKnownCategories.Aliases);
            const findAlias = getMethod(aliases, "FindAlias");
            should.exist(findAlias, "the standard nodeset models a mandatory FindAlias");
            findAlias!.isBound().should.eql(false, "this is the defect being fixed");
        });

        it("should bind FindAlias on the three well-known categories", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            for (const nodeId of Object.values(WellKnownCategories)) {
                const category = getObject(addressSpace, nodeId);
                const findAlias = getMethod(category, "FindAlias");
                should.exist(findAlias, `${category.browseName.toString()} should have FindAlias`);
                findAlias!.isBound().should.eql(true, `${category.browseName.toString()}.FindAlias should be bound`);
            }
        });

        it("should answer FindAlias with no options at all", async () => {
            // the headline: a Server that loads the standard nodeset and calls
            // installAliasNames(server) answers the mandatory Method correctly
            await installAliasNamesOnAddressSpace(addressSpace);
            const result = await callFind(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
        });
    });

    describe("idempotency", () => {
        it("should report installed on the first call and not on the second", async () => {
            const first = await installAliasNamesOnAddressSpace(addressSpace);
            first.installed.should.eql(true);
            const second = await installAliasNamesOnAddressSpace(addressSpace);
            second.installed.should.eql(false);
        });

        it("should return the same store on a repeated call", async () => {
            const first = await installAliasNamesOnAddressSpace(addressSpace);
            const second = await installAliasNamesOnAddressSpace(addressSpace);
            second.store.should.equal(first.store);
        });

        it("should not create a second FindAliasVerbose on a repeated call", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const aliases = getObject(addressSpace, WellKnownCategories.Aliases);
            const before = aliases.getComponents().filter((c) => c.browseName.name === "FindAliasVerbose").length;
            await installAliasNamesOnAddressSpace(addressSpace);
            const after = aliases.getComponents().filter((c) => c.browseName.name === "FindAliasVerbose").length;
            after.should.eql(before);
            after.should.eql(1);
        });
    });

    describe("well-known categories are resolved by NodeId", () => {
        it("should find all three even though none is located by BrowseName", async () => {
            const result = await installAliasNamesOnAddressSpace(addressSpace);
            for (const nodeId of Object.values(WellKnownCategories)) {
                result.categories.some((c) => sameNodeId(c, nodeId)).should.eql(true, `${nodeId.toString()} should be bound`);
            }
        });

        it("should refuse to install on an address space without the Aliases Object", async () => {
            const bare = addressSpace;
            bare.deleteNode(WellKnownCategories.Aliases);
            await installAliasNamesOnAddressSpace(bare).should.be.rejectedWith(/Aliases Object/);
        });
    });

    describe("FindAliasVerbose instantiation (clause 6.3.3)", () => {
        it("should not be present in the shipped nodeset", () => {
            const aliases = getObject(addressSpace, WellKnownCategories.Aliases);
            should.not.exist(getMethod(aliases, "FindAliasVerbose"));
        });

        it("should be added by default", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            for (const nodeId of Object.values(WellKnownCategories)) {
                const category = getObject(addressSpace, nodeId);
                should.exist(getMethod(category, "FindAliasVerbose"), `${category.browseName.toString()}`);
            }
        });

        it("should use the NodeId the specification reserves for it", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const cases = [
                [WellKnownCategories.Aliases, WellKnownOptionalMethods.Aliases.FindAliasVerbose],
                [WellKnownCategories.TagVariables, WellKnownOptionalMethods.TagVariables.FindAliasVerbose],
                [WellKnownCategories.Topics, WellKnownOptionalMethods.Topics.FindAliasVerbose]
            ] as const;
            for (const [categoryId, expectedMethodId] of cases) {
                const method = getMethod(getObject(addressSpace, categoryId), "FindAliasVerbose");
                sameNodeId(method!.nodeId, expectedMethodId).should.eql(
                    true,
                    `expected ${expectedMethodId.toString()}, got ${method!.nodeId.toString()}`
                );
            }
        });

        it("should carry the InputArguments and OutputArguments of the declaration", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const method = getMethod(getObject(addressSpace, WellKnownCategories.Aliases), "FindAliasVerbose");
            method!.getInputArguments().should.have.length(2);
            method!.getOutputArguments().should.have.length(1);
        });

        it("should be omitted when verbose is false", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, { verbose: false });
            const aliases = getObject(addressSpace, WellKnownCategories.Aliases);
            should.not.exist(getMethod(aliases, "FindAliasVerbose"));
        });
    });

    describe("configuration Methods", () => {
        it("should be off by default, so the write surface does not appear", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const aliases = getObject(addressSpace, WellKnownCategories.Aliases);
            should.not.exist(getMethod(aliases, "AddAliasesToCategory"));
            should.not.exist(getMethod(aliases, "DeleteAliasesFromCategory"));
        });

        it("should say plainly that they are not implemented yet when asked for", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, { configurationMethods: true }).should.be.rejectedWith(
                /not implemented yet/
            );
        });
    });

    describe("vendor subcategories", () => {
        /** Create a vendor AliasNameCategoryType instance under `parent`. */
        function addCategory(parent: UAObject, name: string): UAObject {
            const categoryType = addressSpace.findObjectType("AliasNameCategoryType")!;
            return categoryType.instantiate({
                browseName: name,
                organizedBy: parent,
                namespace: addressSpace.getOwnNamespace()
            }) as UAObject;
        }

        it("should bind FindAlias on a vendor subcategory too", async () => {
            const tagVariables = getObject(addressSpace, WellKnownCategories.TagVariables);
            const wells = addCategory(tagVariables, "Wells");
            await installAliasNamesOnAddressSpace(addressSpace);

            const findAlias = getMethod(wells, "FindAlias");
            should.exist(findAlias, "a vendor subcategory has a mandatory FindAlias too");
            findAlias!.isBound().should.eql(true);
        });

        it("should give a vendor subcategory a server-assigned FindAliasVerbose NodeId", async () => {
            const tagVariables = getObject(addressSpace, WellKnownCategories.TagVariables);
            const wells = addCategory(tagVariables, "Wells");
            await installAliasNamesOnAddressSpace(addressSpace);

            const method = getMethod(wells, "FindAliasVerbose");
            should.exist(method);
            // no NodeId is reserved for a vendor category, so it gets one of ours
            method!.nodeId.namespace.should.not.eql(0);
        });

        it("should not discover a category outside the Aliases hierarchy", async () => {
            // clause 9.1 puts vendor categories under the Aliases hierarchy, and
            // the address space keeps no inverse HasTypeDefinition reference, so
            // there is nothing to sweep. Documented, not silently ignored.
            const objects = addressSpace.rootFolder.objects;
            const orphan = addCategory(objects as UAObject, "OrphanCategory");
            const result = await installAliasNamesOnAddressSpace(addressSpace);

            result.categories.some((c) => sameNodeId(c, orphan.nodeId)).should.eql(false);
        });

        it("should bind a category outside the hierarchy when it is named explicitly", async () => {
            const objects = addressSpace.rootFolder.objects;
            const orphan = addCategory(objects as UAObject, "OrphanCategory");
            const result = await installAliasNamesOnAddressSpace(addressSpace, {
                additionalCategoryRoots: [orphan.nodeId]
            });

            result.categories.some((c) => sameNodeId(c, orphan.nodeId)).should.eql(true);
            getMethod(orphan, "FindAlias")!.isBound().should.eql(true);
        });
    });

    describe("the default AddressSpaceAliasStore", () => {
        it("should answer from aliases modelled in the address space, with no store injected", async () => {
            const ns = addressSpace.getOwnNamespace();
            const sensor = ns.addVariable({
                browseName: "Temperature",
                dataType: "Double",
                organizedBy: addressSpace.rootFolder.objects
            });
            addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", sensor);

            await installAliasNamesOnAddressSpace(addressSpace);
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "TI101");

            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["TI101"]);
            const entry = resultAliases(result)[0];
            entry.referencedNodes!.should.have.length(1);
            entry.referencedNodes![0].value.should.eql(sensor.nodeId.value);
        });

        it("should be replaceable by an injected store", async () => {
            const injected = {
                find: () => [],
                lastChange: () => 0
            };
            const result = await installAliasNamesOnAddressSpace(addressSpace, { store: injected });
            result.store.should.equal(injected);
        });
    });
});
