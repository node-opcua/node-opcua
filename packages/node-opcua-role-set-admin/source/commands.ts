/**
 * @module node-opcua-role-set-admin
 *
 * The connection helper and command actions behind the `role-set-admin` CLI,
 * built on `ClientRoleSet` / `ClientUserManagement`. Exported so they can also be
 * driven programmatically.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { ClientRoleSet, ClientUserManagement } from "node-opcua-role-set-client";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";

/** Connection + identity options shared by every command. */
export interface GlobalOpts {
    endpoint: string;
    username?: string;
    password?: string;
    /** Connect without security (None/None) instead of SignAndEncrypt/Basic256Sha256. */
    insecure?: boolean;
}

const userNameRule = (userName: string) =>
    new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: userName });

/**
 * Resolve the password: use `--password` if given, otherwise prompt for it with
 * hidden input (so it never lands in shell history or the process list). A
 * non-interactive run without `--password` is an error.
 */
async function resolvePassword(opts: GlobalOpts): Promise<string | undefined> {
    if (opts.username === undefined || opts.password !== undefined) {
        return opts.password; // anonymous, or password already supplied
    }
    if (!process.stdin.isTTY) {
        throw new Error(`password required for '${opts.username}': pass --password or run in an interactive terminal`);
    }
    // @inquirer/prompts is ESM-only; load it lazily so this CommonJS module can use it.
    const { password } = await import("@inquirer/prompts");
    return password({ message: `Password for ${opts.username}:`, mask: "*" });
}

/** Connect, run `fn` in a session, then tear everything down. */
export async function withSession<T>(opts: GlobalOpts, fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const password = await resolvePassword(opts);
    const secure = !opts.insecure;
    const pkiRoot = path.join(os.tmpdir(), `role-set-admin-${process.pid}`);
    const clientCertificateManager = new OPCUACertificateManager({
        rootFolder: pkiRoot,
        automaticallyAcceptUnknownCertificate: true
    });
    await clientCertificateManager.initialize();

    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: secure ? MessageSecurityMode.SignAndEncrypt : MessageSecurityMode.None,
        securityPolicy: secure ? SecurityPolicy.Basic256Sha256 : SecurityPolicy.None,
        clientCertificateManager
    });
    await client.connect(opts.endpoint);
    try {
        const userIdentity =
            opts.username !== undefined
                ? { type: UserTokenType.UserName as const, userName: opts.username, password: password ?? "" }
                : undefined;
        const session = await client.createSession(userIdentity);
        try {
            return await fn(session);
        } finally {
            await session.close();
        }
    } finally {
        await client.disconnect();
        await clientCertificateManager.dispose();
        await fs.rm(pkiRoot, { recursive: true, force: true }).catch(() => undefined);
    }
}

/** Print a StatusCode result and mark the process failed if it is not Good. */
function reportStatus(label: string, statusCode: StatusCode): void {
    const ok = statusCode === StatusCodes.Good;
    console.log(`${ok ? "✓" : "✗"} ${label}: ${statusCode.name}`);
    if (!ok) process.exitCode = 1;
}

async function getRoleOrThrow(roleSet: ClientRoleSet, name: string) {
    const role = await roleSet.getRole(name);
    if (!role) throw new Error(`role '${name}' not found`);
    return role;
}

export async function listRoles(opts: GlobalOpts): Promise<void> {
    await withSession(opts, async (session) => {
        const roleSet = new ClientRoleSet(session);
        for (const role of await roleSet.getRoles()) {
            const identities = await role.readIdentities();
            const who = identities.map((i) => i.criteria).join(", ") || "—";
            console.log(`${role.roleName.padEnd(20)} ${role.roleNodeId.toString().padEnd(18)} identities: ${who}`);
        }
    });
}

export async function showRole(opts: GlobalOpts, name: string): Promise<void> {
    await withSession(opts, async (session) => {
        const role = await getRoleOrThrow(new ClientRoleSet(session), name);
        console.log(`Role ${role.roleName} (${role.roleNodeId.toString()})`);
        const identities = await role.readIdentities();
        if (identities.length === 0) {
            console.log("  (no identities)");
        }
        for (const i of identities) {
            console.log(`  - ${IdentityCriteriaType[i.criteriaType]}: ${i.criteria}`);
        }
    });
}

export async function addRole(opts: GlobalOpts, name: string): Promise<void> {
    await withSession(opts, async (session) => {
        const { statusCode, roleNodeId } = await new ClientRoleSet(session).addRole(name);
        reportStatus(`AddRole '${name}'${roleNodeId ? ` -> ${roleNodeId.toString()}` : ""}`, statusCode);
    });
}

export async function removeRole(opts: GlobalOpts, name: string): Promise<void> {
    await withSession(opts, async (session) => {
        const roleSet = new ClientRoleSet(session);
        const role = await getRoleOrThrow(roleSet, name);
        reportStatus(`RemoveRole '${name}'`, (await roleSet.removeRole(role.roleNodeId)).statusCode);
    });
}

export async function addIdentity(opts: GlobalOpts, roleName: string, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        const role = await getRoleOrThrow(new ClientRoleSet(session), roleName);
        reportStatus(`AddIdentity ${userName} -> ${roleName}`, (await role.addIdentity(userNameRule(userName))).statusCode);
    });
}

export async function removeIdentity(opts: GlobalOpts, roleName: string, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        const role = await getRoleOrThrow(new ClientRoleSet(session), roleName);
        reportStatus(`RemoveIdentity ${userName} from ${roleName}`, (await role.removeIdentity(userNameRule(userName))).statusCode);
    });
}

export async function listUsers(opts: GlobalOpts): Promise<void> {
    await withSession(opts, async (session) => {
        for (const u of await new ClientUserManagement(session).readUsers()) {
            console.log(`${(u.userName ?? "").padEnd(20)} config=${u.userConfiguration} ${u.description ?? ""}`);
        }
    });
}

export async function addUser(opts: GlobalOpts, userName: string, password: string, roles: string[]): Promise<void> {
    await withSession(opts, async (session) => {
        const um = new ClientUserManagement(session);
        const addStatus = (await um.addUser(userName, password, UserConfigurationMask.None, "")).statusCode;
        reportStatus(`AddUser '${userName}'`, addStatus);
        if (addStatus !== StatusCodes.Good) return;
        const roleSet = new ClientRoleSet(session);
        for (const roleName of roles) {
            const role = await getRoleOrThrow(roleSet, roleName);
            reportStatus(`  + identity ${userName} -> ${roleName}`, (await role.addIdentity(userNameRule(userName))).statusCode);
        }
    });
}

export async function removeUser(opts: GlobalOpts, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        reportStatus(`RemoveUser '${userName}'`, (await new ClientUserManagement(session).removeUser(userName)).statusCode);
    });
}

export async function changePassword(opts: GlobalOpts, oldPassword: string, newPassword: string): Promise<void> {
    await withSession(opts, async (session) => {
        reportStatus(
            "ChangePassword",
            (await new ClientUserManagement(session).changePassword(oldPassword, newPassword)).statusCode
        );
    });
}
