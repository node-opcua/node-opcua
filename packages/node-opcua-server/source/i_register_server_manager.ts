/**
 * @module node-opcua-server
 */
import { EventEmitter } from "events";

/**
 * Finite State Machine for RegisterServerManager.
 *
 * This state machine defines the lifecycle of the server's registration with an LDS.
 * It's designed to handle all transitions, including successful operations,
 * failures, and interruptions (e.g., a stop call during a start operation).
 *
 * **States:**
 * - **INACTIVE**: The manager is not running.
 * - **INITIALIZING**: The initial connection phase to retrieve endpoints from the LDS.
 * - **INITIALIZED**: The initial connection was successful, and endpoints were retrieved.
 * - **REGISTERING**: The manager is actively sending a RegisterServer request.
 * - **REGISTERED**: The server has successfully registered.
 * - **WAITING**: The server is registered and waiting for the next renewal period.
 * - **UNREGISTERING**: The manager is sending an unregister request.
 * - **UNREGISTERED**: The server has been successfully unregistered.
 *
 * **Transitions:**
 * - `INACTIVE` -> `INITIALIZING`: Triggered by `start()`.
 * - `INITIALIZING` -> `INITIALIZED`: On successful initial connection.
 * - `INITIALIZING` -> `INACTIVE`: On connection failure.
 * - `INITIALIZED` -> `REGISTERING`: Immediately after initialization.
 * - `REGISTERING` -> `REGISTERED`: On successful registration.
 * - `REGISTERING` -> `INACTIVE`: On registration failure.
 * - `REGISTERED` -> `WAITING`: Immediately after registration.
 * - `WAITING` -> `REGISTERING`: On renewal timer expiration.
 * - `WAITING` -> `UNREGISTERING`: Triggered by `stop()`.
 * - `UNREGISTERING` -> `UNREGISTERED`: On successful unregistration.
 * - `UNREGISTERING` -> `INACTIVE`: On unregistration failure.
 * - `UNREGISTERED` -> `INACTIVE`: Immediately after unregistration.
 * - Any state can transition to `INACTIVE` on a fatal interruption.
 *
 */
export enum RegisterServerManagerStatus {
    INACTIVE = 1,
    INITIALIZING = 2,
    INITIALIZED = 3,
    REGISTERING = 4,
    REGISTERED = 5,
    WAITING = 6,
    UNREGISTERING = 7,
    UNREGISTERED = 8,
    NOT_APPLICABLE = -1,
    
    DISPOSING = 9
}



export interface IRegisterServerManager extends EventEmitter {
    /** The URL of the discovery server the manager is configured to connect to. */
    discoveryServerEndpointUrl: string;
    /**
     * Initiates the server registration process with the discovery server.
     * This method is idempotent and will throw an error if called when the manager is not in the INACTIVE state.
     */
    start(): Promise<void>;
    /**
     * Gracefully unregisters the server from the discovery server and halts the renewal process.
     * This method can be safely called at any point; it will ensure a clean shutdown.
     */
    stop(): Promise<void>;
    /**
     * Disposes of all resources, rendering the manager unusable.
     */
    dispose(): void;
    /**
     * Returns the current state of the registration manager.
     */
    getState(): RegisterServerManagerStatus;

    // tslint:disable:unified-signatures
    on(eventName: "serverRegistrationPending", eventHandler: () => void): this;
    on(eventName: "serverRegistered", eventHandler: () => void): this;
    on(eventName: "serverRegistrationRenewed", eventHandler: () => void): this;
    on(eventName: "serverUnregistered", eventHandler: () => void): this;
}
