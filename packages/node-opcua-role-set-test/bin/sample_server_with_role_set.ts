/**
 * A small, standalone OPC UA server that exercises the full role-set stack
 * (OPC 10000-18) so tests — and humans — have something real to connect to.
 *
 * It stands up a true `OPCUAServer` (TCP endpoint, SignAndEncrypt) and:
 *   - authenticates users with {@link InMemoryUserManagementStore} (passwords),
 *   - resolves Roles through the {@link installRoleSet} resolver (so AddIdentity
 *     via the RoleSet Methods would change a user's Roles live),
 *   - installs User Management (§5),
 *   - publishes three demo Variables, each carrying explicit per-Role
 *     RolePermissions, so a client's allowed Read/Write depends on its Roles.
 *
 * Demo Roles per Variable (Browse/Read/Write):
 *   - PublicTemperature : Anonymous & AuthenticatedUser read; Operator & SecurityAdmin write
 *   - OperatorSetpoint  : AuthenticatedUser read; Operator & SecurityAdmin read/write (Anonymous: denied)
 *   - AdminSecret       : SecurityAdmin read/write only
 *
 * Run standalone:  npx tsx packages/node-opcua-role-set-test/bin/sample_server_with_role_set.ts
 * Or import {@link startSampleServer} from a test.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { WellKnownRoles } from "node-opcua-address-space";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-client";
import { makeAccessLevelFlag, makePermissionFlag } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { InMemoryIdentityMappingStore, InMemoryUserManagementStore, WellKnownRoleIds } from "node-opcua-role-set-common";
import { createUserManagementUserManager, installRoleSet, installUserManagement } from "node-opcua-role-set-server";
import { OPCUAServer } from "node-opcua-server";
import { IdentityCriteriaType, IdentityMappingRuleType, UserConfigurationMask } from "node-opcua-types";
import { DataType } from "node-opcua-variant";

/** Default TCP port for the sample server. */
export const SAMPLE_SERVER_PORT = 48555;

/** Built-in demo credentials (userName → password) and their resolved Role. */
export const SAMPLE_USERS = {
    admin: { userName: "admin", password: "admin-pw1", role: "SecurityAdmin" },
    operator: { userName: "operator", password: "operator-pw1", role: "Operator" }
} as const;

export interface SampleServerOptions {
    port?: number;
    /** PKI root folder (defaults to a unique temp folder, cleaned up by `shutdown`). */
    pkiRoot?: string;
    /** Allow anonymous sessions (default true — needed for the Anonymous-read demo). */
    allowAnonymous?: boolean;
}

export interface SampleServerHandle {
    server: OPCUAServer;
    endpointUrl: string;
    /** NodeIds of the three demo Variables (so tests need not browse). */
    nodeIds: { publicTemperature: NodeId; operatorSetpoint: NodeId; adminSecret: NodeId };
    shutdown(): Promise<void>;
}

function userRule(userName: string): IdentityMappingRuleType {
    return new IdentityMappingRuleType({ criteriaType: IdentityCriteriaType.UserName, criteria: userName });
}

/**
 * Start the sample server. Resolves once it is listening; call
 * {@link SampleServerHandle.shutdown} to stop it and clean up the temp PKI.
 */
export async function startSampleServer(options?: SampleServerOptions): Promise<SampleServerHandle> {
    const port = options?.port ?? SAMPLE_SERVER_PORT;
    const allowAnonymous = options?.allowAnonymous ?? true;
    const pkiRoot = options?.pkiRoot ?? path.join(os.tmpdir(), `role-set-sample-${port}-${process.pid}`);

    const serverCertificateManager = new OPCUACertificateManager({
        rootFolder: path.join(pkiRoot, "server"),
        automaticallyAcceptUnknownCertificate: true
    });
    await serverCertificateManager.initialize();

    // Passwords live in the user store; Roles are resolved from the identity
    // store (a UserName rule per user) that backs the server `userManager`.
    const userStore = new InMemoryUserManagementStore();
    userStore.addUser(
        SAMPLE_USERS.admin.userName,
        SAMPLE_USERS.admin.password,
        UserConfigurationMask.None,
        "Security administrator"
    );
    userStore.addUser(SAMPLE_USERS.operator.userName, SAMPLE_USERS.operator.password, UserConfigurationMask.None, "Plant operator");

    const identityStore = new InMemoryIdentityMappingStore();
    identityStore.addIdentity(WellKnownRoleIds.SecurityAdmin, userRule(SAMPLE_USERS.admin.userName));
    identityStore.addIdentity(WellKnownRoleIds.Operator, userRule(SAMPLE_USERS.operator.userName));

    const userManager = createUserManagementUserManager(userStore, identityStore);

    const server = new OPCUAServer({
        port,
        allowAnonymous,
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        securityPolicies: [SecurityPolicy.Basic256Sha256],
        serverCertificateManager,
        userManager
    });
    await server.initialize();
    await server.start();
    const endpointUrl = server.getEndpointUrl();

    // Install the RoleSet management Methods (AddRole/AddIdentity/…) and User
    // Management (§5). Role *resolution* is driven by the userManager's identity
    // store seeded above; these expose the management surface on the address space.
    await installRoleSet(server);
    await installUserManagement({ engine: { addressSpace: server.engine.addressSpace } }, { store: userStore });

    const nodeIds = addDemoVariables(server);

    return {
        server,
        endpointUrl,
        nodeIds,
        async shutdown(): Promise<void> {
            await server.shutdown();
            // stop the PKI file-watcher before removing the folder (avoids EPERM on Windows)
            await serverCertificateManager.dispose();
            await fs.rm(pkiRoot, { recursive: true, force: true }).catch(() => undefined);
        }
    };
}

