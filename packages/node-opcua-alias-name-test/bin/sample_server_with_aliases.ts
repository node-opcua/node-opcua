/**
 * A small, standalone OPC UA server publishing AliasNames (OPC 10000-17), so
 * tests — and humans running UACTT — have something real to connect to.
 *
 * It stands up a true `OPCUAServer` over TCP and publishes a small ISA-5.1 style
 * tag tree over **explicitly modelled** Nodes, because that bridge is the reason
 * the feature exists: a Client asks for `TI101` and gets back the NodeId of a
 * Variable whose BrowseName is `TemperatureIndicator`, without being configured
 * with that NodeId in advance.
 *
 * ```text
 * Aliases                                 (i=23470)
 *  +- TagVariables                        (i=23479)
 *      +- TI101      -> Unit100/Reactor/TemperatureIndicator
 *      +- FIT-101    -> Unit100/Reactor/FlowIndicatorTransmitter
 *      +- Unit200                         (a vendor subcategory)
 *          +- LSH-201 -> Unit200/Tank/LevelSwitchHigh
 * ```
 *
 * `LSH-201` sits in a nested vendor subcategory on purpose: a `FindAlias` call
 * on `Aliases` must find it, which is what proves the search is recursive
 * (clause 6.3.1), and `FindAliasVerbose` must report `Unit200` rather than the
 * category the call was made on (clause 6.3.3).
 *
 * The server advertises the `ALIAS` capability (OPC 10000-12 Annex D Table D.1).
 * It does **not** set it explicitly: `installAliasNames` adds it, which is why
 * this sample calls it between `initialize()` and `start()` -- mDNS registration
 * reads the capability list during `start()`.
 *
 * Run standalone:
 *   npm run sample-server --workspace node-opcua-alias-name-test
 *   npx tsx packages/node-opcua-alias-name-test/bin/sample_server_with_aliases.ts
 *
 * Or import {@link startSampleServer} from a test.
 */
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import type { IAddressSpace, ISessionContext, UAObject, UAVariable } from "node-opcua-address-space";
import {
    ALIAS_SERVER_CAPABILITY_ID,
    addAlias,
    addAliasCategory,
    installAliasNames,
    WellKnownCategories
} from "node-opcua-alias-name-server";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import type { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { OPCUAServer } from "node-opcua-server";
import { DataType } from "node-opcua-variant";

/** Default TCP port for the sample server. */
export const SAMPLE_SERVER_PORT = 48557;

/**
 * The `ALIAS` ServerCapability identifier (OPC 10000-12 Annex D Table D.1),
 * re-exported so tests can assert it without importing the server package.
 */
export const ALIAS_CAPABILITY = ALIAS_SERVER_CAPABILITY_ID;

/**
 * Demo credentials. `engineer` may see every category; `contractor` is denied
 * the `Unit200` subcategory, which is what makes the per-category read gate
 * observable over a real session.
 */
export const SAMPLE_USERS = {
    engineer: { userName: "engineer", password: "engineer-pw1" },
    contractor: { userName: "contractor", password: "contractor-pw1" }
} as const;

export interface SampleServerOptions {
    port?: number;
    /** PKI root folder (defaults to a unique temp folder). */
    pkiRoot?: string;
    /** Allow anonymous sessions. Default true, so UACTT can connect unauthenticated. */
    allowAnonymous?: boolean;
    /**
     * Add this many extra aliases under a `Bulk` category.
     *
     * Used by the chunking test to produce a result set large enough to span
     * more than one message chunk. Zero by default, so a human running the
     * sample sees only the readable tag tree.
     */
    bulkAliasCount?: number;
    /** Cap for a single FindAlias call. */
    maxResults?: number;
    /**
     * Expose `AddAliasesToCategory` / `DeleteAliasesFromCategory` (CU 5874).
     *
     * Off by default, matching the library. When on, `engineer` may write and
     * `contractor` may not, so the write gate is observable from a Client.
     */
    configurationMethods?: boolean;
    /** File backing the persisted `LastChange` (clause 6.3.1). */
    persistencePath?: string;
    /**
     * Gate reads per category. Default denies `Unit200` to `contractor`, which
     * is the behaviour the permission tests assert.
     */
    isReadAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
}

export interface SampleServerHandle {
    server: OPCUAServer;
    endpointUrl: string;
    /** NodeIds tests need without browsing for them. */
    nodeIds: {
        temperatureIndicator: NodeId;
        flowIndicatorTransmitter: NodeId;
        levelSwitchHigh: NodeId;
        unit200Category: NodeId;
        bulkCategory: NodeId | null;
    };
    shutdown(): Promise<void>;
}

/**
 * Start the sample server. Resolves once it is listening; call
 * {@link SampleServerHandle.shutdown} to stop it.
 */
export async function startSampleServer(options?: SampleServerOptions): Promise<SampleServerHandle> {
    const port = options?.port ?? SAMPLE_SERVER_PORT;
    const pkiRoot =
        options?.pkiRoot ?? path.join(os.tmpdir(), `node-opcua-alias-name-sample-${process.pid}-${port}`);

    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: pkiRoot
    });
    await serverCertificateManager.initialize();

    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        allowAnonymous: options?.allowAnonymous ?? true,
        nodeset_filename: [nodesets.standard],
        // Note: ALIAS is NOT set here. installAliasNames adds it below, which
        // is the point -- declaring the capability is part of installing the
        // feature rather than something each Server has to remember.
        userManager: {
            isValidUser: (userName: string, password: string) =>
                Object.values(SAMPLE_USERS).some((u) => u.userName === userName && u.password === password)
        }
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;
    const nodeIds = buildTagTree(addressSpace, options?.bulkAliasCount ?? 0);

    const unit200 = nodeIds.unit200Category;
    await installAliasNames(server, {
        maxResults: options?.maxResults,
        configurationMethods: options?.configurationMethods ?? false,
        persistencePath: options?.persistencePath,
        // only an engineer may change the alias set
        isWriteAllowed: (context: ISessionContext) => context.getUserName() === SAMPLE_USERS.engineer.userName,
        isReadAllowed:
            options?.isReadAllowed ??
            ((context: ISessionContext, categoryNodeId: NodeId) => {
                // a contractor sees everything except Unit200
                if (context.getUserName() !== SAMPLE_USERS.contractor.userName) {
                    return true;
                }
                return categoryNodeId.toString() !== unit200.toString();
            })
    });

    await server.start();
    const endpointUrl = server.getEndpointUrl();

    return {
        server,
        endpointUrl,
        nodeIds,
        shutdown: async () => {
            await server.shutdown();
        }
    };
}

