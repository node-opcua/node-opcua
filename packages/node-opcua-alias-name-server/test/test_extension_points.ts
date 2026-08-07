import "mocha";
import type { AddressSpace, UAObject, UAVariable } from "node-opcua-address-space";
import type { ISessionContext } from "node-opcua-address-space-base";
import type { IAliasStore } from "node-opcua-alias-name-common";
import { NodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { addAlias } from "../source/add_alias.js";
import { addAliasCategory, bindAliasCategory, getInstalledAliasNames } from "../source/bind_alias_category.js";
import { DEFAULT_MAX_RESULTS, installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";
import { WellKnownCategories } from "../source/well_known.js";
import { aliasNames, callFind, getMethod, getObject, makeAddressSpace, resultAliases } from "./helpers.js";

/**
 * The injection points an advanced Server needs: a GDS, an aggregating Server,
 * or a vendor Server whose categories are created per customer at runtime.
 */
describe("OPC 10000-17: extension points", () => {
    let addressSpace: AddressSpace;

    beforeEach(async () => {
        addressSpace = await makeAddressSpace();
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    describe("addAliasCategory", () => {
        it("should create a category and bind it in one step", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");

            getMethod(wells, "FindAlias")!.isBound().should.eql(true);
            getMethod(wells, "FindAliasVerbose")!.isBound().should.eql(true);
        });

        it("should answer FindAlias on a category created after installation", async () => {
            // an unbound MANDATORY FindAlias is the defect this package removes;
            // it must not be able to reappear at runtime
            await installAliasNamesOnAddressSpace(addressSpace);
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "WellHeadPressure", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, wells, "PT-301", sensor);

            const result = await callFind(wells, "FindAlias", "PT%");
            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["PT-301"]);
        });

        it("should be reachable from a recursive search on Aliases", async () => {
            await installAliasNamesOnAddressSpace(addressSpace);
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            const sensor = addressSpace.getOwnNamespace().addVariable({ browseName: "P", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, wells, "PT-301", sensor);

            const result = await callFind(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias", "PT-301");
            aliasNames(result).should.eql(["PT-301"]);
        });

        it("should reuse the options installation was given", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, { maxResults: 1 });
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            const ns = addressSpace.getOwnNamespace();
            for (let i = 0; i < 3; i++) {
                const v = ns.addVariable({ browseName: `V${i}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, wells, `TAG${i}`, v);
            }
            // the late category inherits maxResults: 1, not the default
            const result = await callFind(wells, "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadResponseTooLarge);
        });

        it("should let an explicit option override the inherited one", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, { maxResults: 1 });
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells", { maxResults: 10 });
            const ns = addressSpace.getOwnNamespace();
            for (let i = 0; i < 3; i++) {
                const v = ns.addVariable({ browseName: `V${i}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, wells, `TAG${i}`, v);
            }
            const result = await callFind(wells, "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            resultAliases(result).should.have.length(3);
        });

        it("should create an unbound category when installation has not run", async () => {
            // nothing to bind against yet; installAliasNames picks it up later
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            getMethod(wells, "FindAlias")!.isBound().should.eql(false);

            await installAliasNamesOnAddressSpace(addressSpace);
            getMethod(wells, "FindAlias")!.isBound().should.eql(true);
        });

        it("should use a server-assigned NodeId by default and honour an explicit one", () => {
            const auto = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Auto");
            auto.nodeId.namespace.should.not.eql(0);

            const explicitId = new NodeId(NodeIdType.NUMERIC, 987654, addressSpace.getOwnNamespace().index);
            const chosen = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Explicit", {
                nodeId: explicitId
            });
            sameNodeId(chosen.nodeId, explicitId).should.eql(true);
        });
    });

    describe("bindAliasCategory", () => {
        it("should bind a category built by hand", async () => {
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const categoryType = addressSpace.findObjectType("AliasNameCategoryType")!;
            const handmade = categoryType.instantiate({
                browseName: "HandMade",
                organizedBy: getObject(addressSpace, WellKnownCategories.TagVariables),
                namespace: addressSpace.getOwnNamespace()
            }) as UAObject;

            getMethod(handmade, "FindAlias")!.isBound().should.eql(false);
            bindAliasCategory(addressSpace, handmade, installed.bindingOptions);
            getMethod(handmade, "FindAlias")!.isBound().should.eql(true);
        });

        it("should add FindAliasVerbose, which cannot be hand-rolled", async () => {
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const categoryType = addressSpace.findObjectType("AliasNameCategoryType")!;
            const handmade = categoryType.instantiate({
                browseName: "HandMade",
                organizedBy: getObject(addressSpace, WellKnownCategories.TagVariables),
                namespace: addressSpace.getOwnNamespace()
            }) as UAObject;

            should.not.exist(getMethod(handmade, "FindAliasVerbose"));
            bindAliasCategory(addressSpace, handmade, installed.bindingOptions);
            getMethod(handmade, "FindAliasVerbose")!.isBound().should.eql(true);
        });

        it("should be safe to call twice", async () => {
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const category = getObject(addressSpace, WellKnownCategories.TagVariables);
            bindAliasCategory(addressSpace, category, installed.bindingOptions);
            bindAliasCategory(addressSpace, category, installed.bindingOptions);

            category.getComponents().filter((c) => c.browseName.name === "FindAliasVerbose").should.have.length(1);
            const result = await callFind(category, "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
        });
    });

    describe("InstallAliasNamesResult.bindingOptions", () => {
        it("should expose what every category was bound with", async () => {
            const store: IAliasStore = { find: () => [], lastChange: () => 0 };
            const installed = await installAliasNamesOnAddressSpace(addressSpace, { store, maxResults: 42, verbose: false });
            installed.bindingOptions.store.should.equal(store);
            installed.bindingOptions.maxResults.should.eql(42);
            installed.bindingOptions.verbose!.should.eql(false);
        });

        it("should be readable from the address space afterwards", async () => {
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const recovered = getInstalledAliasNames(addressSpace);
            should.exist(recovered);
            recovered!.store.should.equal(installed.store);
        });

        it("should report undefined before installation", () => {
            should.not.exist(getInstalledAliasNames(addressSpace));
        });

        it("should agree with the fallback used when nothing is installed", () => {
            // addAliasCategory keeps a local copy to avoid a circular import
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells", {
                store: { find: () => [], lastChange: () => 0 }
            });
            should.exist(getMethod(wells, "FindAlias"));
            DEFAULT_MAX_RESULTS.should.eql(1000);
        });
    });

    describe("discoverCategories", () => {
        it("should replace discovery entirely", async () => {
            const tagVariables = getObject(addressSpace, WellKnownCategories.TagVariables);
            const result = await installAliasNamesOnAddressSpace(addressSpace, {
                discoverCategories: () => [tagVariables]
            });

            result.categories.should.have.length(1);
            sameNodeId(result.categories[0], WellKnownCategories.TagVariables).should.eql(true);
            // Aliases was not in the supplied set, so it stays unbound
            getMethod(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias")!.isBound().should.eql(false);
        });

        it("should receive the address space", async () => {
            let seen: AddressSpace | null = null;
            await installAliasNamesOnAddressSpace(addressSpace, {
                discoverCategories: (space) => {
                    seen = space as AddressSpace;
                    return [];
                }
            });
            should(seen).equal(addressSpace);
        });
    });

    describe("isReadAllowed", () => {
        it("should receive the category the Method was called on", async () => {
            const seen: NodeId[] = [];
            await installAliasNamesOnAddressSpace(addressSpace, {
                isReadAllowed: (_context: ISessionContext, categoryNodeId: NodeId) => {
                    seen.push(categoryNodeId);
                    return true;
                }
            });
            await callFind(getObject(addressSpace, WellKnownCategories.Topics), "FindAlias", "%");

            seen.should.have.length(1);
            sameNodeId(seen[0], WellKnownCategories.Topics).should.eql(true);
        });

        it("should be able to gate one category and allow another", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, {
                isReadAllowed: (_context: ISessionContext, categoryNodeId: NodeId) =>
                    !sameNodeId(categoryNodeId, WellKnownCategories.Topics)
            });

            const denied = await callFind(getObject(addressSpace, WellKnownCategories.Topics), "FindAlias", "%");
            denied.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);

            const allowed = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");
            allowed.statusCode!.should.eql(StatusCodes.Good);
        });

        it("should await a Promise, for permissions that live in a database", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, {
                isReadAllowed: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return false;
                }
            });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
        });
    });

    describe("options that are declared but not implemented", () => {
        it("should refuse persistencePath rather than silently ignoring it", async () => {
            // a Server that believes LastChange is persisted has a defect
            // visible in every connected Client
            await installAliasNamesOnAddressSpace(addressSpace, {
                persistencePath: "./aliases.bin"
            }).should.be.rejectedWith(/persistencePath is not implemented yet/);
        });

        it("should refuse configurationMethods rather than exposing nothing", async () => {
            await installAliasNamesOnAddressSpace(addressSpace, { configurationMethods: true }).should.be.rejectedWith(
                /configurationMethods is not implemented yet/
            );
        });
    });
});
