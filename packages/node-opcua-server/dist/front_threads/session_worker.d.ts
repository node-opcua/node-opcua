/**
 * @module node-opcua-server
 *
 * A session worker: the thread that hosts the subscriptions of the sessions the engine gave it.
 * The fronts forward the subscription services of those sessions here (CreateSubscription,
 * CreateMonitoredItems, Publish, ...); the services of OPCUAServerCore answer them, over a
 * stand-in for the front's secure channel that posts each response back to that front. Monitored
 * items sample the compact namespaces in place, as the fronts read them, and hear of the values
 * written from the engine, which pushes them.
 */
export {};
//# sourceMappingURL=session_worker.d.ts.map