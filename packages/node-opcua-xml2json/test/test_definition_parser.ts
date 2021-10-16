// tslint:disable:no-console
// tslint:disable: object-literal-sort-keys
import * as mocha from "mocha";
import * as should from "should";

import { definitionReaderStateParser, Xml2Json } from "..";

describe("Definition Parser", () => {
    it("should parse a definition bloc", async () => {
        const xmlDoc = `
<Definition Name="1:MyStructureDataType">
    <Field DataType="Int32" Name="Id"/>
    <Field DataType="Double" Name="HighValue"/>
    <Field DataType="Double" Name="LowValue"/>
    <Field DataType="LocalizedText" Name="Comments"/>
    <Field DataType="EUInformation" Name="EngineeringUnits"/>
</Definition>`;

        const parser = new Xml2Json(definitionReaderStateParser);
        const a = await parser.parseString(xmlDoc);
        // console.log(a);
        a.should.eql({
            name: "1:MyStructureDataType",

            fields: [
                {
                    dataType: "Int32",
                    name: "Id",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    dataType: "Double",
                    name: "HighValue",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    dataType: "Double",
                    name: "LowValue",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    dataType: "LocalizedText",
                    name: "Comments",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    dataType: "EUInformation",
                    name: "EngineeringUnits",
                    isOptional: false,
                    valueRank: -1
                }
            ]
        });
    });

    it("should parse a definition bloc 2", async () => {
        const xmlDoc = `
<Definition Name="1:OpticalVerifierScanResult">
    <Field DataType="String" Name="IsoGrade"/>
    <Field DataType="Int16" Name="RMin"/>
    <Field SymbolicName="Decode_" DataType="Int16" Name="Decode"/>
    <Field DataType="Int16" Name="PrintGain"/>
</Definition>`;
        const parser = new Xml2Json(definitionReaderStateParser);
        const a = await parser.parseString(xmlDoc);
        // console.log(a);
        a.should.eql({
            name: "1:OpticalVerifierScanResult",

            fields: [
                {
                    name: "IsoGrade",
                    dataType: "String",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    name: "RMin",
                    dataType: "Int16",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    name: "Decode",
                    dataType: "Int16",
                    symbolicName: "Decode_",
                    isOptional: false,
                    valueRank: -1
                },
                {
                    name: "PrintGain",
                    dataType: "Int16",
                    isOptional: false,
                    valueRank: -1
                }
            ]
        });
    });

    it("should parse a definition bloc 2", async () => {
        const xmlDoc = `
<Definition Name="1:ResultDataType">
            <Field DataType="ResultIdDataType" Name="ResultId">
                <Description>System-wide unique identifier, which is assigned by the system. This ID can be used for fetching exactly this result using the pertinent result management methods and it is identical to the ResultId of the ResultReadyEventType.</Description>
            </Field>
            <Field IsOptional="true" DataType="Boolean" Name="HasTransferableDataOnFile">
                <Description>Indicates that additional data for this result can be retrieved by temporary file transfer.</Description>
            </Field>
            <Field DataType="Boolean" Name="IsPartial">
                <Description>Indicates whether the result is the partial result of a total result.</Description>
            </Field>
            <Field IsOptional="true" DataType="Boolean" Name="IsSimulated">
                <Description>Indicates whether the system was in simulation mode when the result was created.</Description>
            </Field>
            <Field DataType="ResultStateDataType" Name="ResultState">
                <Description>ResultState provides information about the current state of a result and the ResultStateDataType is defined in Section 12.18.</Description>
            </Field>
            <Field IsOptional="true" DataType="MeasIdDataType" Name="MeasId">
                <Description>This identifier is given by the client when starting a single job or continuous execution and transmitted to the vision system. It is used to identify the respective result data generated for this job. Although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds.</Description>
            </Field>
            <Field IsOptional="true" DataType="PartIdDataType" Name="PartId">
                <Description>A PartId is given by the client when starting the job; although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds.</Description>
            </Field>
            <Field IsOptional="true" DataType="RecipeIdExternalDataType" Name="ExternalRecipeId">
                <Description>External Id of the recipe in use which produced the result. The ExternalID is only managed by the environment.</Description>
            </Field>
            <Field DataType="RecipeIdInternalDataType" Name="InternalRecipeId">
                <Description>Internal Id of the recipe in use which produced the result. This ID is system-wide unique and is assigned by the vision system.</Description>
            </Field>
            <Field IsOptional="true" DataType="ProductIdDataType" Name="ProductId">
                <Description>productId which was used to trigger the job which created the result.</Description>
            </Field>
            <Field IsOptional="true" DataType="ConfigurationIdDataType" Name="ExternalConfigurationId">
                <Description>External Id of the configuration in use which produced the result. The ExternalID is only managed by the environment.</Description>
            </Field>
            <Field DataType="ConfigurationIdDataType" Name="InternalConfigurationId">
                <Description>Internal Id of the configuration in use which produced the result. This ID is system-wide unique and is assigned by the vision system.</Description>
            </Field>
            <Field DataType="JobIdDataType" Name="JobId">
                <Description>The ID of the job, created by the transition from state Ready to state SingleExecution or to state ContinuousExecution which produced the result.</Description>
            </Field>
            <Field DataType="UtcTime" Name="CreationTime">
                <Description>CreationTime indicates the time when the result was created. </Description>
            </Field>
            <Field IsOptional="true" DataType="ProcessingTimesDataType" Name="ProcessingTimes">
                <Description>Collection of different processing times that were needed to create the result.</Description>
            </Field>
            <Field IsOptional="true" ValueRank="1" ArrayDimensions="1" Name="ResultContent">
                <Description>Abstract data type to be subtyped from to hold result data created by the selected recipe.</Description>
            </Field>
        </Definition>`;

        const parser = new Xml2Json(definitionReaderStateParser);
        const a = await parser.parseString(xmlDoc);
        // console.log(a);
        a.should.eql({
            name: "1:ResultDataType",
            fields: [
                {
                    dataType: "ResultIdDataType",
                    name: "ResultId",
                    isOptional: false,
                    valueRank: -1,
                    description:
                        "System-wide unique identifier, which is assigned by the system. This ID can be used for fetching exactly this result using the pertinent result management methods and it is identical to the ResultId of the ResultReadyEventType."
                },
                {
                    dataType: "Boolean",
                    isOptional: true,
                    valueRank: -1,
                    name: "HasTransferableDataOnFile",
                    description: "Indicates that additional data for this result can be retrieved by temporary file transfer."
                },
                {
                    dataType: "Boolean",
                    name: "IsPartial",
                    isOptional: false,
                    valueRank: -1,
                    description: "Indicates whether the result is the partial result of a total result."
                },
                {
                    dataType: "Boolean",
                    isOptional: true,
                    valueRank: -1,
                    name: "IsSimulated",
                    description: "Indicates whether the system was in simulation mode when the result was created."
                },
                {
                    dataType: "ResultStateDataType",
                    name: "ResultState",
                    isOptional: false,
                    valueRank: -1,
                    description:
                        "ResultState provides information about the current state of a result and the ResultStateDataType is defined in Section 12.18."
                },
                {
                    dataType: "MeasIdDataType",
                    isOptional: true,
                    valueRank: -1,
                    name: "MeasId",
                    description:
                        "This identifier is given by the client when starting a single job or continuous execution and transmitted to the vision system. It is used to identify the respective result data generated for this job. Although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds."
                },
                {
                    dataType: "PartIdDataType",
                    isOptional: true,
                    valueRank: -1,
                    name: "PartId",
                    description:
                        "A PartId is given by the client when starting the job; although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds."
                },
                {
                    dataType: "RecipeIdExternalDataType",
                    name: "ExternalRecipeId",
                    isOptional: true,
                    valueRank: -1,
                    description:
                        "External Id of the recipe in use which produced the result. The ExternalID is only managed by the environment."
                },
                {
                    dataType: "RecipeIdInternalDataType",
                    name: "InternalRecipeId",
                    isOptional: false,
                    valueRank: -1,
                    description:
                        "Internal Id of the recipe in use which produced the result. This ID is system-wide unique and is assigned by the vision system."
                },
                {
                    dataType: "ProductIdDataType",
                    name: "ProductId",
                    isOptional: true,
                    valueRank: -1,
                    description: "productId which was used to trigger the job which created the result."
                },
                {
                    dataType: "ConfigurationIdDataType",
                    name: "ExternalConfigurationId",
                    isOptional: true,
                    valueRank: -1,
                    description:
                        "External Id of the configuration in use which produced the result. The ExternalID is only managed by the environment."
                },
                {
                    dataType: "ConfigurationIdDataType",
                    name: "InternalConfigurationId",
                    isOptional: false,
                    valueRank: -1,
                    description:
                        "Internal Id of the configuration in use which produced the result. This ID is system-wide unique and is assigned by the vision system."
                },
                {
                    dataType: "JobIdDataType",
                    name: "JobId",
                    isOptional: false,
                    valueRank: -1,
                    description:
                        "The ID of the job, created by the transition from state Ready to state SingleExecution or to state ContinuousExecution which produced the result."
                },
                {
                    dataType: "UtcTime",
                    name: "CreationTime",
                    isOptional: false,
                    valueRank: -1,
                    description: "CreationTime indicates the time when the result was created."
                },
                {
                    dataType: "ProcessingTimesDataType",
                    name: "ProcessingTimes",
                    isOptional: true,
                    valueRank: -1,
                    description: "Collection of different processing times that were needed to create the result."
                },
                {
                    valueRank: 1,
                    arrayDimensions: [1],
                    isOptional: true,
                    name: "ResultContent",
                    description: "Abstract data type to be subtyped from to hold result data created by the selected recipe."
                }
            ]
        });
    });
});
