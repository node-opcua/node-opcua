/**
 * @module node-opcua-address-space
 */

import { types } from "node:util";
import chalk from "chalk";
import type { IAddressSpace, INamespace } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { DataType, VariantArrayType } from "node-opcua-variant";
import type { AddressSpacePrivate } from "../../impl/address_space_private.js";
import { type BaseNodeImpl, flushSharedChildAccessors } from "../../impl/base_node_impl.js";
import { BaseNode_resetChildIndex } from "../../impl/base_node_private.js";
import type { NamespacePrivate } from "../../impl/namespace_private.js";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import { ensureDatatypeExtracted } from "./ensure_datatype_extracted.js";
import { promoteObjectsAndVariables } from "./namespace_post_step.js";
import { type NodesetRecordProducer, type NodesetRecordWithBytes, recordBytes } from "./nodeset_record.js";
import { type LoaderTaskQueues, makeLoaderTaskQueues, NodesetRecordApplier, type Task } from "./nodeset_record_applier.js";
import { xmlNodesetRecords } from "./nodeset_xml_producer.js";

const doDebug = checkDebugFlag("load_nodeset2");
const debugLog = make_debugLog("load_nodeset2");
const errorLog = make_errorLog("load_nodeset2");

function __make_back_references(namespace: INamespace) {
    const namespaceP = namespace as NamespacePrivate;
    for (const node of namespaceP.nodeIterator()) {
        (node as BaseNodeImpl).propagate_back_references_declared_from_both_ends();
    }
    // Children are reached through shared accessors resolved on the child index (see
    // impl/child_accessors.ts), so there is no per-node property installation to run here any
    // more: that sweep was four reference scans per node, 12% of a load. What the load may have
    // left behind is an index built earlier on a node that just gained children, so drop them all;
    // they are rebuilt on first use.
    for (const node of namespaceP.nodeIterator()) {
        BaseNode_resetChildIndex(node);
    }
}

function make_back_references(addressSpace: IAddressSpace): void {
    const addressSpacePrivate = addressSpace as AddressSpacePrivate;
    addressSpacePrivate.suspendBackReference = false;
    // the getters of every browse name the files declared, in one batch (see child_accessors.ts)
    flushSharedChildAccessors();
    addressSpace.getNamespaceArray().map(__make_back_references);
}

const DEFAULT_YIELD_EVERY_BYTES = 8 * 1024 * 1024;

const yieldToEventLoop = (): Promise<void> =>
    new Promise<void>((resolve) => (typeof setImmediate === "function" ? setImmediate(resolve) : setTimeout(resolve, 0)));

/**
 * loads NodeSet2 documents into an address space: each document is a stream of records (see
 * {@link NodesetRecord}) that an applier turns into nodes; `terminate` runs the work deferred
 * until every document is in
 */
export class NodeSetLoader {
    private readonly addressSpace: AddressSpacePrivate;
    private readonly options: NodeSetLoaderOptions;
    private readonly queues: LoaderTaskQueues;
    private readonly applier: NodesetRecordApplier;
    private readonly yieldEveryBytes: number;

    constructor(addressSpace: IAddressSpace, options?: NodeSetLoaderOptions) {
        this.addressSpace = addressSpace as AddressSpacePrivate;
        this.addressSpace.suspendBackReference = true;
        this.options = options || {};
        this.options.loadDeprecatedNodes = this.options.loadDeprecatedNodes === undefined ? true : this.options.loadDeprecatedNodes;
        this.options.loadDraftNodes = this.options.loadDraftNodes || false;
        this.yieldEveryBytes =
            this.options.yieldEveryBytes === undefined ? DEFAULT_YIELD_EVERY_BYTES : this.options.yieldEveryBytes;
        this.queues = makeLoaderTaskQueues();
        this.applier = new NodesetRecordApplier(this.addressSpace, this.options, this.queues);
    }

    /** load a document given whole */
    async addNodeSetAsync(xmlData: string): Promise<void> {
        await this.addNodeSetStream([xmlData]);
    }

    /** load a document delivered as text chunks; see {@link NodesetSource} */
    async addNodeSetStream(chunks: AsyncIterable<string> | Iterable<string>): Promise<void> {
        await this.addRecords(xmlNodesetRecords(chunks));
    }

    /** load a document from any producer of records: the XML reader, or a replayed image */
    async addRecords(records: NodesetRecordProducer): Promise<void> {
        const budget = this.yieldEveryBytes;
        let sinceLastYield = 0;
        try {
            for await (const record of records) {
                this.applier.apply(record);
                sinceLastYield += (record as NodesetRecordWithBytes)[recordBytes] ?? 0;
                if (budget > 0 && sinceLastYield >= budget) {
                    sinceLastYield = 0;
                    await yieldToEventLoop();
                }
            }
        } catch (err) {
            // the address space holds what was loaded before the failure and must be disposed;
            // it is not left in the middle of a load
            this.addressSpace.suspendBackReference = false;
            throw err;
        }
    }

