import "should";

import type { ISessionContext, UAMethod } from "node-opcua-address-space-base";
import { makeNodeId, type NodeId, sameNodeId } from "node-opcua-nodeid";

import { InMemoryIdentityMappingStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, MessageSecurityMode } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import {
    makeAddIdentityHandler,
    makeRemoveIdentityHandler,
    type RoleMappingRuleChangedAudit
} from "../source/bind_role_methods.js";

// --- Helpers ---

function makeContext(roleNodeIds: NodeId[], userName = "admin"): ISessionContext {
    return {
        getCurrentUserRoles: () => roleNodeIds,
        getUserName: () => userName
    } as unknown as ISessionContext;
}

/** Context with a SecureChannel exposing a given security mode. */
function makeContextWithChannel(roleNodeIds: NodeId[], securityMode: MessageSecurityMode): ISessionContext {
    return {
        getCurrentUserRoles: () => roleNodeIds,
        session: { channel: { securityMode } }
    } as unknown as ISessionContext;
}

function makeMockMethod(parentNodeId: NodeId | null): UAMethod {
    return {
        nodeId: makeNodeId(1234),
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

describe("bind_role_methods — encrypted channel enforcement (OPC 10000-18 §4.4)", () => {
    function addOnOperator(context: ISessionContext) {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeAddIdentityHandler({ store });
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "joe");
        return handler.call(mockMethod, inputArgs, context);
    }

    it("should reject AddIdentity over a None channel with BadSecurityModeInsufficient", async () => {
        const context = makeContextWithChannel([WellKnownRoleIds.SecurityAdmin], MessageSecurityMode.None);
        const result = await addOnOperator(context);
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });

    it("should reject AddIdentity over a Sign-only channel", async () => {
        const context = makeContextWithChannel([WellKnownRoleIds.SecurityAdmin], MessageSecurityMode.Sign);
        const result = await addOnOperator(context);
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });

    it("should accept AddIdentity over a SignAndEncrypt channel", async () => {
        const context = makeContextWithChannel([WellKnownRoleIds.SecurityAdmin], MessageSecurityMode.SignAndEncrypt);
        const result = await addOnOperator(context);
        result.statusCode?.should.equal(StatusCodes.Good);
    });

    it("should enforce encryption before the access check", async () => {
        // even a non-admin must first be rejected for the insecure channel
        const context = makeContextWithChannel([], MessageSecurityMode.None);
        const result = await addOnOperator(context);
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });

    it("should reject RemoveIdentity over a None channel", async () => {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeRemoveIdentityHandler({ store });
        const context = makeContextWithChannel([WellKnownRoleIds.SecurityAdmin], MessageSecurityMode.None);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "joe");
        const result = await handler.call(mockMethod, inputArgs, context);
        result.statusCode?.should.equal(StatusCodes.BadSecurityModeInsufficient);
    });
});

describe("bind_role_methods — well-known role immutability (OPC 10000-18 §4.3)", () => {
    for (const role of ["Anonymous", "AuthenticatedUser"] as const) {
        it(`should reject AddIdentity on the ${role} role with BadRequestNotAllowed`, async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeAddIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds[role]);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "joe");
            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadRequestNotAllowed);
        });

        it(`should reject RemoveIdentity on the ${role} role`, async () => {
            const store = new InMemoryIdentityMappingStore();
            const handler = makeRemoveIdentityHandler({ store });
            const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
            const mockMethod = makeMockMethod(WellKnownRoleIds[role]);
            const inputArgs = makeRuleVariant(IdentityCriteriaType.AuthenticatedUser, "");
            const result = await handler.call(mockMethod, inputArgs, context);
            result.statusCode?.should.equal(StatusCodes.BadRequestNotAllowed);
        });
    }
});

describe("bind_role_methods — weak criteria on administrative roles (OPC 10000-18 §4.4.5)", () => {
    it("should reject an Anonymous rule on the SecurityAdmin role", async () => {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeAddIdentityHandler({ store });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.Anonymous, "");
        const result = await handler.call(mockMethod, inputArgs, context);
        result.statusCode?.should.equal(StatusCodes.BadRequestNotAllowed);
    });

    it("should reject an AuthenticatedUser rule on the ConfigureAdmin role", async () => {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeAddIdentityHandler({ store });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.ConfigureAdmin);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.AuthenticatedUser, "");
        const result = await handler.call(mockMethod, inputArgs, context);
        result.statusCode?.should.equal(StatusCodes.BadRequestNotAllowed);
    });

    it("should allow a UserName rule on the SecurityAdmin role", async () => {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeAddIdentityHandler({ store });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.SecurityAdmin);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "admin");
        const result = await handler.call(mockMethod, inputArgs, context);
        result.statusCode?.should.equal(StatusCodes.Good);
    });
});

