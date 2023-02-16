/**
 * @module node-opcua-server-configuration
 */
import * as path from "path";
import * as fs from "fs";
import {
    AddressSpace,
    SessionContext,
    UAMethod,
    UATrustList,
    UAServerConfiguration,
    ISessionContext,
    UACertificateGroup,
    UACertificateExpirationAlarmEx,
    instantiateCertificateExpirationAlarm,
} from "node-opcua-address-space";
import { UAObject, UAVariable, EventNotifierFlags } from "node-opcua-address-space-base";

import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import {
    AccessLevelFlag,
    AccessRestrictionsFlag,
    BrowseDirection,
    coerceQualifiedName,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { ByteString, UAString } from "node-opcua-basic-types";
import { ObjectIds, ObjectTypeIds } from "node-opcua-constants";
import { CertificateManager } from "node-opcua-certificate-manager";
import { Certificate, readCertificate } from "node-opcua-crypto";

import { CreateSigningRequestResult, PushCertificateManager } from "../push_certificate_manager";

import { PushCertificateManagerServerImpl, PushCertificateManagerServerOptions } from "./push_certificate_manager_server_impl";
import { installAccessRestrictionOnTrustList, promoteTrustList } from "./promote_trust_list";
import { hasEncryptedChannel, hasExpectedUserAccess } from "./tools";
import { rolePermissionAdminOnly, rolePermissionRestricted } from "./roles_and_permissions";
import { installCertificateFileWatcher } from "./install_certificate_file_watcher";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");
const errorLog = debugLog;

function expected(variant: Variant | undefined, dataType: DataType, variantArrayType: VariantArrayType): boolean {
    if (!variant) {
        return false;
    }
    if (variant.dataType !== dataType) {
        return false;
    }
    if (variant.arrayType !== variantArrayType) {
        return false;
    }
    return true;
}

function getPushCertificateManager(method: UAMethod): PushCertificateManager | null {
    const serverConfiguration = method.addressSpace.rootFolder.objects.server.getChildByName("ServerConfiguration");
    const serverConfigurationPriv = serverConfiguration as any;
    if (serverConfigurationPriv.$pushCertificateManager) {
        return serverConfigurationPriv.$pushCertificateManager;
    }
    // throw new Error("Cannot find pushCertificateManager object");
    return null;
}

async function _createSigningRequest(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    const certificateGroupIdVariant = inputArguments[0];
    const certificateTypeIdVariant = inputArguments[1];
    const subjectNameVariant = inputArguments[2];
    const regeneratePrivateKeyVariant = inputArguments[3];
    const nonceVariant = inputArguments[4];

    if (!expected(certificateGroupIdVariant, DataType.NodeId, VariantArrayType.Scalar)) {
        warningLog("expecting an NodeId for certificateGroupId - 0");
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(certificateTypeIdVariant, DataType.NodeId, VariantArrayType.Scalar)) {
        warningLog("expecting an NodeId for certificateTypeId - 1");
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(subjectNameVariant, DataType.String, VariantArrayType.Scalar)) {
        warningLog("expecting an String for subjectName - 2");
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(regeneratePrivateKeyVariant, DataType.Boolean, VariantArrayType.Scalar)) {
        warningLog("expecting an Boolean for regeneratePrivateKey - 3");
        return { statusCode: StatusCodes.BadInvalidArgument };
    }
    if (!expected(nonceVariant, DataType.ByteString, VariantArrayType.Scalar)) {
        warningLog("expecting an ByteString for nonceVariant - 4");
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }

    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const certificateGroupId = certificateGroupIdVariant.value as NodeId;
    const certificateTypeId = certificateTypeIdVariant.value as NodeId;
    const subjectName = subjectNameVariant.value as string;
    const regeneratePrivateKey = regeneratePrivateKeyVariant.value as boolean;
    const nonce = nonceVariant.value as Buffer;

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }
    const result: CreateSigningRequestResult = await pushCertificateManager.createSigningRequest(
        certificateGroupId,
        certificateTypeId,
        subjectName,
        regeneratePrivateKey,
        nonce
    );

    if (result.statusCode.isNotGood()) {
        return { statusCode: result.statusCode };
    }

    const callMethodResult = {
        outputArguments: [
            {
                dataType: DataType.ByteString,
                value: result.certificateSigningRequest
            }
        ],
        statusCode: result.statusCode
    };
    return callMethodResult;
}

