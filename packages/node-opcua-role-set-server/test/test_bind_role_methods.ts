import "should";

import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";

import { InMemoryIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { makeAddIdentityHandler, makeRemoveIdentityHandler } from "../source/bind_role_methods.js";

// --- Helpers ---

function makeContext(roleNodeIds: NodeId[]): ISessionContext {
    return {
        getCurrentUserRoles: () => roleNodeIds
    } as unknown as ISessionContext;
}

function makeMockMethod(parentNodeId: NodeId | null): UAMethod {
    return {
        parent: parentNodeId ? { nodeId: parentNodeId } : null
    } as unknown as UAMethod;
}

function makeRuleVariant(criteriaType: IdentityCriteriaType, criteria: string): Variant[] {
    return [
        new Variant({
            dataType: DataType.ExtensionObject,
            value: new IdentityMappingRuleType({ criteriaType, criteria })
        })
    ];
}

// --- Tests ---
describe("bind_role_methods — makeAddIdentityHandler", () => {
    describe("security check", () => {
        it("should return BadUserAccessDenied when user has no roles", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadUserAccessDenied);
        });

        it("should succeed when user has SecurityAdmin role", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.Good);
        });
    });

    describe("invalid arguments", () => {
        it("should return BadInvalidArgument when inputArguments is empty", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);

            const result = await handler.call(mockMethod, [], context);
            result.statusCode?.should.equal(StatusCodes.BadInvalidArgument);
        });

        it("should return BadInvalidArgument when value is not IdentityMappingRuleType", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);

            const inputArgs = [new Variant({ dataType: DataType.String, value: "not-a-rule" })];

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadInvalidArgument);
        });
    });

    describe("no parent", () => {
        it("should return BadInternalError when method has no parent", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(null);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadInternalError);
        });
    });

    describe("happy path", () => {
        it("should add an identity to the store and return Good", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const roleNodeId = WellKnownRoleIds.Observer;
            const mockMethod = makeMockMethod(roleNodeId);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.Anonymous, "*");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.Good);

            const identities = store.getIdentitiesForRole(roleNodeId);
            identities.should.have.length(1);
            identities[0].criteria.should.equal("*");
            identities[0].criteriaType.should.equal(IdentityCriteriaType.Anonymous);
        });
    });

    describe("onMutation callback", () => {
        it("should call onMutation after a successful add", async () => {
            const store = new InMemoryIdentityMappingStore();
            let mutationCalled = false;
            const handler = makeAddIdentityHandler({
                store,
                onMutation: async () => {
                    mutationCalled = true;
                }
            });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            await handler.call(mockMethod, inputArgs, context);
            mutationCalled.should.be.true();
        });

        it("should NOT call onMutation when security check fails", async () => {
            const store = new InMemoryIdentityMappingStore();
            let mutationCalled = false;
            const handler = makeAddIdentityHandler({
                store,
                onMutation: async () => {
                    mutationCalled = true;
                }
            });
            const context = makeContext([]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            await handler.call(mockMethod, inputArgs, context);
            mutationCalled.should.be.false();
        });
    });
});

describe("bind_role_methods — makeRemoveIdentityHandler", () => {
    describe("security check", () => {
        it("should return BadUserAccessDenied when user has no roles", async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeRemoveIdentityHandler({ store });
            const context = makeContext([]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadUserAccessDenied);
        });
    });

    describe("happy path — add then remove", () => {
        it("should remove an identity and return Good", async () => {
            const store = new InMemoryIdentityMappingStore();
            const roleNodeId = WellKnownRoleIds.Observer;

            // Pre-populate the store
            store.addIdentity(
                roleNodeId,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );
            store.getIdentitiesForRole(roleNodeId).should.have.length(1);

            const handler = makeRemoveIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(roleNodeId);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.Anonymous, "*");

            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.Good);

            store.getIdentitiesForRole(roleNodeId).should.have.length(0);
        });

        it("should return BadNoMatch on second remove", async () => {
            const store = new InMemoryIdentityMappingStore();
            const roleNodeId = WellKnownRoleIds.Observer;

            // Add then remove once
            store.addIdentity(
                roleNodeId,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.Anonymous,
                    criteria: "*"
                })
            );

            const handler = makeRemoveIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(roleNodeId);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.Anonymous, "*");

            // First remove — should succeed
            const result1 = await handler.call(mockMethod, inputArgs, context);
            result1.statusCode?.should.equal(StatusCodes.Good);

            // Second remove — should fail
            const result2 = await handler.call(mockMethod, inputArgs, context);
            result2.statusCode?.should.equal(StatusCodes.BadNoMatch);
        });
    });

    describe("onMutation callback", () => {
        it("should call onMutation after a successful remove", async () => {
            const store = new InMemoryIdentityMappingStore();
            const roleNodeId = WellKnownRoleIds.SecurityAdmin;
            store.addIdentity(
                roleNodeId,
                new IdentityMappingRuleType({
                    criteriaType: IdentityCriteriaType.UserName,
                    criteria: "admin"
                })
            );

            let mutationCalled = false;
            const handler = makeRemoveIdentityHandler({
                store,
                onMutation: async () => {
                    mutationCalled = true;
                }
            });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(roleNodeId);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");

            await handler.call(mockMethod, inputArgs, context);
            mutationCalled.should.be.true();
        });

        it("should NOT call onMutation when remove finds no match", async () => {
            const store = new InMemoryIdentityMappingStore();
            let mutationCalled = false;
            const handler = makeRemoveIdentityHandler({
                store,
                onMutation: async () => {
                    mutationCalled = true;
                }
            });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "nobody");

            await handler.call(mockMethod, inputArgs, context);
            mutationCalled.should.be.false();
        });
    });
});