/**
 * Build the ISA-5.1 style tag tree and the aliases that name it.
 *
 * The Variables carry descriptive BrowseNames and the aliases carry the tag
 * names, which is the whole point: the tag name is a stable, human-known handle
 * onto a Node whose BrowseName and NodeId are engineering details.
 */
function buildTagTree(addressSpace: IAddressSpace, bulkAliasCount: number): SampleServerHandle["nodeIds"] {
    const namespace = addressSpace.registerNamespace("urn:sterfive:alias-name-sample");
    const plant = namespace.addObject({
        browseName: "Plant",
        organizedBy: addressSpace.rootFolder.objects
    }) as UAObject;

    const addUnit = (name: string) => namespace.addObject({ browseName: name, componentOf: plant }) as UAObject;
    const addSensor = (parent: UAObject, browseName: string, value: number) => {
        const variable = namespace.addVariable({
            browseName,
            dataType: "Double",
            componentOf: parent,
            minimumSamplingInterval: 1000
        }) as UAVariable;
        variable.setValueFromSource({ dataType: DataType.Double, value });
        return variable;
    };

    const unit100 = addUnit("Unit100");
    const reactor = namespace.addObject({ browseName: "Reactor", componentOf: unit100 }) as UAObject;
    const temperatureIndicator = addSensor(reactor, "TemperatureIndicator", 21.5);
    const flowIndicatorTransmitter = addSensor(reactor, "FlowIndicatorTransmitter", 3.2);

    const unit200 = addUnit("Unit200");
    const tank = namespace.addObject({ browseName: "Tank", componentOf: unit200 }) as UAObject;
    const levelSwitchHigh = addSensor(tank, "LevelSwitchHigh", 0);

    // TI101 and FIT-101 sit directly under TagVariables...
    addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", temperatureIndicator);
    addAlias(addressSpace, WellKnownCategories.TagVariables, "FIT-101", flowIndicatorTransmitter);

    // ...while LSH-201 sits in a nested vendor subcategory, so a recursive
    // search from Aliases has something to find that a flat one would miss.
    const unit200Category = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Unit200");
    addAlias(addressSpace, unit200Category, "LSH-201", levelSwitchHigh);

    let bulkCategory: UAObject | null = null;
    if (bulkAliasCount > 0) {
        bulkCategory = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Bulk");
        for (let i = 0; i < bulkAliasCount; i++) {
            const tag = `BULK-${String(i).padStart(5, "0")}`;
            const variable = addSensor(plant, `BulkSensor${i}`, i);
            addAlias(addressSpace, bulkCategory, tag, variable);
        }
    }

    return {
        temperatureIndicator: temperatureIndicator.nodeId,
        flowIndicatorTransmitter: flowIndicatorTransmitter.nodeId,
        levelSwitchHigh: levelSwitchHigh.nodeId,
        unit200Category: unit200Category.nodeId,
        bulkCategory: bulkCategory ? bulkCategory.nodeId : null
    };
}

// CLI entry point: parse args and keep the server running until Ctrl-C.
if (require.main === module) {
    const program = new Command()
        .name("sample-server-with-aliases")
        .description("Standalone OPC UA sample server publishing ISA-5.1 style AliasNames (OPC 10000-17)")
        .option("-p, --port <number>", "TCP port to listen on", (v) => Number.parseInt(v, 10), SAMPLE_SERVER_PORT)
        .option("--pki <folder>", "PKI root folder (default: a unique temp folder)")
        .option("--no-anonymous", "disallow anonymous sessions")
        .option("--bulk <number>", "add this many extra aliases under a Bulk category", (v) => Number.parseInt(v, 10), 0)
        .option("--configuration", "expose AddAliasesToCategory / DeleteAliasesFromCategory (CU 5874)")
        .option("--persist <file>", "file backing the persisted LastChange")
        .parse(process.argv);
    const opts = program.opts<{
        port: number;
        pki?: string;
        anonymous: boolean;
        bulk: number;
        configuration?: boolean;
        persist?: string;
    }>();

    startSampleServer({
        port: opts.port,
        pkiRoot: opts.pki,
        allowAnonymous: opts.anonymous,
        bulkAliasCount: opts.bulk,
        configurationMethods: opts.configuration,
        persistencePath: opts.persist
    })
        .then((handle) => {
            console.log(`Sample AliasName server ready at ${handle.endpointUrl}`);
            console.log(`ServerCapabilities advertises: ${ALIAS_CAPABILITY}`);
            console.log("Try:  FindAlias(\"TI101\")  or  FindAlias(\"%101\")  on Aliases (i=23470)");
            if (opts.configuration) {
                console.log("Configuration Methods exposed (CU 5874); only 'engineer' may write.");
            }
            console.log(
                "Users:",
                Object.values(SAMPLE_USERS)
                    .map((u) => `${u.userName}/${u.password}`)
                    .join(", "),
                "- contractor is denied the Unit200 category"
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