    async terminate(): Promise<void> {
        const addressSpace1 = this.addressSpace;
        const queues = this.queues;
        make_back_references(addressSpace1);

        // setting up Server_NamespaceArray

        if (addressSpace1.rootFolder?.objects?.server?.namespaceArray) {
            addressSpace1.rootFolder.objects.server.namespaceArray.setValueFromSource({
                arrayType: VariantArrayType.Array,
                dataType: DataType.String,
                value: addressSpace1.getNamespaceArray().map((ns) => ns.namespaceUri)
            });
            // c8 ignore next
            if (doDebug) {
                debugLog(
                    "addressSpace NS = ",
                    addressSpace1.rootFolder.objects.server.namespaceArray.readValue().value.value.join(" ")
                );
            }
        }
        doDebug &&
            debugLog(
                chalk.bgGreenBright("Performing post loading tasks -------------------------------------------") +
                    chalk.green("DONE")
            );

        /**
         * run every queued post-loading task.
         *
         * A task that throws (typically: a `<Value>` in a third-party nodeset that does not
         * match the declared DataType) is logged and skipped — it must NOT abort the remaining
         * tasks nor the remaining stages of finalSteps(). Previously the failing task was
         * re-run inside the catch block, the second throw escaped the loop, finalSteps() was
         * abandoned and `ensureDatatypeExtracted` was never called: the address space was
         * left half-initialised (no DataTypeManager) and any later use of a structured
         * DataType failed with an opaque
         * "Cannot read properties of undefined (reading 'getExtensionObjectConstructorFromDataType')".
         */
        async function performPostLoadingTasks(stage: string, tasks: Task[]): Promise<void> {
            for (const task of tasks) {
                try {
                    await task(addressSpace1);
                } catch (err) {
                    // c8 ignore next
                    if (types.isNativeError(err)) {
                        errorLog(
                            `[NODE-OPCUA-W36] generateAddressSpace: post-loading task failed during "${stage}" and was skipped: ${err.message}`
                        );
                        doDebug && debugLog(err);
                    }
                }
            }
            tasks.splice(0);
        }
        async function finalSteps(): Promise<void> {
            /// ----------------------------------------------------------------------------------------
            // perform post task
            doDebug && debugLog(chalk.bgGreenBright("Performing post loading tasks -------------------------------------------"));
            await performPostLoadingTasks("post tasks", queues.postTasks);

            doDebug &&
                debugLog(chalk.bgGreenBright("Performing post loading task: Initializing Simple Variables ---------------------"));
            await performPostLoadingTasks("initializing simple variables", queues.postTasks0_InitializeVariable);

            doDebug && debugLog(chalk.bgGreenBright("Performing DataType extraction -------------------------------------------"));
            assert(!addressSpace1.suspendBackReference);
            await ensureDatatypeExtracted(addressSpace1);
            const dataTypeManager = addressSpace1.getDataTypeManager();

            /// ----------------------------------------------------------------------------------------
            doDebug && debugLog(chalk.bgGreenBright("DataType extraction done ") + chalk.green("DONE"));

            for (const { name: _name, dataTypeNodeId } of queues.pendingSimpleTypeToRegister) {
                if (dataTypeNodeId.namespace === 0) {
                    continue;
                }
                dataTypeManager.getDataTypeFactoryForNamespace(dataTypeNodeId.namespace);
            }
            queues.pendingSimpleTypeToRegister.splice(0);

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading task: Decoding Pojo String (parsing XML objects) -"));
            await performPostLoadingTasks("decoding XML extension objects", queues.postTasks0_DecodePojoString);

            doDebug &&
                debugLog(chalk.bgGreenBright("Performing post loading task: Initializing Complex Variables ---------------------"));
            await performPostLoadingTasks("initializing complex variables", queues.postTasks1_InitializeVariable);

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading tasks: (assigning Extension Object to Variables) -"));
            await performPostLoadingTasks(
                "assigning extension objects to variables",
                queues.postTasks2_AssignedExtensionObjectToDataValue
            );

            doDebug && debugLog(chalk.bgGreenBright("Performing post variable initialization ---------------------"));
            // awaited: a promoter that throws must reject generateAddressSpace, not surface later
            // as an unhandled rejection once the caller believes the address space is complete
            await promoteObjectsAndVariables(addressSpace1);
        }

        try {
            await finalSteps();
        } catch (err) {
            // `renderError` was a no-op here, so a failure in the final steps (DataType extraction,
            // promotion of objects/variables, ...) used to be silently swallowed and the caller was
            // handed back a half-initialised address space. Surface it: log and re-throw so that
            // generateAddressSpace() rejects.
            const message = types.isNativeError(err) ? err.message : String(err);
            errorLog(`[NODE-OPCUA-E30] generateAddressSpace: final post-loading steps failed: ${message}`);
            throw err;
        }
    }
}
