/**
 * @module node-opcua-role-set-common
 */

import { exploreCertificate, makeSHA1Thumbprint } from "node-opcua-crypto";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    AnonymousIdentityToken,
    IdentityCriteriaType,
    IdentityMappingRuleType,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";

import type { AnyUserIdentityToken, IIdentityMappingStore } from "./identity_mapping_store.js";

/**
 * In-memory implementation of {@link IIdentityMappingStore}.
 *
 * Uses a `Map<string, IdentityMappingRuleType[]>` keyed by
 * the role NodeId string representation.
 */
export class InMemoryIdentityMappingStore implements IIdentityMappingStore {
    private readonly _map = new Map<string, IdentityMappingRuleType[]>();

    public addIdentity(roleId: NodeId, rule: IdentityMappingRuleType): void {
        const key = roleId.toString();
        let arr = this._map.get(key);
        if (!arr) {
            arr = [];
            this._map.set(key, arr);
        }
        // Idempotent: skip if already present
        if (arr.some((r) => r.criteriaType === rule.criteriaType && r.criteria === rule.criteria)) {
            return;
        }
        arr.push(
            new IdentityMappingRuleType({
                criteriaType: rule.criteriaType,
                criteria: rule.criteria
            })
        );
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

    public resolveRoles(token: AnyUserIdentityToken): NodeId[] {
        const matched: NodeId[] = [];
        for (const [key, rules] of this._map) {
            for (const rule of rules) {
                if (matchesRule(rule, token)) {
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

/**
 * Check if a single identity mapping rule matches a user identity token.
 *
 * **Note:** For `X509Subject` criteria, this implementation only compares
 * against the certificate's `commonName` (CN) field, **not** the full
 * Distinguished Name (DN). This is a simplification — a production
 * implementation may need full DN matching.
 *
 * @see OPC 10000-18 §4.4 IdentityMappingRuleType
 */
function matchesRule(rule: IdentityMappingRuleType, token: AnyUserIdentityToken): boolean {
    switch (rule.criteriaType) {
        case IdentityCriteriaType.Anonymous:
            return token instanceof AnonymousIdentityToken;

        case IdentityCriteriaType.AuthenticatedUser:
            return !(token instanceof AnonymousIdentityToken);

        case IdentityCriteriaType.UserName:
            return token instanceof UserNameIdentityToken && token.userName === rule.criteria;

        case IdentityCriteriaType.Thumbprint: {
            if (!(token instanceof X509IdentityToken) || !token.certificateData) {
                return false;
            }
            const certBuffer = token.certificateData instanceof Buffer ? token.certificateData : Buffer.from(token.certificateData);
            const thumbprint = makeSHA1Thumbprint(certBuffer).toString("hex").toUpperCase();
            const expected = (rule.criteria ?? "").toUpperCase().replace(/[\s:]/g, "");
            return thumbprint === expected;
        }

        case IdentityCriteriaType.X509Subject: {
            if (!(token instanceof X509IdentityToken) || !token.certificateData) {
                return false;
            }
            try {
                const certBuffer =
                    token.certificateData instanceof Buffer ? token.certificateData : Buffer.from(token.certificateData);
                const info = exploreCertificate(certBuffer);
                const dn = info.tbsCertificate.subject?.commonName ?? "";
                return dn === rule.criteria;
            } catch {
                return false;
            }
        }

        default:
            return false;
    }
}
