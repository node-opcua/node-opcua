/**
 * @module node-opcua-role-set-common
 *
 * Per-Role application & endpoint restrictions (OPC 10000-18 §4.4.1, §4.4.7-10)
 * and the matching rules that decide whether a Session complies with them.
 *
 * A Role is granted only if the UserIdentityToken matches **and** the Client
 * application complies with the `Applications` restriction **and** the Endpoint
 * used complies with the `Endpoints` restriction.
 */
import type { NodeId } from "node-opcua-nodeid";
import { MessageSecurityMode } from "node-opcua-types";

/** An endpoint restriction entry (mirrors the EndpointType DataType, §4.4.2). */
export interface EndpointCriteria {
    endpointUrl?: string;
    securityMode?: MessageSecurityMode;
    securityPolicyUri?: string;
    transportProfileUri?: string;
}

/**
 * The Session attributes evaluated against a Role's application/endpoint
 * restrictions. Built from the SessionContext (client certificate ApplicationUri,
 * SecureChannel security mode/policy, the Endpoint used).
 */
export interface ResolutionContext {
    applicationUri?: string | null;
    securityMode?: MessageSecurityMode;
    endpointUrl?: string;
    securityPolicyUri?: string;
    transportProfileUri?: string;
}

/** Per-Role application & endpoint restriction configuration. */
export interface IRoleRestrictionStore {
    /** Add an ApplicationUri to a Role's Applications list. @returns false if already present. */
    addApplication(roleId: NodeId, applicationUri: string): boolean;
    /** Remove an ApplicationUri. @returns false if not present. */
    removeApplication(roleId: NodeId, applicationUri: string): boolean;
    getApplications(roleId: NodeId): string[];
    /** Set ApplicationsExclude (include-list when false, exclude-list when true). */
    setApplicationsExclude(roleId: NodeId, exclude: boolean): void;
    /** ApplicationsExclude — defaults to TRUE when the Applications list is empty (§4.4.1). */
    getApplicationsExclude(roleId: NodeId): boolean;

    addEndpoint(roleId: NodeId, endpoint: EndpointCriteria): boolean;
    removeEndpoint(roleId: NodeId, endpoint: EndpointCriteria): boolean;
    getEndpoints(roleId: NodeId): EndpointCriteria[];
    setEndpointsExclude(roleId: NodeId, exclude: boolean): void;
    getEndpointsExclude(roleId: NodeId): boolean;

    /** True when the Session complies with the Role's application & endpoint restrictions. */
    complies(roleId: NodeId, context: ResolutionContext): boolean;
}

const isSigned = (mode: MessageSecurityMode | undefined): boolean =>
    mode === MessageSecurityMode.Sign || mode === MessageSecurityMode.SignAndEncrypt;

function sameEndpoint(a: EndpointCriteria, b: EndpointCriteria): boolean {
    return (
        (a.endpointUrl ?? "") === (b.endpointUrl ?? "") &&
        (a.securityMode ?? MessageSecurityMode.Invalid) === (b.securityMode ?? MessageSecurityMode.Invalid) &&
        (a.securityPolicyUri ?? "") === (b.securityPolicyUri ?? "") &&
        (a.transportProfileUri ?? "") === (b.transportProfileUri ?? "")
    );
}

/**
 * Does the Session's application comply with an `Applications` restriction?
 *
 * - Empty list → no restriction (granted).
 * - Non-empty list → the Session must use at least a **signed** channel (§4.4.1).
 *   Then, with `exclude=false` the ApplicationUri must be **in** the list;
 *   with `exclude=true` it must **not** be in the list.
 */
export function applicationComplies(applications: string[], exclude: boolean, context: ResolutionContext): boolean {
    if (applications.length === 0) {
        return true;
    }
    if (!isSigned(context.securityMode)) {
        return false;
    }
    const inList = context.applicationUri != null && applications.includes(context.applicationUri);
    return exclude ? !inList : inList;
}

