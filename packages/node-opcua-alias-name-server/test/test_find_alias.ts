import "mocha";
import type { AddressSpace, UAObject, UAVariable } from "node-opcua-address-space";
import { coerceExpandedNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { addAlias } from "../source/add_alias.js";
import { AddressSpaceAliasStore } from "../source/address_space_alias_store.js";
import { addAliasCategory } from "../source/bind_alias_category.js";
import { installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";
import { ALIAS_FOR, WellKnownCategories } from "../source/well_known.js";
import { aliasNames, callFind, getObject, makeAddressSpace, resultAliases, resultVerbose } from "./helpers.js";

/**
 * OPC 10000-17 clause 6.3.2 (`FindAlias`) and clause 6.3.3
 * (`FindAliasVerbose`).
 *
 * Clause 6.3.3 says the verbose form is "identical to FindAlias" in every
 * respect except what it returns, so the shared suite runs against both
 * bindings. Anything proved for one is proved for the other.
 *
 * ## Fixtures
 *
 * Loading the standard nodeset costs roughly a second, so address spaces are
 * built in `before`, not `beforeEach`. These tests search from the `Aliases`
 * root with broad patterns and so cannot use the suite-wide shared address
 * space — another file's aliases would show up in the results — but they can
 * share one *within* this file, provided nothing mutates it. Tests that do
 * mutate, or that need different install options, get their own fixture in a
 * nested `describe`.
 */
describe("OPC 10000-17: FindAlias", () => {
    describe("searching a fixed set of aliases", () => {
        let addressSpace: AddressSpace;
        let tagVariables: UAObject;
        let aliases: UAObject;
        let ti101: UAVariable;

        before(async () => {
            addressSpace = await makeAddressSpace();
            const ns = addressSpace.getOwnNamespace();
            const plant = ns.addObject({ browseName: "Plant", organizedBy: addressSpace.rootFolder.objects });

            const addSensor = (name: string) =>
                ns.addVariable({ browseName: name, dataType: "Double", componentOf: plant }) as UAVariable;
            ti101 = addSensor("TemperatureIndicator101");
            const fit101 = addSensor("FlowIndicatorTransmitter101");
            const lsh201 = addSensor("LevelSwitchHigh201");

            addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", ti101);
            addAlias(addressSpace, WellKnownCategories.TagVariables, "FIT-101", fit101);
            addAlias(addressSpace, WellKnownCategories.TagVariables, "LSH-201", lsh201);

            await installAliasNamesOnAddressSpace(addressSpace);
            tagVariables = getObject(addressSpace, WellKnownCategories.TagVariables);
            aliases = getObject(addressSpace, WellKnownCategories.Aliases);
        });

        after(() => addressSpace.dispose());

        // Every test below is read-only, so the whole block can run twice
        // against the same fixture, once per binding (clause 6.3.3).
        for (const methodName of ["FindAlias", "FindAliasVerbose"] as const) {
            describe(`via ${methodName}`, () => {
                it("should find an alias by its exact name", async () => {
                    const result = await callFind(tagVariables, methodName, "TI101");
                    result.statusCode!.should.eql(StatusCodes.Good);
                    aliasNames(result).should.eql(["TI101"]);
                });

                it("should return the Node the alias names", async () => {
                    const result = await callFind(tagVariables, methodName, "TI101");
                    const entry = resultAliases(result)[0];
                    entry.referencedNodes!.should.have.length(1);
                    entry.referencedNodes![0].value.should.eql(ti101.nodeId.value);
                });

                it("should support the % wildcard", async () => {
                    const result = await callFind(tagVariables, methodName, "%101");
                    aliasNames(result).should.eql(["FIT-101", "TI101"]);
                });

                it("should support the _ wildcard", async () => {
                    const result = await callFind(tagVariables, methodName, "TI___");
                    aliasNames(result).should.eql(["TI101"]);
                });

                it("should support a character list", async () => {
                    const result = await callFind(tagVariables, methodName, "%[0-9][0-9][0-9]");
                    aliasNames(result).should.eql(["FIT-101", "LSH-201", "TI101"]);
                });

                it("should return Good with an empty list when nothing matches", async () => {
                    // clause 6.3.2 Table 3: "If no Nodes match [...] the list shall be
                    // empty" - an empty result is not an error
                    const result = await callFind(tagVariables, methodName, "PT999");
                    result.statusCode!.should.eql(StatusCodes.Good);
                    resultAliases(result).should.have.length(0);
                });

                it("should return Bad_InvalidArgument on an invalid search pattern", async () => {
                    // clause 6.3.2 Table 4
                    const result = await callFind(tagVariables, methodName, "TI[10");
                    result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
                });

                it("should return Bad_InvalidArgument on a dangling escape", async () => {
                    const result = await callFind(tagVariables, methodName, "TI\\");
                    result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
                });

                it("should return Bad_InvalidArgument on a null pattern", async () => {
                    const result = await callFind(tagVariables, methodName, null);
                    result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
                });

                it("should be case sensitive, as OPC 10000-4 defines Like", async () => {
                    const result = await callFind(tagVariables, methodName, "ti101");
                    resultAliases(result).should.have.length(0);
                });

                it("should find aliases nested below the category it was called on", async () => {
                    // called on Aliases, the hit lives under TagVariables (clause 6.3.1)
                    const result = await callFind(aliases, methodName, "TI101");
                    aliasNames(result).should.eql(["TI101"]);
                });

                it("should not find an alias that lives outside the called category", async () => {
                    // called on Topics; the aliases are all under TagVariables
                    const topics = getObject(addressSpace, WellKnownCategories.Topics);
                    const result = await callFind(topics, methodName, "%");
                    resultAliases(result).should.have.length(0);
                });

                it("should match when the ReferenceTypeFilter is AliasFor", async () => {
                    const result = await callFind(tagVariables, methodName, "TI101", ALIAS_FOR);
                    aliasNames(result).should.eql(["TI101"]);
                });

                it("should match everything when the filter is the null NodeId", async () => {
                    const result = await callFind(tagVariables, methodName, "%");
                    aliasNames(result).should.eql(["FIT-101", "LSH-201", "TI101"]);
                });

                it("should exclude aliases linked by an unrelated ReferenceType", async () => {
                    // Organizes is not AliasFor nor a subtype of it
                    const organizes = addressSpace.findReferenceType("Organizes")!;
                    const result = await callFind(tagVariables, methodName, "%", organizes.nodeId);
                    resultAliases(result).should.have.length(0);
                });
            });
        }

        describe("the AliasName's namespace (clause 6.2)", () => {
            it("should report the namespace the alias was published in, not the category's", async () => {
                // Aliases, TagVariables and Topics all live in namespace 0, so using
                // the category's namespace put every alias on the wire as ns=0,
                // which is reserved for the OPC Foundation
                const result = await callFind(tagVariables, "FindAlias", "TI101");
                const entry = resultAliases(result)[0];
                entry.aliasName.namespaceIndex.should.not.eql(0, "namespace 0 is never right for an alias");
                entry.aliasName.namespaceIndex.should.eql(addressSpace.getOwnNamespace().index);
            });

            it("should report it the same way through FindAliasVerbose", async () => {
                const result = await callFind(tagVariables, "FindAliasVerbose", "TI101");
                resultVerbose(result)[0].aliasName.namespaceIndex.should.eql(addressSpace.getOwnNamespace().index);
            });

            it("should still carry the alias name itself", async () => {
                const result = await callFind(tagVariables, "FindAlias", "TI101");
                resultAliases(result)[0].aliasName.name!.should.eql("TI101");
            });
        });

        describe("result ordering (clause 6.3.2)", () => {
            it("should preserve discovery order by default", async () => {
                const result = await callFind(tagVariables, "FindAlias", "%");
                resultAliases(result)
                    .map((a) => a.aliasName.name)
                    .should.eql(["TI101", "FIT-101", "LSH-201"], "insertion order, deterministic across calls");
            });
        });
    });

    describe("scenarios that add to the hierarchy", () => {
        // One address space, but each test works in its own subcategory so the
        // mutations cannot reach another test.
        let addressSpace: AddressSpace;

        before(async () => {
            addressSpace = await makeAddressSpace();
            await installAliasNamesOnAddressSpace(addressSpace);
        });

        after(() => addressSpace.dispose());

        it("should cover a vendor subcategory nested below the called category", async () => {
            const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "NestedParent");
            const wells = addAliasCategory(addressSpace, parent, "Wells");
            const deep = addressSpace
                .getOwnNamespace()
                .addVariable({ browseName: "WellHeadPressure", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, wells, "PT-301", deep);

            for (const methodName of ["FindAlias", "FindAliasVerbose"] as const) {
                const result = await callFind(parent, methodName, "PT-301");
                aliasNames(result).should.eql(["PT-301"], `via ${methodName}`);
            }
        });

        it("should include subtypes of the filtered ReferenceType", async () => {
            // "Any ReferenceType includes all subtypes of that ReferenceType"
            const category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "SubtypeCat");
            const ns = addressSpace.getOwnNamespace();
            const subtype = ns.addReferenceType({
                browseName: "AliasForVariantFind",
                isAbstract: false,
                inverseName: "HasAliasVariantFind",
                subtypeOf: "AliasFor"
            });
            const extra = ns.addVariable({ browseName: "SpareSubtype", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, category, "SP-001", extra, { referenceType: subtype.nodeId });

            // filtering on the base type must still find the subtype link
            aliasNames(await callFind(category, "FindAlias", "SP-001", ALIAS_FOR)).should.eql(["SP-001"]);
            // and filtering on the subtype finds only it
            aliasNames(await callFind(category, "FindAlias", "%", subtype.nodeId)).should.eql(["SP-001"]);
        });

        it("should report every Node an alias names", async () => {
            const category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "MultiTarget");
            const ns = addressSpace.getOwnNamespace();
            const primary = ns.addVariable({ browseName: "PrimaryTemp", dataType: "Double" }) as UAVariable;
            const spare = ns.addVariable({ browseName: "RedundantTemp", dataType: "Double" }) as UAVariable;
            addAlias(addressSpace, category, "TI900", primary);
            addAlias(addressSpace, category, "TI900", spare);

            const result = await callFind(category, "FindAlias", "TI900");
            resultAliases(result)[0].referencedNodes!.should.have.length(2);
        });

        describe("FindAliasVerbose specifics (clause 6.3.3)", () => {
            it("should name the category that actually held the alias, not the one called", async () => {
                const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "VerboseParent");
                const nested = addAliasCategory(addressSpace, parent, "VerboseNested");
                const v = addressSpace
                    .getOwnNamespace()
                    .addVariable({ browseName: "VerboseTarget", dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, nested, "VB-1", v);

                const result = await callFind(parent, "FindAliasVerbose", "VB-1");
                sameNodeId(resultVerbose(result)[0].aliasNameCategoryId, nested.nodeId).should.eql(
                    true,
                    "the nested category, not the one the Method was called on"
                );
            });

            it("should return ServerUris parallel to ReferencedNodes, null for a local Node", async () => {
                // clause 7.3: "The string can be null for any NodeId that is on the
                // local Server". Every Node here is local; aggregating other Servers
                // is out of scope for this package.
                const category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "ServerUriCat");
                const v = addressSpace
                    .getOwnNamespace()
                    .addVariable({ browseName: "ServerUriTarget", dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, category, "SU-1", v);

                const entry = resultVerbose(await callFind(category, "FindAliasVerbose", "SU-1"))[0];
                entry.serverUris!.should.have.length(entry.referencedNodes!.length);
                entry.serverUris!.should.eql([null]);
            });

            it("should report one entry per category when an alias name is in two of them", async () => {
                // FindAlias merges by name; FindAliasVerbose must not, because
                // AliasNameCategoryId differs between the entries
                const parent = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "TwoCatParent");
                const left = addAliasCategory(addressSpace, parent, "Left");
                const right = addAliasCategory(addressSpace, parent, "Right");
                const ns = addressSpace.getOwnNamespace();
                addAlias(addressSpace, left, "DUP-1", ns.addVariable({ browseName: "DupLeft", dataType: "Double" }));
                addAlias(addressSpace, right, "DUP-1", ns.addVariable({ browseName: "DupRight", dataType: "Double" }));

                resultVerbose(await callFind(parent, "FindAliasVerbose", "DUP-1")).should.have.length(
                    2,
                    "one entry per holding category"
                );

                const plain = resultAliases(await callFind(parent, "FindAlias", "DUP-1"));
                plain.should.have.length(1, "merged into a single AliasNameDataType");
                plain[0].referencedNodes!.should.have.length(2, "with both targets");
            });
        });
    });

    describe("maxResults (clause 6.3.2 Table 4)", () => {
        // Each case needs its own install options, and installation is once per
        // address space, so these cannot share a fixture.
        async function withAliases(count: number, maxResults: number): Promise<AddressSpace> {
            const addressSpace = await makeAddressSpace();
            const ns = addressSpace.getOwnNamespace();
            for (let i = 0; i < count; i++) {
                const v = ns.addVariable({ browseName: `V${i}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, WellKnownCategories.TagVariables, `TAG${i}`, v);
            }
            await installAliasNamesOnAddressSpace(addressSpace, { maxResults });
            return addressSpace;
        }

        it("should return Bad_ResponseTooLarge beyond the cap", async () => {
            const addressSpace = await withAliases(5, 3);
            const category = getObject(addressSpace, WellKnownCategories.TagVariables);

            const tooMany = await callFind(category, "FindAlias", "%");
            tooMany.statusCode!.should.eql(StatusCodes.BadResponseTooLarge);

            // "try new filter and repeat find" - a narrower pattern succeeds
            const narrower = await callFind(category, "FindAlias", "TAG1");
            narrower.statusCode!.should.eql(StatusCodes.Good);
            addressSpace.dispose();
        });

        it("should allow exactly the cap", async () => {
            const addressSpace = await withAliases(3, 3);
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.Good);
            resultAliases(result).should.have.length(3);
            addressSpace.dispose();
        });

        it("should stop scanning once the cap is passed, not collect everything first", async () => {
            // otherwise a '%' query against a large tag set builds the entire
            // result set purely to throw it away
            const addressSpace = await makeAddressSpace();
            const ns = addressSpace.getOwnNamespace();
            for (let i = 0; i < 50; i++) {
                const v = ns.addVariable({ browseName: `V${i}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, WellKnownCategories.TagVariables, `TAG${i}`, v);
            }

            let seen = 0;
            const inner = new AddressSpaceAliasStore(addressSpace);
            const counting = {
                find: (query: Parameters<typeof inner.find>[0]) => {
                    const entries = inner.find(query);
                    seen = entries.length;
                    return entries;
                },
                lastChange: () => 0
            };

            await installAliasNamesOnAddressSpace(addressSpace, { maxResults: 5, store: counting });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");

            result.statusCode!.should.eql(StatusCodes.BadResponseTooLarge);
            seen.should.eql(6, "one past the cap, not all 50");
            addressSpace.dispose();
        });

        it("should apply the cap before merging by name", async () => {
            // 4 entries sharing one name merge to 1; reporting Good would hide
            // that the scan stopped early
            const addressSpace = await makeAddressSpace();
            const ns = addressSpace.getOwnNamespace();
            const tags = getObject(addressSpace, WellKnownCategories.TagVariables);
            const categoryType = addressSpace.findObjectType("AliasNameCategoryType")!;
            for (let i = 0; i < 4; i++) {
                const sub = categoryType.instantiate({
                    browseName: `Sub${i}`,
                    organizedBy: tags,
                    namespace: ns
                }) as UAObject;
                const v = ns.addVariable({ browseName: `V${i}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, sub, "TI101", v);
            }
            await installAliasNamesOnAddressSpace(addressSpace, { maxResults: 2 });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadResponseTooLarge);
            addressSpace.dispose();
        });
    });

    describe("access control (clause 6.3.2 Table 4)", () => {
        it("should return Bad_UserAccessDenied when reads are gated", async () => {
            const addressSpace = await makeAddressSpace();
            await installAliasNamesOnAddressSpace(addressSpace, { isReadAllowed: () => false });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.Aliases), "FindAlias", "%");
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
            addressSpace.dispose();
        });
    });

    describe("a store that is not backed by the address space", () => {
        it("should fall back to the Server's own namespace when the store reports none", async () => {
            const addressSpace = await makeAddressSpace();
            const store = {
                find: () => [
                    {
                        aliasName: "EXT-1",
                        referencedNodes: [coerceExpandedNodeId("ns=1;i=42")],
                        serverUris: [null],
                        categoryNodeId: WellKnownCategories.TagVariables,
                        referenceTypeIds: [ALIAS_FOR]
                    }
                ],
                lastChange: () => 0
            };
            await installAliasNamesOnAddressSpace(addressSpace, { store });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");
            resultAliases(result)[0].aliasName.namespaceIndex.should.eql(addressSpace.getOwnNamespace().index);
            addressSpace.dispose();
        });
    });

    describe("a replacement comparator", () => {
        it("should honour it", async () => {
            const addressSpace = await makeAddressSpace();
            const ns = addressSpace.getOwnNamespace();
            for (const name of ["TI101", "FIT-101", "LSH-201"]) {
                const v = ns.addVariable({ browseName: `V_${name}`, dataType: "Double" }) as UAVariable;
                addAlias(addressSpace, WellKnownCategories.TagVariables, name, v);
            }
            await installAliasNamesOnAddressSpace(addressSpace, {
                comparator: (a, b) => a.aliasName.localeCompare(b.aliasName)
            });
            const result = await callFind(getObject(addressSpace, WellKnownCategories.TagVariables), "FindAlias", "%");
            resultAliases(result)
                .map((a) => a.aliasName.name)
                .should.eql(["FIT-101", "LSH-201", "TI101"]);
            addressSpace.dispose();
        });
    });
});
