import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The ProgramTemplateType provides a program
 * template.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProgramTemplateType i=1018                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAProgramTemplate_Base {
    /**
     * author
     * Author is the user who created the template.
     */
    author: UAProperty<UAString, DataType.String>;
    /**
     * created
     * Created is the time of the template’s creation.
     */
    created: UAProperty<Date, DataType.DateTime>;
    /**
     * $description
     * Description is a human-readable description of
     * the template.
     */
    "$description": UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * modified
     * Modified is the time of last modification.
     */
    modified: UAProperty<Date, DataType.DateTime>;
    /**
     * deviceTemplateId
     * DeviceTemplateId is the program template's
     * identifier unique within the scope of the device.
     */
    deviceTemplateId: UAProperty<UAString, DataType.String>;
    /**
     * version
     * Version is the version of the template (the
     * format is at the user’s discretion).
     */
    version: UAProperty<UAString, DataType.String>;
    /**
     * supervisoryTemplateId
     * SupervisoryTemplateId is an optional
     * enterprise-wide unique ID for the template. This
     * can be utilized to refer the template to
     * supervisory systems.
     */
    supervisoryTemplateId?: UAProperty<UAString, DataType.String>;
}
export interface UAProgramTemplate extends UAObject, UAProgramTemplate_Base {}