async function _updateCertificate(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    const certificateGroupId: NodeId = inputArguments[0].value as NodeId;
    const certificateTypeId: NodeId = inputArguments[1].value as NodeId;
    const certificate: Buffer = inputArguments[2].value as Buffer;
    const issuerCertificates: Buffer[] = inputArguments[3].value as Buffer[];
    const privateKeyFormat: UAString = inputArguments[4].value as UAString;
    const privateKey: Buffer = inputArguments[5].value as ByteString;

    // This Method requires an encrypted channel and that the Client provides credentials with
    // administrative rights on the Server
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    if (privateKeyFormat && privateKeyFormat !== "" && privateKeyFormat.toLowerCase() !== "pem") {
        errorLog("_updateCertificate: Invalid PEM format requested " + privateKeyFormat);
        return { statusCode: StatusCodes.BadInvalidArgument };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }

    const result = await pushCertificateManager.updateCertificate(
        certificateGroupId,
        certificateTypeId,
        certificate,
        issuerCertificates,
        privateKeyFormat,
        privateKey
    );

    // todo   raise a CertificateUpdatedAuditEventType

    if (result.statusCode.isNotGood()) {
        return { statusCode: result.statusCode };
    }
    const callMethodResult = {
        outputArguments: [
            {
                dataType: DataType.Boolean,
                value: !!result.applyChangesRequired!
            }
        ],
        statusCode: result.statusCode
    };
    return callMethodResult;
}

async function _getRejectedList(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }

    const result = await pushCertificateManager.getRejectedList();

    if (result.statusCode.isNotGood()) {
        return { statusCode: result.statusCode };
    }

    return {
        outputArguments: [
            {
                arrayType: VariantArrayType.Array,
                dataType: DataType.ByteString,
                value: result.certificates
            }
        ],
        statusCode: StatusCodes.Good
    };
}

async function _applyChanges(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    // This Method requires an encrypted channel and that the Client provide credentials with
    // administrative rights on the Server.
    if (!hasEncryptedChannel(context)) {
        return { statusCode: StatusCodes.BadSecurityModeInsufficient };
    }
    if (!hasExpectedUserAccess(context)) {
        return { statusCode: StatusCodes.BadUserAccessDenied };
    }

    const pushCertificateManager = getPushCertificateManager(this);
    if (!pushCertificateManager) {
        return { statusCode: StatusCodes.BadNotImplemented };
    }
    const statusCode = await pushCertificateManager.applyChanges();
    return { statusCode };
}

function getCertificateFilename(certificateManager: CertificateManager): string {
    return path.join(certificateManager.rootDir, "own/certs/certificate.pem"); // to do , find a better way
}
async function getCertificate(certificateManager: CertificateManager): Promise<Certificate | null> {
    try {
        const certificateFile = getCertificateFilename(certificateManager);
        if (fs.existsSync(certificateFile)) {
            const certificate = await readCertificate(certificateFile);
            return certificate;
        }
        return null;
    } catch (err) {
        warningLog("getCertificate Error", (err as Error).message);
        return null;
    }
}

function bindCertificateGroup(certificateGroup: UACertificateGroup, certificateManager?: CertificateManager) {
    if (certificateManager) {
        const certificateFile = getCertificateFilename(certificateManager);
        const changeDetector = installCertificateFileWatcher(certificateGroup, certificateFile);
        changeDetector.on("certificateChange", () => {
            debugLog("detecting certificate change", certificateFile);
            updateCertificateAlarm();
        });
    }

    async function updateCertificateAlarm() {
        try {
            debugLog("updateCertificateAlarm", certificateGroup.browseName.toString());
            const certificateExpired = certificateGroup.getComponentByName("CertificateExpired");
            if (certificateExpired && certificateManager) {
                const certificateExpiredEx = certificateExpired as unknown as UACertificateExpirationAlarmEx;
                const certificate = await getCertificate(certificateManager);
                certificateExpiredEx.setCertificate(certificate);
            }
        } catch (err) {
            warningLog("updateCertificateAlarm Error", (err as Error).message);
        }
    }

    const addressSpace = certificateGroup.addressSpace;
    if (!certificateManager) {
        return;
    }
    const trustList = certificateGroup.getComponentByName("TrustList");
    if (trustList) {
        (trustList as any).$$certificateManager = certificateManager;
    }
    const certificateExpired = certificateGroup.getComponentByName("CertificateExpired");
    if (certificateExpired) {
        (certificateExpired as any).$$certificateManager = certificateManager;
        // install alarm handling
        const timerId = setInterval(updateCertificateAlarm, 60 * 1000);
        addressSpace.registerShutdownTask(() => clearInterval(timerId));
        updateCertificateAlarm();
    }
}