/** Add the three demo Variables (each with explicit per-Role RolePermissions). */
function addDemoVariables(server: OPCUAServer): SampleServerHandle["nodeIds"] {
    const addressSpace = server.engine.addressSpace;
    if (!addressSpace) {
        throw new Error("address space is not available");
    }
    const ns = addressSpace.registerNamespace("http://sterfive.com/UA/RoleSetSample/");
    const folder = ns.addObject({
        organizedBy: addressSpace.rootFolder.objects,
        browseName: "RoleSetSampleDemo"
    });

    const readOnly = makePermissionFlag("Browse | Read") as number;
    const readWrite = makePermissionFlag("Browse | Read | Write") as number;
    const accessLevel = makeAccessLevelFlag("CurrentRead | CurrentWrite");

    const publicTemperature = ns.addVariable({
        componentOf: folder,
        browseName: "PublicTemperature",
        dataType: "Double",
        accessLevel,
        userAccessLevel: accessLevel,
        rolePermissions: [
            { roleId: WellKnownRoles.Anonymous, permissions: readOnly },
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: readOnly },
            { roleId: WellKnownRoles.Operator, permissions: readWrite },
            { roleId: WellKnownRoles.SecurityAdmin, permissions: readWrite }
        ]
    });
    publicTemperature.setValueFromSource({ dataType: DataType.Double, value: 21.5 });

    const operatorSetpoint = ns.addVariable({
        componentOf: folder,
        browseName: "OperatorSetpoint",
        dataType: "Double",
        accessLevel,
        userAccessLevel: accessLevel,
        rolePermissions: [
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: readOnly },
            { roleId: WellKnownRoles.Operator, permissions: readWrite },
            { roleId: WellKnownRoles.SecurityAdmin, permissions: readWrite }
        ]
    });
    operatorSetpoint.setValueFromSource({ dataType: DataType.Double, value: 50.0 });

    const adminSecret = ns.addVariable({
        componentOf: folder,
        browseName: "AdminSecret",
        dataType: "String",
        accessLevel,
        userAccessLevel: accessLevel,
        rolePermissions: [{ roleId: WellKnownRoles.SecurityAdmin, permissions: readWrite }]
    });
    adminSecret.setValueFromSource({ dataType: DataType.String, value: "rotate-me" });

    return {
        publicTemperature: publicTemperature.nodeId,
        operatorSetpoint: operatorSetpoint.nodeId,
        adminSecret: adminSecret.nodeId
    };
}

// CLI entry point: parse args and keep the server running until Ctrl-C.
if (require.main === module) {
    const program = new Command()
        .name("sample-server-with-role-set")
        .description("Standalone OPC UA sample server with role-set management and per-Role Variable permissions")
        .option("-p, --port <number>", "TCP port to listen on", (v) => Number.parseInt(v, 10), SAMPLE_SERVER_PORT)
        .option("--pki <folder>", "PKI root folder (default: a unique temp folder)")
        .option("--no-anonymous", "disallow anonymous sessions")
        .parse(process.argv);
    const opts = program.opts<{ port: number; pki?: string; anonymous: boolean }>();

    startSampleServer({ port: opts.port, pkiRoot: opts.pki, allowAnonymous: opts.anonymous })
        .then((handle) => {
            console.log(`Sample role-set server ready at ${handle.endpointUrl}`);
            console.log(
                "Users:",
                Object.values(SAMPLE_USERS)
                    .map((u) => `${u.userName}/${u.password} (${u.role})`)
                    .join(", ")
            );
            const stop = () => handle.shutdown().then(() => process.exit(0));
            process.on("SIGINT", stop);
            process.on("SIGTERM", stop);
        })
        .catch((err: Error) => {
            console.error("failed to start sample server:", err);
            process.exit(1);
        });
}
