import "mocha";
import type { AddressSpace, UAObject, UAVariable } from "node-opcua-address-space";
import type { ISessionContext } from "node-opcua-address-space-base";
import type { IAliasStore } from "node-opcua-alias-name-common";
import { NodeId, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType } from "node-opcua-types";
import should from "should";
import { addAlias } from "../source/add_alias.js";
import { AddressSpaceAliasStore } from "../source/address_space_alias_store.js";
import {
    addAliasCategory,
    bindAliasCategory,
    getInstalledAliasNames,
    removeAliasCategory
} from "../source/bind_alias_category.js";
import {
    ALIAS_SERVER_CAPABILITY_ID,
    DEFAULT_MAX_RESULTS,
    advertiseAliasCapability,
    installAliasNames,
    installAliasNamesOnAddressSpace
} from "../source/install_alias_names.js";
import { WellKnownCategories } from "../source/well_known.js";
import { aliasNames, callFind, getMethod, getObject, makeAddressSpace, resultAliases, resultVerbose } from "./helpers.js";

/**
 * The injection points an advanced Server needs: a GDS, an aggregating Server,
 * or a vendor Server whose categories are created per customer at runtime.
 */
describe("OPC 10000-17: extension points", () => {
    /**
     * A pristine address space, disposed after the test.
     *
     * Most tests here install with their own options, and installation is once
     * per address space, so they cannot share a fixture. Loading the standard
     * nodeset costs roughly a second, so tests that only need a
     * default-installed address space use the shared one below and isolate
     * themselves with uniquely named categories.
     */
    const pristineSpaces: AddressSpace[] = [];
    async function pristine(): Promise<AddressSpace> {
        const space = await makeAddressSpace();
        pristineSpaces.push(space);
        return space;
    }
    afterEach(() => {
        while (pristineSpaces.length) {
            pristineSpaces.pop()!.dispose();
        }
    });

    /** Installed once with default options; tests here only add to it. */
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await makeAddressSpace();
        await installAliasNamesOnAddressSpace(addressSpace);
    });
    after(() => addressSpace.dispose());

    describe("addAliasCategory", () => {
        it("should create a category and bind it in one step", () => {
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "WellsBind");

            getMethod(wells, "FindAlias")!.isBound().should.eql(true);
            getMethod(wells, "FindAliasVerbose")!.isBound().should.eql(true);
        });

        it("should answer FindAlias on a category created after installation", async () => {
            // an unbound MANDATORY FindAlias is the defect this package removes;
            // it must not be able to reappear at runtime
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "WellsAnswer");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "WellHeadPressureAnswer", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, wells, "PT-301", sensor);

            const result = await callFind(wells, "FindAlias", "PT%");
            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["PT-301"]);
        });

        it("should be reachable from a recursive search on Aliases", async () => {
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "WellsRecursive");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "PRecursive", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, wells, "PT-777", sensor);

            const result = await callFind(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias", "PT-777");
            aliasNames(result).should.eql(["PT-777"]);
        });

        it("should reuse the options installation was given", async () => {
            const addressSpace = await pristine();
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
            const addressSpace = await pristine();
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
            const addressSpace = await pristine();
            // nothing to bind against yet; installAliasNames picks it up later
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            getMethod(wells, "FindAlias")!.isBound().should.eql(false);

            await installAliasNamesOnAddressSpace(addressSpace);
            getMethod(wells, "FindAlias")!.isBound().should.eql(true);
        });

        it("should derive a stable, readable NodeId from the category's path", () => {
            // an auto-increment numeric id would move whenever an unrelated Node
            // is created first, which silently breaks LastChange persistence --
            // it keys on the category NodeId
            const auto = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "AutoId");
            auto.nodeId.namespace.should.not.eql(0);
            auto.nodeId.value.should.eql("Aliases/TagVariables/AutoId");

            const explicitId = new NodeId(NodeIdType.NUMERIC, 987654, addressSpace.getOwnNamespace().index);
            const chosen = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "ExplicitId", {
                nodeId: explicitId
            });
            sameNodeId(chosen.nodeId, explicitId).should.eql(true);
        });

        it("should give the same category the same NodeId on every run", async () => {
            // the property LastChange persistence depends on
            const first = await pristine();
            await installAliasNamesOnAddressSpace(first);
            const a = addAliasCategory(first, WellKnownCategories.TagVariables, "Unit200");

            // a second Server that happens to create an unrelated Node first
            const second = await pristine();
            await installAliasNamesOnAddressSpace(second);
            second.getOwnNamespace().addVariable({ browseName: "SomethingElse", dataType: "Double" });
            const b = addAliasCategory(second, WellKnownCategories.TagVariables, "Unit200");

            b.nodeId.toString().should.eql(a.nodeId.toString(), "an auto-increment id would have shifted");
        });

        it("should nest the path for a category inside another", () => {
            const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "NestPath");
            const child = addAliasCategory(addressSpace, parent, "Deep");
            child.nodeId.value.should.eql("Aliases/TagVariables/NestPath/Deep");
        });

        it("should refuse a duplicate rather than silently making a different node", () => {
            addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "DupCat");
            should(() => addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "DupCat")).throw(
                /already exists/
            );
        });
    });

    describe("bindAliasCategory", () => {
        it("should bind a category built by hand", async () => {
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const categoryType = addressSpace.findObjectType("AliasNameCategoryType")!;
            const handmade = categoryType.instantiate({
                browseName: "HandMadeBind",
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
                browseName: "HandMadeVerbose",
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
            const addressSpace = await pristine();
            const store: IAliasStore = { find: () => [], lastChange: () => 0 };
            const installed = await installAliasNamesOnAddressSpace(addressSpace, { store, maxResults: 42, verbose: false });
            installed.bindingOptions.store.should.equal(store);
            installed.bindingOptions.maxResults.should.eql(42);
            installed.bindingOptions.verbose!.should.eql(false);
        });

        it("should be readable from the address space afterwards", async () => {
            const addressSpace = await pristine();
            const installed = await installAliasNamesOnAddressSpace(addressSpace);
            const recovered = getInstalledAliasNames(addressSpace);
            should.exist(recovered);
            recovered!.store.should.equal(installed.store);
        });

        it("should report undefined before installation", async () => {
            const addressSpace = await pristine();
            should.not.exist(getInstalledAliasNames(addressSpace));
        });

        it("should fall back to DEFAULT_MAX_RESULTS when a category is bound before installation", async () => {
            const addressSpace = await pristine();
            // a store is supplied but no cap, and nothing is installed to inherit
            // one from, so the shared default applies
            const store: IAliasStore = { find: () => [], lastChange: () => 0 };
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells", { store });

            getMethod(wells, "FindAlias")!.isBound().should.eql(true);
            const result = await callFind(wells, "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            DEFAULT_MAX_RESULTS.should.be.above(0);
        });
    });

    describe("categoryProvider", () => {
        it("should replace discovery entirely", async () => {
            const addressSpace = await pristine();
            const tagVariables = getObject(addressSpace, WellKnownCategories.TagVariables);
            const result = await installAliasNamesOnAddressSpace(addressSpace, {
                categoryProvider: () => [tagVariables]
            });

            result.categories.should.have.length(1);
            sameNodeId(result.categories[0], WellKnownCategories.TagVariables).should.eql(true);
            // Aliases was not in the supplied set, so it stays unbound
            getMethod(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias")!.isBound().should.eql(false);
        });

        it("should receive the address space", async () => {
            const addressSpace = await pristine();
            let seen: AddressSpace | null = null;
            await installAliasNamesOnAddressSpace(addressSpace, {
                categoryProvider: (space) => {
                    seen = space as AddressSpace;
                    return [];
                }
            });
            should(seen).equal(addressSpace);
        });
    });

    describe("isReadAllowed", () => {
        it("should receive the category the Method was called on", async () => {
            const addressSpace = await pristine();
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
            const addressSpace = await pristine();
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
            const addressSpace = await pristine();
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

    describe("the read gate during a recursive search", () => {
        it("should omit a denied category from a recursive search and still return Good", async () => {
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const open = addAliasCategory(space, WellKnownCategories.TagVariables, "Open");
            const secret = addAliasCategory(space, WellKnownCategories.TagVariables, "Secret");
            addAlias(space, open, "OPEN-1", ns.addVariable({ browseName: "OpenVar", dataType: "Double" }));
            addAlias(space, secret, "SECRET-1", ns.addVariable({ browseName: "SecretVar", dataType: "Double" }));
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => !sameNodeId(categoryNodeId, secret.nodeId)
            });

            const result = await callFind(getObject(space, WellKnownCategories.TagVariables), "FindAlias", "%");

            result.statusCode!.should.eql(StatusCodes.Good, "denial is not an error");
            aliasNames(result).should.eql(["OPEN-1"], "the denied category contributes nothing, and nothing says so");
        });

        it("should consult the gate per category, not once for the call", async () => {
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const a = addAliasCategory(space, WellKnownCategories.TagVariables, "TenantA");
            const b = addAliasCategory(space, WellKnownCategories.TagVariables, "TenantB");
            addAlias(space, a, "A-1", ns.addVariable({ browseName: "AVar", dataType: "Double" }));
            addAlias(space, b, "B-1", ns.addVariable({ browseName: "BVar", dataType: "Double" }));

            const asked: string[] = [];
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => {
                    asked.push(categoryNodeId.toString());
                    return !sameNodeId(categoryNodeId, b.nodeId);
                }
            });

            const result = await callFind(getObject(space, WellKnownCategories.TagVariables), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["A-1"]);

            // the gate saw both nested categories, not just the one called on
            asked.should.containEql(a.nodeId.toString());
            asked.should.containEql(b.nodeId.toString());
        });

        it("should ask about each category at most once per call", async () => {
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const cat = addAliasCategory(space, WellKnownCategories.TagVariables, "ManyAliases");
            for (let i = 0; i < 5; i++) {
                addAlias(space, cat, `M-${i}`, ns.addVariable({ browseName: `MVar${i}`, dataType: "Double" }));
            }
            const asked: string[] = [];
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => {
                    asked.push(categoryNodeId.toString());
                    return true;
                }
            });
            await callFind(cat, "FindAlias", "%");
            // five aliases in one category, but the rule may hit a database
            asked.filter((id) => id === cat.nodeId.toString()).should.have.length(1);
        });

        it("should return Bad_UserAccessDenied on a direct call to a denied category", async () => {
            // nothing left to filter, so silence would be a lie
            const space = await pristine();
            const denied = addAliasCategory(space, WellKnownCategories.TagVariables, "DeniedDirect");
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => !sameNodeId(categoryNodeId, denied.nodeId)
            });
            const result = await callFind(denied, "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
        });

        it("should not let FindAliasVerbose disclose more than FindAlias", async () => {
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const open = addAliasCategory(space, WellKnownCategories.TagVariables, "VOpen");
            const secret = addAliasCategory(space, WellKnownCategories.TagVariables, "VSecret");
            addAlias(space, open, "V-OPEN", ns.addVariable({ browseName: "VOpenVar", dataType: "Double" }));
            addAlias(space, secret, "V-SECRET", ns.addVariable({ browseName: "VSecretVar", dataType: "Double" }));
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => !sameNodeId(categoryNodeId, secret.nodeId)
            });

            const tagVariables = getObject(space, WellKnownCategories.TagVariables);
            const verbose = await callFind(tagVariables, "FindAliasVerbose", "%");
            verbose.statusCode!.should.eql(StatusCodes.Good);

            const entries = resultVerbose(verbose);
            entries.map((e) => e.aliasName.name).should.eql(["V-OPEN"]);
            // no AliasNameCategoryId and no ServerUris for the hidden category
            entries.every((e) => !sameNodeId(e.aliasNameCategoryId, secret.nodeId)).should.eql(true);
        });

        it("should not spend the result cap on entries the caller may not see", async () => {
            // The repro: 2 visible aliases, 50 gated out, maxResults 10.
            // Counting the invisible 50 toward the cap makes a root-level search
            // permanently useless for a gated caller, and the only workaround --
            // "search your own category" -- needs the knowledge the gate hides.
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const mine = addAliasCategory(space, WellKnownCategories.TagVariables, "TenantA");
            const theirs = addAliasCategory(space, WellKnownCategories.TagVariables, "TenantB");
            addAlias(space, mine, "MINE-1", ns.addVariable({ browseName: "Mine1", dataType: "Double" }));
            addAlias(space, mine, "MINE-2", ns.addVariable({ browseName: "Mine2", dataType: "Double" }));
            for (let i = 0; i < 50; i++) {
                addAlias(space, theirs, `THEIRS-${i}`, ns.addVariable({ browseName: `Theirs${i}`, dataType: "Double" }));
            }
            await installAliasNamesOnAddressSpace(space, {
                maxResults: 10,
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => !sameNodeId(categoryNodeId, theirs.nodeId)
            });

            const result = await callFind(getObject(space, WellKnownCategories.Aliases), "FindAlias", "%");

            result.statusCode!.should.eql(StatusCodes.Good, "the other tenant's rows must not exhaust the cap");
            aliasNames(result).should.eql(["MINE-1", "MINE-2"]);
        });

        it("should still report Bad_ResponseTooLarge when the visible entries exceed the cap", async () => {
            // the cap still means something: "there are more than you can be
            // shown", which discloses nothing about who owns them
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const mine = addAliasCategory(space, WellKnownCategories.TagVariables, "AllMine");
            for (let i = 0; i < 20; i++) {
                addAlias(space, mine, `MINE-${i}`, ns.addVariable({ browseName: `AllMine${i}`, dataType: "Double" }));
            }
            await installAliasNamesOnAddressSpace(space, {
                maxResults: 10,
                isReadAllowed: () => true
            });

            const result = await callFind(getObject(space, WellKnownCategories.Aliases), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadResponseTooLarge);
        });

        it("should not leak through a store that ignores isVisible", async () => {
            // the handler's filter is a backstop, not decoration: an injected
            // store may ignore the predicate, and the cost of that must be a
            // wasted scan rather than a disclosure
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const open = addAliasCategory(space, WellKnownCategories.TagVariables, "IgnOpen");
            const secret = addAliasCategory(space, WellKnownCategories.TagVariables, "IgnSecret");
            addAlias(space, open, "IGN-OPEN", ns.addVariable({ browseName: "IgnOpenVar", dataType: "Double" }));
            addAlias(space, secret, "IGN-SECRET", ns.addVariable({ browseName: "IgnSecretVar", dataType: "Double" }));

            const inner = new AddressSpaceAliasStore(space);
            const ignoresVisibility: IAliasStore = {
                // deliberately drops isVisible
                find: (query) => inner.find({ ...query, isVisible: undefined }),
                lastChange: () => 0
            };

            await installAliasNamesOnAddressSpace(space, {
                store: ignoresVisibility,
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => !sameNodeId(categoryNodeId, secret.nodeId)
            });

            const result = await callFind(getObject(space, WellKnownCategories.TagVariables), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["IGN-OPEN"], "the backstop still removes the hidden category");
        });

        it("should evaluate the rule at most once per category even though the store also asks", async () => {
            // the store is handed the handler's memoised closure, so honouring
            // the predicate must not double the number of evaluations
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const a = addAliasCategory(space, WellKnownCategories.TagVariables, "OnceA");
            const b = addAliasCategory(space, WellKnownCategories.TagVariables, "OnceB");
            for (let i = 0; i < 4; i++) {
                addAlias(space, a, `OA-${i}`, ns.addVariable({ browseName: `OAVar${i}`, dataType: "Double" }));
                addAlias(space, b, `OB-${i}`, ns.addVariable({ browseName: `OBVar${i}`, dataType: "Double" }));
            }
            const asked: string[] = [];
            await installAliasNamesOnAddressSpace(space, {
                isReadAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => {
                    asked.push(categoryNodeId.toString());
                    return true;
                }
            });

            await callFind(getObject(space, WellKnownCategories.TagVariables), "FindAlias", "%");

            for (const categoryNodeId of new Set(asked)) {
                asked.filter((id) => id === categoryNodeId).should.have.length(1, `asked more than once for ${categoryNodeId}`);
            }
        });

        it("should allow everything by default, so a publisher is unaffected", async () => {
            const space = await pristine();
            const ns = space.getOwnNamespace();
            const cat = addAliasCategory(space, WellKnownCategories.TagVariables, "Ungated");
            addAlias(space, cat, "U-1", ns.addVariable({ browseName: "UVar", dataType: "Double" }));
            await installAliasNamesOnAddressSpace(space);
            const result = await callFind(getObject(space, WellKnownCategories.TagVariables), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            aliasNames(result).should.eql(["U-1"]);
        });
    });

    describe("addAliasCategory options", () => {
        it("should accept a subtype of AliasNameCategoryType", () => {
            const ns = addressSpace.getOwnNamespace();
            const subtype = ns.addObjectType({
                browseName: "TenantCategoryType",
                subtypeOf: addressSpace.findObjectType("AliasNameCategoryType")!
            });
            const category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "SubtypedCat", {
                categoryType: subtype
            });

            category.typeDefinitionObj.browseName.name!.should.eql("TenantCategoryType");
            getMethod(category, "FindAlias")!.isBound().should.eql(true, "binding handles subtypes");
        });

        it("should reject a type that is not an AliasNameCategoryType", () => {
            const baseObjectType = addressSpace.findObjectType("BaseObjectType")!;
            should(() =>
                addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "BadType", {
                    categoryType: baseObjectType
                })
            ).throw(/not AliasNameCategoryType or a subtype/);
        });

        it("should apply rolePermissions when given", () => {
            const category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "WithPermissions", {
                rolePermissions: [{ roleId: resolveNodeId("i=15644"), permissions: PermissionType.Browse }]
            });
            should.exist(category.rolePermissions);
            category.rolePermissions!.should.have.length(1);
        });
    });

    describe("removeAliasCategory", () => {
        it("should re-parent what the category organises by default", () => {
            const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "RemoveParent");
            const doomed = addAliasCategory(addressSpace, parent, "Doomed");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "SurvivingVar", dataType: "Double" }) as UAVariable;
            const alias = addAlias(addressSpace, doomed, "SURV-1", sensor);

            const { moved, deleted } = removeAliasCategory(addressSpace, doomed);

            deleted.should.have.length(0);
            moved.some((id) => sameNodeId(id, alias.nodeId)).should.eql(true);
            should.exist(addressSpace.findNode(alias.nodeId), "the alias keeps its NodeId, so clients keep resolving it");
            should.not.exist(addressSpace.findNode(doomed.nodeId));
        });

        it("should still find a re-parented alias through the parent", async () => {
            const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "RemoveParent2");
            const doomed = addAliasCategory(addressSpace, parent, "Doomed2");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "SurvivingVar2", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, doomed, "SURV-2", sensor);

            removeAliasCategory(addressSpace, doomed);
            aliasNames(await callFind(parent, "FindAlias", "SURV-2")).should.eql(["SURV-2"]);
        });

        it("should delete the contents when asked to cascade", () => {
            const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "CascadeParent");
            const doomed = addAliasCategory(addressSpace, parent, "DoomedCascade");
            const sensor = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "DoomedVar", dataType: "Double" }) as UAVariable;
            const alias = addAlias(addressSpace, doomed, "GONE-1", sensor);

            const { deleted } = removeAliasCategory(addressSpace, doomed, { orphans: "cascade" });

            deleted.some((id) => sameNodeId(id, alias.nodeId)).should.eql(true);
            should.not.exist(addressSpace.findNode(alias.nodeId));
        });

        it("should refuse to remove a well-known category", () => {
            // clause 9 requires the Server to have all three
            should(() => removeAliasCategory(addressSpace, WellKnownCategories.TagVariables)).throw(/well-known category/);
        });
    });

    describe("the ALIAS ServerCapability (OPC 10000-12 Annex D)", () => {
        /** The minimum an OPCUAServer looks like to installAliasNames. */
        function fakeServer(space: AddressSpace, capabilitiesForMDNS: string[]) {
            return { engine: { addressSpace: space }, capabilitiesForMDNS };
        }

        it("should be declared automatically when the feature is installed", async () => {
            // a Server that omits it is never discovered by anything looking for
            // alias-capable Servers, and nothing reports the failure - so this
            // is not left to each caller to remember
            const space = await pristine();
            const capabilities: string[] = [];
            await installAliasNames(fakeServer(space, capabilities));
            capabilities.should.eql(["ALIAS"]);
        });

        it("should replace the NA placeholder rather than sitting beside it", async () => {
            // node-opcua defaults to ["NA"], which means "none" and cannot
            // coexist with a real capability
            const space = await pristine();
            const capabilities = ["NA"];
            await installAliasNames(fakeServer(space, capabilities));
            capabilities.should.eql(["ALIAS"]);
        });

        it("should keep capabilities the Server already declared", async () => {
            const space = await pristine();
            const capabilities = ["DA", "HD"];
            await installAliasNames(fakeServer(space, capabilities));
            capabilities.should.eql(["DA", "HD", "ALIAS"]);
        });

        it("should not add it twice", async () => {
            const space = await pristine();
            const capabilities = ["ALIAS"];
            await installAliasNames(fakeServer(space, capabilities));
            capabilities.should.eql(["ALIAS"]);
        });

        it("should recognise it case-insensitively, as Annex D specifies", async () => {
            // Part 17 prose writes it "Alias"; Part 12 Annex D is normative
            const space = await pristine();
            const capabilities = ["Alias"];
            await installAliasNames(fakeServer(space, capabilities));
            capabilities.should.eql(["Alias"], "already declared, in another case");
        });

        it("should be skippable for a Server managing its own list", async () => {
            const space = await pristine();
            const capabilities: string[] = [];
            await installAliasNames(fakeServer(space, capabilities), { advertiseCapability: false });
            capabilities.should.eql([]);
        });

        it("should not fail on an address-space-only caller with no capability list", async () => {
            const space = await pristine();
            const result = await installAliasNames({ engine: { addressSpace: space } });
            result.installed.should.eql(true);
        });

        it("should expose the helper for a Server that wires it itself", () => {
            const capabilities = ["NA"];
            advertiseAliasCapability(capabilities).should.eql(true, "changed");
            capabilities.should.eql([ALIAS_SERVER_CAPABILITY_ID]);
            advertiseAliasCapability(capabilities).should.eql(false, "already there");
        });
    });

    // persistencePath and configurationMethods are both implemented now; see
    // test_last_change.ts and test_configuration_methods.ts
});