function bindCertificateManager(addressSpace: AddressSpace, options: PushCertificateManagerServerOptions) {
    const serverConfiguration = addressSpace.rootFolder.objects.server.getChildByName(
        "ServerConfiguration"
    )! as UAServerConfiguration;

    const defaultApplicationGroup = serverConfiguration.certificateGroups.getComponentByName(
        "DefaultApplicationGroup"
    ) as UACertificateGroup | null;
    if (defaultApplicationGroup) {
        bindCertificateGroup(defaultApplicationGroup, options.applicationGroup);
    }
    const defaultTokenGroup = serverConfiguration.certificateGroups.getComponentByName(
        "DefaultUserTokenGroup"
    ) as UACertificateGroup | null;
    if (defaultTokenGroup) {
        bindCertificateGroup(defaultTokenGroup, options.userTokenGroup);
    }
}

function setNotifierOfChain(childObject: UAObject | null) {
    if (!childObject) {
        return;
    }
    const parentObject: UAObject | null = childObject.parent as UAObject | null;
    if (!parentObject) {
        return;
    }
    const notifierOf = childObject.findReferencesEx("HasNotifier", BrowseDirection.Inverse);
    if (notifierOf.length === 0) {
        const notifierOfNode = childObject.addReference({
            referenceType: "HasNotifier",
            nodeId: parentObject.nodeId,
            isForward: false
        });
    }
    parentObject.setEventNotifier(parentObject.eventNotifier | EventNotifierFlags.SubscribeToEvents);
    if (parentObject.nodeId.namespace === 0 && parentObject.nodeId.value === ObjectIds.Server) {
        return;
    }
    setNotifierOfChain(parentObject);
}

