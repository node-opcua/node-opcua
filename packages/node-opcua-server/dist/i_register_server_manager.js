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
export var RegisterServerManagerStatus;
(function (RegisterServerManagerStatus) {
    RegisterServerManagerStatus[RegisterServerManagerStatus["INACTIVE"] = 1] = "INACTIVE";
    RegisterServerManagerStatus[RegisterServerManagerStatus["INITIALIZING"] = 2] = "INITIALIZING";
    RegisterServerManagerStatus[RegisterServerManagerStatus["INITIALIZED"] = 3] = "INITIALIZED";
    RegisterServerManagerStatus[RegisterServerManagerStatus["REGISTERING"] = 4] = "REGISTERING";
    RegisterServerManagerStatus[RegisterServerManagerStatus["REGISTERED"] = 5] = "REGISTERED";
    RegisterServerManagerStatus[RegisterServerManagerStatus["WAITING"] = 6] = "WAITING";
    RegisterServerManagerStatus[RegisterServerManagerStatus["UNREGISTERING"] = 7] = "UNREGISTERING";
    RegisterServerManagerStatus[RegisterServerManagerStatus["UNREGISTERED"] = 8] = "UNREGISTERED";
    RegisterServerManagerStatus[RegisterServerManagerStatus["NOT_APPLICABLE"] = -1] = "NOT_APPLICABLE";
    RegisterServerManagerStatus[RegisterServerManagerStatus["DISPOSING"] = 9] = "DISPOSING";
})(RegisterServerManagerStatus || (RegisterServerManagerStatus = {}));
//# sourceMappingURL=i_register_server_manager.js.map