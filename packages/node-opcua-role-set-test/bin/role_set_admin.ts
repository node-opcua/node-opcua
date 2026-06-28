/**
 * role-set-admin — a small CLI to administer the RoleSet & User Management of any
 * OPC UA server (OPC 10000-18), built on `ClientRoleSet` / `ClientUserManagement`.
 *
 * It connects over a real session and drives the standard RoleSet / UserManagement
 * Methods, so it works against any compliant server (including the sample server
 * in `sample_server_with_role_set.ts`).
 *
 *   npx tsx bin/role_set_admin.ts -e opc.tcp://host:4840 -u admin -p secret list-roles
 *   npx tsx bin/role_set_admin.ts -e ... -u admin -p secret add-identity Operator joe
 *   npx tsx bin/role_set_admin.ts -e ... -u admin -p secret add-user alice s3cret -r Operator
 *
 * Most management Methods require a SecurityAdmin over an encrypted channel, so
 * the default is SignAndEncrypt / Basic256Sha256 with an auto-accepting client PKI.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { password as passwordPrompt } from "@inquirer/prompts";
import { Command } from "commander";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ClientSession, MessageSecurityMode, OPCUAClient, SecurityPolicy, UserTokenType } from "node-opcua-client";
import { ClientRoleSet, ClientUserManagement } from "node-opcua-role-set-client";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";

interface GlobalOpts {
    endpoint: string;
    username?: string;
    password?: string;
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
    return passwordPrompt({ message: `Password for ${opts.username}:`, mask: "*" });
}

/** Connect, run `fn` in a session, then tear everything down. */
async function withSession<T>(opts: GlobalOpts, fn: (session: ClientSession) => Promise<T>): Promise<T> {
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

/** Print a StatusCode result and exit non-zero if it is not Good. */
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

// --- command implementations -------------------------------------------------

async function listRoles(opts: GlobalOpts): Promise<void> {
    await withSession(opts, async (session) => {
        const roleSet = new ClientRoleSet(session);
        for (const role of await roleSet.getRoles()) {
            const identities = await role.readIdentities();
            const who = identities.map((i) => i.criteria).join(", ") || "—";
            console.log(`${role.roleName.padEnd(20)} ${role.roleNodeId.toString().padEnd(18)} identities: ${who}`);
        }
    });
}

async function showRole(opts: GlobalOpts, name: string): Promise<void> {
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

async function addRole(opts: GlobalOpts, name: string): Promise<void> {
    await withSession(opts, async (session) => {
        const { statusCode, roleNodeId } = await new ClientRoleSet(session).addRole(name);
        reportStatus(`AddRole '${name}'${roleNodeId ? ` -> ${roleNodeId.toString()}` : ""}`, statusCode);
    });
}

async function removeRole(opts: GlobalOpts, name: string): Promise<void> {
    await withSession(opts, async (session) => {
        const roleSet = new ClientRoleSet(session);
        const role = await getRoleOrThrow(roleSet, name);
        reportStatus(`RemoveRole '${name}'`, (await roleSet.removeRole(role.roleNodeId)).statusCode);
    });
}

async function addIdentity(opts: GlobalOpts, roleName: string, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        const role = await getRoleOrThrow(new ClientRoleSet(session), roleName);
        reportStatus(`AddIdentity ${userName} -> ${roleName}`, (await role.addIdentity(userNameRule(userName))).statusCode);
    });
}

async function removeIdentity(opts: GlobalOpts, roleName: string, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        const role = await getRoleOrThrow(new ClientRoleSet(session), roleName);
        reportStatus(`RemoveIdentity ${userName} from ${roleName}`, (await role.removeIdentity(userNameRule(userName))).statusCode);
    });
}

async function listUsers(opts: GlobalOpts): Promise<void> {
    await withSession(opts, async (session) => {
        for (const u of await new ClientUserManagement(session).readUsers()) {
            console.log(`${u.userName.padEnd(20)} config=${u.userConfiguration} ${u.description ?? ""}`);
        }
    });
}

async function addUser(opts: GlobalOpts, userName: string, password: string, roles: string[]): Promise<void> {
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

async function removeUser(opts: GlobalOpts, userName: string): Promise<void> {
    await withSession(opts, async (session) => {
        reportStatus(`RemoveUser '${userName}'`, (await new ClientUserManagement(session).removeUser(userName)).statusCode);
    });
}

async function changePassword(opts: GlobalOpts, oldPassword: string, newPassword: string): Promise<void> {
    await withSession(opts, async (session) => {
        reportStatus(
            "ChangePassword",
            (await new ClientUserManagement(session).changePassword(oldPassword, newPassword)).statusCode
        );
    });
}

// --- CLI ---------------------------------------------------------------------

function run(action: (opts: GlobalOpts, ...args: string[]) => Promise<void>) {
    return (...args: unknown[]) => {
        // commander passes the Command as the last argument; the global opts live on its parent
        const command = args[args.length - 1] as Command;
        const opts = command.parent?.opts<GlobalOpts>() ?? (command.opts() as GlobalOpts);
        const positional = args.slice(0, -1) as string[];
        action(opts, ...positional).catch((err: Error) => {
            console.error(`error: ${err.message}`);
            process.exit(1);
        });
    };
}

const program = new Command()
    .name("role-set-admin")
    .description("Administer the RoleSet & User Management of an OPC UA server (OPC 10000-18)")
    .requiredOption("-e, --endpoint <url>", "OPC UA endpoint, e.g. opc.tcp://host:4840")
    .option("-u, --username <name>", "user name (omit for anonymous)")
    .option("-p, --password <password>", "password (prompted with hidden input if omitted)")
    .option("--insecure", "connect without security (None/None) instead of SignAndEncrypt");

program.command("list-roles").description("list all Roles and their identities").action(run(listRoles));
program.command("show-role <name>").description("show one Role's identities").action(run(showRole));
program.command("add-role <name>").description("add a custom Role").action(run(addRole));
program.command("remove-role <name>").description("remove a custom Role").action(run(removeRole));
program.command("add-identity <role> <user>").description("map a UserName to a Role").action(run(addIdentity));
program.command("remove-identity <role> <user>").description("unmap a UserName from a Role").action(run(removeIdentity));
program.command("list-users").description("list managed users").action(run(listUsers));
program
    .command("add-user <user> <password>")
    .description("add a user, optionally granting Roles")
    .option("-r, --role <name...>", "Role(s) to grant", [])
    .action((user: string, password: string, cmdOpts: { role: string[] }, command: Command) => {
        const opts = command.parent?.opts<GlobalOpts>() as GlobalOpts;
        addUser(opts, user, password, cmdOpts.role).catch((err: Error) => {
            console.error(`error: ${err.message}`);
            process.exit(1);
        });
    });
program.command("remove-user <user>").description("remove a user").action(run(removeUser));
program.command("change-password <old> <new>").description("change the connected user's password").action(run(changePassword));

program.parse(process.argv);
