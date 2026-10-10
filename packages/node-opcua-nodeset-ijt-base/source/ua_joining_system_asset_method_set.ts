import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { QualifiedName } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The JoiningSystemAssetMethodSetType provides a
 * set of methods for various assets in a joining
 * system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningSystemAssetMethodSetType i=1026                      |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningSystemAssetMethodSet_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * disconnectAsset
     * The Method DisconnectAsset is used to disconnect
     * or connect the asset.
     */
    disconnectAsset?: UAMethod;
    /**
     * enableAsset
     * The Method EnableAsset is used to Enable or
     * Disable a given asset. It is mostly applicable
     * for Tool.
     * The joining system can report a respective event
     * when an asset is enabled or disabled.
     */
    enableAsset?: UAMethod;
    /**
     * executeOperation
     * The Method ExecuteOperation is an application
     * specific interface to execute any generic
     * operations supported by a joining system.
     */
    executeOperation?: UAMethod;
    /**
     * getErrorInformation
     * The Method GetErrorInformation is used to get the
     * error information based on the input identifier.
     * The details returned from the joining system is
     * application specific.
     */
    getErrorInformation?: UAMethod;
    /**
     * getFeedbackFileList
     * The Method GetFeedbackFileList is used to get the
     * list of feedback files from the asset.
     */
    getFeedbackFileList?: UAMethod;
    /**
     * getIdentifiers
     * The Method GetIdentifiers is used to get the list
     * of identifiers available in the system which were
     * managed by external systems.
     */
    getIdentifiers?: UAMethod;
    /**
     * getIOSignals
     * The Method GetIOSignals is used to get the list
     * of available signals from the asset.
     */
    getIOSignals?: UAMethod;
    /**
     * rebootAsset
     * The Method RebootAsset is used to reboot an asset.
     */
    rebootAsset?: UAMethod;
    /**
     * resetIdentifiers
     * The Method ResetIdentifiers is used to reset the
     * specified identifiers.
     */
    resetIdentifiers?: UAMethod;
    /**
     * sendFeedback
     * The Method SendFeedback is used to send any type
     * of feedback to a given asset. The feedback can be
     * a text input or other types of feedback supported
     * by the asset.
     */
    sendFeedback?: UAMethod;
    /**
     * sendIdentifiers
     * The Method SendIdentifiers is used to send one or
     * more identifiers to the joining system.
     * These identifiers can be used for selection of a
     * joining process, etc.
     * These identifiers can often be part of the
     * generated result. 
     * The input argument to this method is an array of
     * EntityDataType structure where every entity in
     * the joining system can be associated to a
     * specific type for filtering.
     */
    sendIdentifiers?: UAMethod;
    /**
     * sendTextIdentifiers
     * The Method SendTextIdentifiers is used to send
     * one or more identifiers to a joining system. 
     * These identifiers can be used for selection of a
     * joining process, etc.
     * These identifiers can often be part of the
     * generated result. 
     * Note: The decision on which set of identifiers
     * are used for the selection of a joining process
     * and which set of identifiers should be part of
     * the generated result is application specific.
     */
    sendTextIdentifiers?: UAMethod;
    /**
     * setCalibration
     * The Method SetCalibration is used to set the
     * calibration information of a given asset. 
     * It is intended to set the basic calibration
     * information and does not cover the certification
     * process.
     */
    setCalibration?: UAMethod;
    /**
     * setIOSignals
     * The Method SetIOSignals is used to set a list of
     * IO signals of the asset. The type of operations
     * mapped to each signal is application specific.
     */
    setIOSignals?: UAMethod;
    /**
     * setOfflineTimer
     * The Method SetOfflineTimer is used to set the
     * offline timer for the asset to determine how long
     * the asset can perform the joining operations in
     * an offline mode. 
     * Note: If an asset performs the joining operation
     * in offline mode after setting the offline timer,
     * the corresponding results generated shall have
     * the IsGeneratedOffline flag set to TRUE.
     */
    setOfflineTimer?: UAMethod;
    /**
     * setTime
     * The Method SetTime is used to set the time of the
     * asset manually. It is recommended to be used only
     * when an asset does not have automated time
     * synchronization.
     * The joining system can report a respective event
     * when the time is configured manually using this
     * method.
     */
    setTime?: UAMethod;
}
export interface UAJoiningSystemAssetMethodSet extends UAObject, UAJoiningSystemAssetMethodSet_Base {}