export async function promoteCertificateGroup(certificateGroup: UACertificateGroup): Promise<void> {
    const trustList = certificateGroup.getChildByName("TrustList") as UATrustList;
    if (trustList) {
        await promoteTrustList(trustList);
    }
    if (!certificateGroup.certificateExpired) {
        const namespace = certificateGroup.addressSpace.getOwnNamespace();

        // certificateGroup.
        instantiateCertificateExpirationAlarm(namespace, "CertificateExpirationAlarmType", {
            browseName: coerceQualifiedName("0:CertificateExpired"),
            componentOf: certificateGroup,
            conditionSource: null,
            conditionOf: certificateGroup,
            inputNode: NodeId.nullNodeId,
            normalState: NodeId.nullNodeId,
            optionals: ["ExpirationLimit"],
            conditionName: "CertificateExpired",                                                      
            conditionClass: resolveNodeId("CertificateExpirationAlarmType"),
        });
    }
    certificateGroup.setEventNotifier(EventNotifierFlags.SubscribeToEvents);
    setNotifierOfChain(certificateGroup);
}
interface UAServerConfigurationPriv extends UAServerConfiguration { $pushCertificateManager: PushCertificateManagerServerImpl};
export async function installPushCertificateManagement(
    addressSpace: AddressSpace,
    options: PushCertificateManagerServerOptions
): Promise<void> {
    addressSpace.installAlarmsAndConditionsService();

    const serverConfiguration = addressSpace.rootFolder.objects.server.getChildByName(
        "ServerConfiguration"
    )! as UAServerConfiguration;

    const serverConfigurationPriv = serverConfiguration as UAServerConfigurationPriv;
    if (serverConfigurationPriv.$pushCertificateManager) {
        warningLog("PushCertificateManagement has already been installed");
        return;
    }

    const accessRestrictionFlag = AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired;

    function installAccessRestrictions(serverConfiguration: UAObject) {
        serverConfiguration.setRolePermissions(rolePermissionRestricted);
        serverConfiguration.setAccessRestrictions(AccessRestrictionsFlag.None);

        const applyName = serverConfiguration.getMethodByName("ApplyChanges");
        applyName?.setRolePermissions(rolePermissionAdminOnly);
        applyName?.setAccessRestrictions(AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired);

        const createSigningRequest = serverConfiguration.getMethodByName("CreateSigningRequest");
        createSigningRequest?.setRolePermissions(rolePermissionAdminOnly);
        createSigningRequest?.setAccessRestrictions(accessRestrictionFlag);

        const getRejectedList = serverConfiguration.getMethodByName("GetRejectedList");
        getRejectedList?.setRolePermissions(rolePermissionAdminOnly);
        getRejectedList?.setAccessRestrictions(accessRestrictionFlag);

        const updateCertificate = serverConfiguration.getMethodByName("UpdateCertificate");
        updateCertificate?.setRolePermissions(rolePermissionAdminOnly);
        updateCertificate?.setAccessRestrictions(accessRestrictionFlag);

        const certificateGroups = serverConfiguration.getComponentByName("CertificateGroups")!;
        certificateGroups.setRolePermissions(rolePermissionRestricted);
        certificateGroups.setAccessRestrictions(AccessRestrictionsFlag.None);

        function installAccessRestrictionOnGroup(group: UAObject) {
            const trustList = group.getComponentByName("TrustList")!;
            if (trustList) {
                installAccessRestrictionOnTrustList(trustList);
            }
        }
        for (const group of certificateGroups.getComponents()) {
            group.setRolePermissions(rolePermissionAdminOnly);
            group.setAccessRestrictions(AccessRestrictionsFlag.SigningRequired | AccessRestrictionsFlag.EncryptionRequired);
            if (group.nodeClass === NodeClass.Object) {
                installAccessRestrictionOnGroup(group as UAObject);
            }
        }
    }
    installAccessRestrictions(serverConfiguration);

    serverConfigurationPriv.$pushCertificateManager = new PushCertificateManagerServerImpl(options);

    serverConfiguration.supportedPrivateKeyFormats.setValueFromSource({
        arrayType: VariantArrayType.Array,
        dataType: DataType.String,
        value: ["PEM"]
    });

    function install_method_handle_on_type(addressSpace: AddressSpace): void {
        const serverConfigurationType = addressSpace.findObjectType("ServerConfigurationType")! as any;
        if (serverConfigurationType.createSigningRequest.isBound()) {
            return;
        }
        serverConfigurationType.createSigningRequest.bindMethod(_createSigningRequest);
        serverConfigurationType.getRejectedList.bindMethod(_getRejectedList);
        serverConfigurationType.updateCertificate.bindMethod(_updateCertificate);
        serverConfigurationType.applyChanges.bindMethod(_applyChanges);
    }

    install_method_handle_on_type(addressSpace);

    serverConfiguration.createSigningRequest.bindMethod(_createSigningRequest);
    serverConfiguration.updateCertificate.bindMethod(_updateCertificate);
    serverConfiguration.getRejectedList.bindMethod(_getRejectedList);
    if (serverConfiguration.applyChanges) {
        serverConfiguration.applyChanges!.bindMethod(_applyChanges);
    }

    const cg = serverConfiguration.certificateGroups.getComponents();

    const defaultApplicationGroup = serverConfiguration.certificateGroups.getComponentByName("DefaultApplicationGroup")!;
    const certificateTypes = defaultApplicationGroup.getPropertyByName("CertificateTypes") as UAVariable;
    certificateTypes.setValueFromSource({
        dataType: DataType.NodeId,
        arrayType: VariantArrayType.Array,
        value: [resolveNodeId(ObjectTypeIds.RsaSha256ApplicationCertificateType)]
    });

    const certificateGroupType = addressSpace.findObjectType("CertificateGroupType")!;

    for (const certificateGroup of cg) {
        if (certificateGroup.nodeClass !== NodeClass.Object) {
            continue;
        }
        const o = certificateGroup as UAObject;
        if (!o.typeDefinitionObj.isSubtypeOf(certificateGroupType)) {
            continue;
        }
        await promoteCertificateGroup(certificateGroup as UACertificateGroup);
    }
    await bindCertificateManager(addressSpace, options);
}
