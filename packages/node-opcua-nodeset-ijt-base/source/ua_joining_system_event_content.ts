// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int64 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTEntity } from "./dt_entity"
import { DTReportedValue } from "./dt_reported_value"
/**
 * The JoiningSystemEventContentType is a subtype of
 * 0:BaseVariableType. It is used
 * JoiningSystemEventType and
 * JoiningSystemConditionType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |JoiningSystemEventContentType i=2008                        |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningSystemEventContent_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    /**
     * associatedEntities
     * AssociatedEntities is a list of identifiers of
     * various entities/objects available in the given
     * system. Example: An event maybe associated to
     * Asset, Result, Joint, Error, etc.
     */
    associatedEntities?: UABaseDataVariable<DTEntity[], DataType.ExtensionObject>;
    /**
     * eventCode
     * EventCode is a system specific event code
     * associated to the given event.
     */
    eventCode?: UABaseDataVariable<Int64, DataType.Int64>;
    /**
     * eventText
     * EventText is a human readable text related to the
     * context of the event.
     */
    eventText?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * joiningTechnology
     * JoiningTechnology is a human readable text to
     * identify the joining technology which has
     * triggered the event. Examples: Tightening,
     * Gluing, Riveting, Flow Drill Fastening, etc.
     */
    joiningTechnology?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * reportedValues
     * ReportedValues is a list of values associated
     * with the given event payload. Example: If it is
     * an over temperature event, then the ReportedValue
     * can be the measured value along with the
     * corresponding limits.
     */
    reportedValues?: UABaseDataVariable<DTReportedValue[], DataType.ExtensionObject>;
}
export interface UAJoiningSystemEventContent<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAJoiningSystemEventContent_Base<T, DT> {
}