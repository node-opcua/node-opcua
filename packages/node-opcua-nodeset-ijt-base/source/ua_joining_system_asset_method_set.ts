// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"

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
    disconnectAsset?: UAMethod;
    enableAsset?: UAMethod;
    executeOperation?: UAMethod;
    getErrorInformation?: UAMethod;
    getFeedbackFileList?: UAMethod;
    getIdentifiers?: UAMethod;
    getIOSignals?: UAMethod;
    rebootAsset?: UAMethod;
    resetIdentifiers?: UAMethod;
    sendFeedback?: UAMethod;
    sendIdentifiers?: UAMethod;
    sendTextIdentifiers?: UAMethod;
    setCalibration?: UAMethod;
    setIOSignals?: UAMethod;
    setOfflineTimer?: UAMethod;
    setTime?: UAMethod;
}
export interface UAJoiningSystemAssetMethodSet extends UAObject, UAJoiningSystemAssetMethodSet_Base {
}