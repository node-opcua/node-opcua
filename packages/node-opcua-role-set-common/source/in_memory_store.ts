/**
 * @module node-opcua-role-set-common
 */

import { exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    MessageSecurityMode,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";

import type { AnyUserIdentityToken, IIdentityMappingStore } from "./identity_mapping_store.js";
import type { ResolutionContext } from "./role_restriction_store.js";
import { WellKnownRoleIds } from "./well_known_role_ids.js";
import { type MatchX509SubjectOptions, matchX509Subject } from "./x509_subject.js";

export interface InMemoryIdentityMappingStoreOptions {
    /**
     * Let an `X509Subject` rule written as a plain Common Name match on the CN
     * alone (see {@link MatchX509SubjectOptions.acceptCommonNameOnly}). Off by
     * default: OPC 10000-18 §4.4.3 requires the full ordered DN.
     */
    acceptCommonNameOnlyX509Subject?: boolean;
}

/**
 * In-memory implementation of {@link IIdentityMappingStore}.
 *
 * Uses a `Map<string, IdentityMappingRuleType[]>` keyed by
 * the role NodeId string representation.
 */
export class InMemoryIdentityMappingStore implements IIdentityMappingStore {
    private readonly _map = new Map<string, IdentityMappingRuleType[]>();
    private readonly _subjectOptions: MatchX509SubjectOptions;

    constructor(options: InMemoryIdentityMappingStoreOptions = {}) {
        this._subjectOptions = { acceptCommonNameOnly: options.acceptCommonNameOnlyX509Subject === true };
    }

    public addIdentity(roleId: NodeId, rule: IdentityMappingRuleType): boolean {
        const key = roleId.toString();
        let arr = this._map.get(key);
        if (!arr) {
            arr = [];
            this._map.set(key, arr);
        }
        // Idempotent: skip if already present
        if (arr.some((r) => r.criteriaType === rule.criteriaType && r.criteria === rule.criteria)) {
            return false;
        }
        arr.push(
            new IdentityMappingRuleType({
                criteriaType: rule.criteriaType,
                criteria: rule.criteria
            })
        );
        return true;
    }

    public removeIdentity(roleId: NodeId, rule: IdentityMappingRuleType): boolean {
        const key = roleId.toString();
        const arr = this._map.get(key);
        if (!arr) {
            return false;
        }
        const idx = arr.findIndex((r) => r.criteriaType === rule.criteriaType && r.criteria === rule.criteria);
        if (idx < 0) {
            return false;
        }
        arr.splice(idx, 1);
        if (arr.length === 0) {
            this._map.delete(key);
        }
        return true;
    }

    public getIdentitiesForRole(roleId: NodeId): IdentityMappingRuleType[] {
        const arr = this._map.get(roleId.toString());
        if (!arr) {
            return [];
        }
        return arr.map(
            (r) =>
                new IdentityMappingRuleType({
                    criteriaType: r.criteriaType,
                    criteria: r.criteria
                })
        );
    }

    public getRoleIds(): NodeId[] {
        const result: NodeId[] = [];
        for (const key of this._map.keys()) {
            result.push(resolveNodeId(key));
        }
        return result;
    }

    public resolveRoles(token: AnyUserIdentityToken, context?: ResolutionContext): NodeId[] {
        const matched: NodeId[] = [];
        for (const [key, rules] of this._map) {
            const privileged = isPrivilegedRoleKey(key);
            for (const rule of rules) {
                // AddIdentity refuses a TrustedApplication rule on an administrative
                // Role, but one persisted before that check, or added in code,
                // would give the Role to every trusted Client: never match it.
                if (privileged && rule.criteriaType === IdentityCriteriaType.TrustedApplication) {
                    continue;
                }
                if (matchesRule(rule, token, context, this._subjectOptions)) {
                    const roleId = resolveNodeId(key);
                    if (!matched.find((r) => sameNodeId(r, roleId))) {
                        matched.push(roleId);
                    }
                    break; // one match per role is enough
                }
            }
        }
        return matched;
    }
}

function isAnonymous(token: unknown): token is AnonymousIdentityToken {
    return token instanceof AnonymousIdentityToken;
}

function isUserName(token: unknown): token is UserNameIdentityToken {
    return token instanceof UserNameIdentityToken;
}

function isX509(token: unknown): token is X509IdentityToken {
    return token instanceof X509IdentityToken;
}

/** SecurityAdmin and ConfigureAdmin, keyed as the store keys them. */
const PRIVILEGED_ROLE_KEYS = new Set([WellKnownRoleIds.SecurityAdmin.toString(), WellKnownRoleIds.ConfigureAdmin.toString()]);
function isPrivilegedRoleKey(key: string): boolean {
    return PRIVILEGED_ROLE_KEYS.has(key);
}

/**
 * §4.4.3 for the application criteria: the Client Certificate is trusted by
 * the Server (not merely admitted by a NoConfiguration relaxation) and the
 * Session uses a Sign or SignAndEncrypt SecureChannel.
 */
function isTrustedSignedClient(context: ResolutionContext | undefined): context is ResolutionContext {
    if (!context || context.clientCertificateTrustRelaxed === true) {
        return false;
    }
    return context.securityMode === MessageSecurityMode.Sign || context.securityMode === MessageSecurityMode.SignAndEncrypt;
}

/**
 * Check if a single identity mapping rule matches a user identity token and,
 * for the application criteria, the Session's SecureChannel.
 *
 * For `X509Subject` criteria, see {@link matchX509Subject}: the full ordered DN
 * format (OPC 10000-18 §4.4.3); a plain Common Name only when the store opts in.
 *
 * `Application` and `TrustedApplication` (§4.4.3) are about the client
 * application: "The Client Certificate shall be trusted by the Server and the
 * Session shall use at least a signed communication channel." The server
 * validated that certificate at OpenSecureChannel; `context.applicationUri` is
 * the URI it carries. A certificate admitted only because the server relaxed
 * its checks (NoConfiguration, Application Setup) carries a URI nobody
 * vouched for, so these rules never match it.
 *
 * @see OPC 10000-18 §4.4 IdentityMappingRuleType
 */
function matchesRule(
    rule: IdentityMappingRuleType,
    token: AnyUserIdentityToken,
    context: ResolutionContext | undefined,
    subjectOptions: MatchX509SubjectOptions
): boolean {
    switch (rule.criteriaType) {
        case IdentityCriteriaType.Anonymous:
            return isAnonymous(token);

        case IdentityCriteriaType.AuthenticatedUser:
            return !isAnonymous(token);

        case IdentityCriteriaType.UserName:
            return isUserName(token) && token.userName === rule.criteria;

        case IdentityCriteriaType.Thumbprint: {
            if (!isX509(token) || !token.certificateData) {
                return false;
            }
            const certBuffer = token.certificateData instanceof Buffer ? token.certificateData : Buffer.from(token.certificateData);
            const thumbprint = makeSHA1Thumbprint(certBuffer).toString("hex").toUpperCase();
            const expected = (rule.criteria ?? "").toUpperCase().replace(/[\s:]/g, "");
            return thumbprint === expected;
        }

        case IdentityCriteriaType.X509Subject: {
            if (!isX509(token) || !token.certificateData) {
                return false;
            }
            try {
                const certBuffer =
                    token.certificateData instanceof Buffer ? token.certificateData : Buffer.from(token.certificateData);
                const info = exploreCertificate(certBuffer);
                const subject = info.tbsCertificate.subject ?? {};
                return matchX509Subject(rule.criteria ?? "", subject, subjectOptions);
            } catch {
                return false;
            }
        }

        case IdentityCriteriaType.Application: {
            const expected = (rule.criteria ?? "").trim();
            return expected !== "" && isTrustedSignedClient(context) && (context.applicationUri ?? "") === expected;
        }

        case IdentityCriteriaType.TrustedApplication:
            return isTrustedSignedClient(context) && !!context.applicationUri;

        default:
            return false;
    }
}