describe("bind_role_methods — duplicate identity (OPC 10000-18 §4.4.5)", () => {
    it("should return BadAlreadyExists when the same rule is added twice", async () => {
        const store = new InMemoryIdentityMappingStore();
        const handler = makeAddIdentityHandler({ store });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "joe");

        const first = await handler.call(mockMethod, inputArgs, context);
        first.statusCode?.should.equal(StatusCodes.Good);

        const second = await handler.call(mockMethod, inputArgs, context);
        second.statusCode?.should.equal(StatusCodes.BadAlreadyExists);

        store.getIdentitiesForRole(WellKnownRoleIds.Operator).should.have.length(1);
    });

    it("should NOT call onMutation when the add is a duplicate", async () => {
        const store = new InMemoryIdentityMappingStore();
        let mutationCount = 0;
        const handler = makeAddIdentityHandler({
            store,
            onMutation: async () => {
                mutationCount++;
            }
        });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);
        const inputArgs = makeRuleVariant(IdentityCriteriaType.UserName, "joe");

        await handler.call(mockMethod, inputArgs, context);
        await handler.call(mockMethod, inputArgs, context);
        mutationCount.should.equal(1);
    });
});

describe("bind_role_methods — audit (OPC 10000-18 §4.5)", () => {
    it("calls onAudit with the user, method, role and Good status on a successful AddIdentity", async () => {
        const store = new InMemoryIdentityMappingStore();
        const audits: RoleMappingRuleChangedAudit[] = [];
        const handler = makeAddIdentityHandler({ store, onAudit: (a) => audits.push(a) });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin], "alice");
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);

        await handler.call(mockMethod, makeRuleVariant(IdentityCriteriaType.UserName, "joe"), context);

        audits.should.have.length(1);
        audits[0].method.should.equal("AddIdentity");
        audits[0].userName.should.equal("alice");
        audits[0].statusCode.should.equal(StatusCodes.Good);
        sameNodeId(audits[0].roleNodeId, WellKnownRoleIds.Operator).should.be.true();
    });

    it("audits a refused change with its Bad status (immutable role)", async () => {
        const store = new InMemoryIdentityMappingStore();
        const audits: RoleMappingRuleChangedAudit[] = [];
        const handler = makeAddIdentityHandler({ store, onAudit: (a) => audits.push(a) });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Anonymous);

        await handler.call(mockMethod, makeRuleVariant(IdentityCriteriaType.UserName, "x"), context);

        audits.should.have.length(1);
        audits[0].statusCode.should.equal(StatusCodes.BadRequestNotAllowed);
    });

    it("does NOT audit a call rejected before authorization (unencrypted channel)", async () => {
        const store = new InMemoryIdentityMappingStore();
        const audits: RoleMappingRuleChangedAudit[] = [];
        const handler = makeAddIdentityHandler({ store, onAudit: (a) => audits.push(a) });
        const context = makeContextWithChannel([WellKnownRoleIds.SecurityAdmin], MessageSecurityMode.None);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);

        await handler.call(mockMethod, makeRuleVariant(IdentityCriteriaType.UserName, "joe"), context);
        audits.should.have.length(0);
    });

    it("audits a RemoveIdentity", async () => {
        const store = new InMemoryIdentityMappingStore();
        store.addIdentity(
            WellKnownRoleIds.Operator,
            new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: "joe" })
        );
        const audits: RoleMappingRuleChangedAudit[] = [];
        const handler = makeRemoveIdentityHandler({ store, onAudit: (a) => audits.push(a) });
        const context = makeContext([WellKnownRoleIds.SecurityAdmin]);
        const mockMethod = makeMockMethod(WellKnownRoleIds.Operator);

        await handler.call(mockMethod, makeRuleVariant(IdentityCriteriaType.UserName, "joe"), context);
        audits.should.have.length(1);
        audits[0].method.should.equal("RemoveIdentity");
        audits[0].statusCode.should.equal(StatusCodes.Good);
    });
});