/** Does an endpoint entry match the Session's endpoint? Default-valued fields are ignored (§4.4.2). */
function endpointEntryMatches(entry: EndpointCriteria, context: ResolutionContext): boolean {
    if (entry.endpointUrl && entry.endpointUrl !== context.endpointUrl) return false;
    if (
        entry.securityMode !== undefined &&
        entry.securityMode !== MessageSecurityMode.Invalid &&
        entry.securityMode !== context.securityMode
    ) {
        return false;
    }
    if (entry.securityPolicyUri && entry.securityPolicyUri !== context.securityPolicyUri) return false;
    if (entry.transportProfileUri && entry.transportProfileUri !== context.transportProfileUri) return false;
    return true;
}

/**
 * Does the Session's endpoint comply with an `Endpoints` restriction?
 * Empty list → no restriction. `exclude=false` → the endpoint must match one
 * entry; `exclude=true` → it must match none.
 */
export function endpointComplies(endpoints: EndpointCriteria[], exclude: boolean, context: ResolutionContext): boolean {
    if (endpoints.length === 0) {
        return true;
    }
    const anyMatch = endpoints.some((e) => endpointEntryMatches(e, context));
    return exclude ? !anyMatch : anyMatch;
}

interface RoleRestriction {
    applications: string[];
    applicationsExclude?: boolean;
    endpoints: EndpointCriteria[];
    endpointsExclude?: boolean;
}

/** In-memory implementation of {@link IRoleRestrictionStore}. */
export class InMemoryRoleRestrictionStore implements IRoleRestrictionStore {
    private readonly _map = new Map<string, RoleRestriction>();

    private get(roleId: NodeId): RoleRestriction {
        const key = roleId.toString();
        let r = this._map.get(key);
        if (!r) {
            r = { applications: [], endpoints: [] };
            this._map.set(key, r);
        }
        return r;
    }

    public addApplication(roleId: NodeId, applicationUri: string): boolean {
        const r = this.get(roleId);
        if (r.applications.includes(applicationUri)) return false;
        r.applications.push(applicationUri);
        return true;
    }
    public removeApplication(roleId: NodeId, applicationUri: string): boolean {
        const r = this.get(roleId);
        const i = r.applications.indexOf(applicationUri);
        if (i < 0) return false;
        r.applications.splice(i, 1);
        return true;
    }
    public getApplications(roleId: NodeId): string[] {
        return [...this.get(roleId).applications];
    }
    public setApplicationsExclude(roleId: NodeId, exclude: boolean): void {
        this.get(roleId).applicationsExclude = exclude;
    }
    public getApplicationsExclude(roleId: NodeId): boolean {
        const r = this.get(roleId);
        // default TRUE when the list is empty (§4.4.1), otherwise FALSE (include list)
        return r.applicationsExclude ?? r.applications.length === 0;
    }

    public addEndpoint(roleId: NodeId, endpoint: EndpointCriteria): boolean {
        const r = this.get(roleId);
        if (r.endpoints.some((e) => sameEndpoint(e, endpoint))) return false;
        r.endpoints.push({ ...endpoint });
        return true;
    }
    public removeEndpoint(roleId: NodeId, endpoint: EndpointCriteria): boolean {
        const r = this.get(roleId);
        const i = r.endpoints.findIndex((e) => sameEndpoint(e, endpoint));
        if (i < 0) return false;
        r.endpoints.splice(i, 1);
        return true;
    }
    public getEndpoints(roleId: NodeId): EndpointCriteria[] {
        return this.get(roleId).endpoints.map((e) => ({ ...e }));
    }
    public setEndpointsExclude(roleId: NodeId, exclude: boolean): void {
        this.get(roleId).endpointsExclude = exclude;
    }
    public getEndpointsExclude(roleId: NodeId): boolean {
        const r = this.get(roleId);
        return r.endpointsExclude ?? r.endpoints.length === 0;
    }

    public complies(roleId: NodeId, context: ResolutionContext): boolean {
        const r = this.get(roleId);
        return (
            applicationComplies(r.applications, this.getApplicationsExclude(roleId), context) &&
            endpointComplies(r.endpoints, this.getEndpointsExclude(roleId), context)
        );
    }
}
