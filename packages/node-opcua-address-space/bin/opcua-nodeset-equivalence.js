#!/usr/bin/env node
/**
 * opcua-nodeset-equivalence: does the NDJSON form carry everything the NodeSet2 XML form carries,
 * and nothing of its own? The two forms are equipotent when the answer to both halves is yes, and
 * this tool answers them by construction rather than by inspection.
 *
 *   opcua-nodeset-equivalence <file.xml>... [--require <file.xml>]... [--dump <dir>] [--quiet]
 *
 * Every intermediate is kept: A, B and the two regenerated XML documents are written to --dump, or
 * to a directory under the system temp when none is given, and the path is printed. A failing
 * check is a thing to look at, and looking at it means diffing two files.
 *
 * The whole round trip, on a document from anywhere:
 *
 *     <third party>/NodeSet2.xml  ->  NDJSON (A)  ->  address space
 *                                                        |
 *                        NDJSON (B)  <-  NodeSet2.xml written back by node-opcua
 *
 *                                    A == B
 *
 * A is what the third party's document says; B is what our own document says after the model has
 * been all the way round. If the two agree, nothing was lost anywhere in the loop, and the NDJSON
 * is the place to compare because it is the only one of the four forms with a canonical spelling.
 *
 * "==" is not byte equality, and could not be: two documents are free to order their namespace
 * tables and their node lines differently, so A and B are compared after every id has been
 * resolved through its own document's table into `<namespace uri>;i=<n>`, which is the only
 * spelling of an id two documents can be held to. The comparison is then exact -- same namespaces,
 * same set of nodes, same set of references, same value for every attribute of every node.
 *
 * Three things are reported apart from the verdict, because each is a difference of spelling and
 * not of model, and each is provably harmless once the ids are fully qualified: the *declared*
 * <NamespaceUris> table, whose order is a local choice and which may list a namespace no id refers
 * to (what is compared is the namespaces actually referred to); ParentNodeId, derivable from the
 * aggregating reference, and ambiguous for a node reachable from two parents; and the
 * inverse-declaration hint on a reference.
 *
 * Eight checks per file:
 *
 *   1 records     XML -> records -> NDJSON -> records: the two record streams must agree, field
 *                 by field, once the defaults of the format are applied to both. This is the
 *                 check that a key the writer leaves out is a key the reader puts back.
 *   2 lines       those records re-encoded must give back the very bytes of the NDJSON: the
 *                 encoding is canonical, so a writer and a reader cannot drift apart silently.
 *   3 addressspace  the address space built from the XML and the one built from the NDJSON must
 *                 have the same digest: same nodes, same references, same values.
 *   4 xml         the NodeSet2 XML written from each of those two address spaces must be the
 *                 same bytes: what the XML says can be said again after a trip through NDJSON.
 *   5 A==B nodes  A against B: same namespaces, same set of nodes, same set of references.
 *   6 A==B attrs  A against B again, this time every attribute of every node.
 *   7 fixpoint    a second pass over the exporter's own XML, which reaches constructs a
 *                 hand-written file may not, must again say the same thing either way.
 *   8 xml-idempotent  information, not a verdict: whether the XML pipeline alone is idempotent.
 *
 * What no check here claims is that the regenerated XML is byte-identical to the file on disk.
 * It cannot be, and neither can any other tool's: a NodeSet2 document carries comments, attribute
 * order, entity spellings, indentation and element order that the OPC UA information model does
 * not define, so two files may say exactly the same thing and differ in bytes. Checks 5 and 6
 * compare what the two documents say; check 4 compares their bytes at the first point where a
 * canonical spelling exists -- the exporter's own -- and check 7 shows that spelling is a
 * fixpoint. Together they say: no information is lost in either direction; only the freedom the
 * XML syntax leaves is.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const {
    AddressSpace,
    generateAddressSpaceRaw,
    imageNodesetRecords,
    NodesetImageWriter,
    xmlNodesetRecords
} = require("../dist/api/index.js");
const { digestAddressSpace } = require("../distNodeJS/index.js");
const { asFile, dependencyChain } = require("./nodeset_tool_common.js");

const usage = () => {
    console.error("usage: opcua-nodeset-equivalence <file.xml>... [--require <file.xml>]... [--dump <dir>] [--quiet]");
    process.exit(2);
};

/** what a throw says when it has nothing to say: an assert with no message leaves `message` empty */
const reasonOf = (err) => {
    if (err && err.message) return err.message;
    const frame = String((err && err.stack) || "").split("\n")[1] || "";
    const at = frame.trim().replace(/^at /, "").replace(/ \(.*$/, "");
    return `${(err && err.constructor && err.constructor.name) || "Error"} thrown with no message${at ? ` in ${at}` : ""}`;
};

function parseArgs(argv) {
    const files = [];
    const options = { require: [], dump: undefined, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--require") options.require.push(argv[++i]);
        else if (arg === "--dump") options.dump = argv[++i];
        else if (arg === "--quiet") options.quiet = true;
        else if (arg.startsWith("--")) usage();
        else files.push(arg);
    }
    return { files, options };
}

// #region comparing records

/**
 * the defaults of the NDJSON format, spelled out again here rather than imported from the codec:
 * this tool is the thing that would catch a codec whose writer and reader agree with each other
 * and with nothing else, so it must not take its notion of a default from the codec.
 */
const NODE_DEFAULTS = {
    valueRank: -1,
    arrayDimensions: null,
    minimumSamplingInterval: 0,
    historizing: false,
    isAbstract: false,
    symmetric: false,
    containsNoLoops: false,
    hasNoPermissions: false,
    eventNotifier: 0,
    parentNodeId: null,
    dataType: null,
    methodDeclarationId: null
};
const FIELD_DEFAULTS = { valueRank: -1, allowSubTypes: false, dataType: "ns=0;i=24" };

/** a value of a record as a comparable form: ids, names, dates and buffers all get one spelling */
function normalize(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object") return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "invalid-date" : value.toISOString();
    if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64");
    if (Array.isArray(value)) return value.map(normalize);
    // a NodeId, an ExpandedNodeId or a QualifiedName: its own spelling is canonical and unambiguous
    if (typeof value.identifierType === "number" || typeof value.namespaceIndex === "number") return value.toString();
    const out = {};
    for (const key of Object.keys(value).sort()) {
        if (value[key] === undefined) continue;
        out[key] = normalize(value[key]);
    }
    return out;
}

/** a record with the defaults filled in, so that one that states a default and one that omits it agree */
function canonicalRecord(record) {
    if (record.kind === "header") return normalize(record);
    const out = { ...record };
    for (const [key, fallback] of Object.entries(NODE_DEFAULTS)) {
        if (out[key] === undefined) out[key] = fallback;
    }
    // displayName defaults to the browse name; description and the rest have no default
    if (out.displayName === undefined) out.displayName = record.browseName ? (record.browseName.name ?? "") : "";
    // a value with no arrayType is a scalar (VariantArrayType.Scalar === 0)
    if (out.value && out.value.arrayType === undefined) out.value = { ...out.value, arrayType: 0 };
    // inverseDeclared is not in the document: it is a hint a producer that has seen the whole of it
    // may leave on a reference, and the streaming XML reader, which has not, leaves undefined. The
    // NDJSON knowing more than the XML does is not the NDJSON losing anything, so it is not compared
    out.references = out.references.map((r) => ({ isForward: r.isForward, referenceType: r.referenceType, nodeId: r.nodeId }));
    if (out.definition) {
        out.definition = {
            ...out.definition,
            fields: out.definition.fields.map((f) => {
                const field = { ...f };
                for (const [key, fallback] of Object.entries(FIELD_DEFAULTS)) {
                    if (field[key] === undefined) field[key] = fallback;
                }
                if (typeof field.dataType === "object" && field.dataType !== null) field.dataType = field.dataType.toString();
                return field;
            })
        };
    }
    return normalize(out);
}

/** the paths at which two canonical records differ, at most `limit` of them */
function differences(a, b, limit, prefix = "") {
    const out = [];
    const push = (p, x, y) => {
        if (out.length < limit) out.push(`${p}: ${JSON.stringify(x)} != ${JSON.stringify(y)}`);
    };
    if (a === b) return out;
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
        push(prefix || "(value)", a, b);
        return out;
    }
    if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length)) {
        push(`${prefix}.length`, Array.isArray(a) ? a.length : "not-an-array", Array.isArray(b) ? b.length : "not-an-array");
        return out;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (out.length >= limit) break;
        out.push(...differences(a[key], b[key], limit - out.length, prefix ? `${prefix}.${key}` : key));
    }
    return out;
}
// #endregion

// #region comparing two documents as models

/**
 * The local namespace indices of two documents mean nothing to each other: a document is free to
 * list its <NamespaceUris> in any order, and index 1 of the original need not be index 1 of the
 * document written back out. Everything compared below is therefore first resolved through its own
 * document's table into a fully qualified form, `<namespace uri>;<kind>=<identifier>`, which is the
 * only spelling of an id that two documents can be held to.
 */
const NODE_ID_KIND = { 1: "i", 2: "s", 3: "g", 4: "b" };

function tableOf(header) {
    // index 0 of every document's table is the UA namespace, and is not listed in namespaceUris
    return ["http://opcfoundation.org/UA/", ...(header.namespaceUris || [])];
}

const qualify = (nodeId, uris) => {
    if (!nodeId) return null;
    const uri = uris[nodeId.namespace] ?? `<unknown namespace ${nodeId.namespace}>`;
    const value = Buffer.isBuffer(nodeId.value) ? nodeId.value.toString("base64") : String(nodeId.value);
    return `${uri};${NODE_ID_KIND[nodeId.identifierType] ?? "?"}=${value}`;
};
const qualifyName = (name, uris) => (name ? `${uris[name.namespaceIndex] ?? name.namespaceIndex}#${name.name ?? ""}` : null);

/**
 * a `<Definition Name="3:Foo">` and a `<Field Name="...">` carry the document's own namespace index
 * as a text prefix, so the very same definition reads "3:Foo" in one document and "1:Foo" in
 * another. Resolved like every other index, or two spellings of one name look like two names.
 */
function qualifyPrefixedName(name, uris) {
    if (typeof name !== "string") return name ?? null;
    const m = /^(\d+):(.*)$/.exec(name);
    if (!m) return name;
    return `${uris[Number(m[1])] ?? m[1]}#${m[2]}`;
}

/** anything a record can hold, with every id and name inside it qualified the same way */
function deepQualify(value, uris) {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object") return value;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "invalid-date" : value.toISOString();
    if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64");
    if (Array.isArray(value)) return value.map((e) => deepQualify(e, uris));
    if (typeof value.identifierType === "number") return qualify(value, uris);
    if (typeof value.namespaceIndex === "number") return qualifyName(value, uris);
    const out = {};
    for (const key of Object.keys(value).sort()) {
        if (value[key] === undefined) continue;
        out[key] = deepQualify(value[key], uris);
    }
    return out;
}

/**
 * the attributes of a node that the information model defines, with the defaults of the format
 * applied so that a document that states one and a document that omits it agree.
 *
 * `parentNodeId` is not among them, and that is deliberate: it is an authoring convenience of the
 * NodeSet2 syntax, wholly derivable from the HasComponent or HasProperty reference, and a node
 * reachable from two parents has more than one correct answer -- so two documents may name
 * different parents and describe the same model. It is reported separately (§ parentNodeId below).
 */
const COMPARED_ATTRIBUTES = [
    "nodeClass",
    "displayName",
    "description",
    "symbolicName",
    "inverseName",
    "releaseStatus",
    "accessRestrictions",
    "accessLevel",
    "userAccessLevel",
    "hasNoPermissions",
    "isAbstract",
    "symmetric",
    "containsNoLoops",
    "eventNotifier",
    "valueRank",
    "arrayDimensions",
    "minimumSamplingInterval",
    "historizing",
    "dataType",
    "methodDeclarationId",
    "rolePermissions",
    "value",
    "definition"
];
const ATTRIBUTE_DEFAULTS = {
    valueRank: -1,
    arrayDimensions: null,
    minimumSamplingInterval: 0,
    historizing: false,
    isAbstract: false,
    symmetric: false,
    containsNoLoops: false,
    hasNoPermissions: false,
    eventNotifier: 0,
    dataType: null,
    methodDeclarationId: null,
    // an absent AccessLevel is CurrentRead; an absent UserAccessLevel is the AccessLevel
    accessLevel: "1"
};

/** a document's records as a model: its namespace table, its nodes by qualified id, its references */
function modelOf(records) {
    const header = records.find((r) => r.kind === "header");
    if (!header) throw new Error("the document has no header record");
    const uris = tableOf(header);
    const nodes = new Map();
    const parents = new Map();
    const references = new Set();
    // the namespaces the document actually draws on, as opposed to the ones it declares: a
    // <NamespaceUris> entry that no id in the document refers to carries no model information
    const used = new Set();
    const note = (nodeId) => {
        if (nodeId) used.add(uris[nodeId.namespace] ?? `<unknown namespace ${nodeId.namespace}>`);
    };
    for (const record of records) {
        if (record.kind === "header") continue;
        const id = qualify(record.nodeId, uris);
        note(record.nodeId);
        if (record.browseName) used.add(uris[record.browseName.namespaceIndex] ?? String(record.browseName.namespaceIndex));
        const node = { browseName: qualifyName(record.browseName, uris) };
        for (const key of COMPARED_ATTRIBUTES) {
            const value = record[key] !== undefined ? deepQualify(record[key], uris) : (ATTRIBUTE_DEFAULTS[key] ?? undefined);
            if (value !== undefined) node[key] = value;
        }
        if (node.displayName === undefined) node.displayName = record.browseName?.name ?? "";
        if (node.userAccessLevel === undefined && node.accessLevel !== undefined) node.userAccessLevel = node.accessLevel;
        if (node.value && node.value.arrayType === undefined) node.value = { ...node.value, arrayType: 0 };
        if (node.definition) {
            node.definition = { ...node.definition, name: qualifyPrefixedName(node.definition.name, uris) };
        }
        nodes.set(id, node);
        parents.set(id, qualify(record.parentNodeId, uris));
        for (const r of record.references) {
            // a NodeSet2 document may declare a reference from either end; normalised to the
            // forward direction, the two spellings collapse onto the same entry
            const other = qualify(r.nodeId, uris);
            const [source, target] = r.isForward ? [id, other] : [other, id];
            references.add(`${source} -[${qualify(r.referenceType, uris)}]-> ${target}`);
            note(r.nodeId);
            note(r.referenceType);
        }
    }
    return { uris, used, nodes, parents, references };
}

/** the entries of `set` that touch a node of `domain`, at either end */
const inDomain = (references, domain) =>
    new Set([...references].filter((r) => domain.has(r.slice(0, r.indexOf(" -["))) || domain.has(r.slice(r.indexOf("]-> ") + 4))));

const sample = (items, n = 3) => [...items].slice(0, n).map((i) => JSON.stringify(i)).join(", ");
// #endregion

/**
 * where the intermediates go. A check that fails is a thing to diff, so A, B and the two
 * regenerated documents are always written somewhere and the place is always printed -- --dump
 * chooses it, and without one they land under the system temp directory
 */
function makeDump(dir) {
    const target = dir ?? path.join(os.tmpdir(), "opcua-nodeset-equivalence");
    let made = false;
    const written = new Set();
    return {
        dir: target,
        get used() {
            return written.size > 0;
        },
        write(base, suffix, content) {
            if (!made) {
                fs.mkdirSync(target, { recursive: true });
                made = true;
            }
            const file = path.join(target, `${base}.${suffix}`);
            fs.writeFileSync(file, content);
            written.add(file);
        }
    };
}

const collect = async (iterable) => {
    const out = [];
    for await (const item of iterable) out.push(item);
    return out;
};

/** the header carries the moment it was written; pinned here so two writes compare as bytes */
const WRITER_OPTIONS = { addressSpaceVersion: "equivalence", createdAt: new Date(0) };

/** XML text -> the record stream -> the uncompressed NDJSON text, in one pass */
async function xmlToImageText(xml) {
    const writer = new NodesetImageWriter(WRITER_OPTIONS);
    const records = await collect(xmlNodesetRecords([xml]));
    for (const record of records) writer.apply(record);
    return { records, text: writer.text("equivalence", xml.length) };
}

/** the node lines of an NDJSON text, by node id: the document order is not part of what it says */
function nodeLinesById(text) {
    const byId = new Map();
    for (const line of text.split("\n")) {
        if (!line || line.startsWith('{"kind":')) continue;
        // the encoded id is a number or a tuple; its JSON is the key, so a tuple keys by value
        byId.set(JSON.stringify(JSON.parse(line).nodeId), line);
    }
    return byId;
}

const gzipText = async (text) =>
    new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());

/** the digest alone of an address space built over `sources` */
async function digestOf(sources) {
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpaceRaw(addressSpace, sources, {});
        return digestAddressSpace(addressSpace);
    } finally {
        addressSpace.dispose();
    }
}

/** the digest of an address space built over `sources`, and the NodeSet2 XML of `modelUri` in it */
async function xmlOf(sources, modelUri) {
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpaceRaw(addressSpace, sources, {});
        const digest = digestAddressSpace(addressSpace);
        const namespace = addressSpace.getNamespaceArray().find((n) => n.namespaceUri === modelUri);
        if (!namespace) throw new Error(`namespace ${modelUri} not found after loading`);
        return { digest, xml: namespace.toNodeset2XML() };
    } finally {
        addressSpace.dispose();
    }
}

/** where two texts first part company, as a line number and the two lines */
function firstDifference(a, b, labelA, labelB) {
    const left = a.split("\n");
    const right = b.split("\n");
    const at = left.findIndex((line, i) => line !== right[i]);
    const index = at === -1 ? Math.min(left.length, right.length) : at;
    return (
        `line ${index + 1} differs:\n      ${labelA} ${String(left[index]).slice(0, 300)}` +
        `\n      ${labelB} ${String(right[index]).slice(0, 300)}`
    );
}

async function checkFile(file, options) {
    const report = [];
    const fail = (check, detail) => report.push({ check, ok: false, detail });
    const pass = (check, detail) => report.push({ check, ok: true, detail });
    // a check the XML side cannot run is not the NDJSON failing: the exporter refuses the UA
    // namespace itself, and throws on a handful of values it cannot spell. Those are reported as
    // skipped, with the reason, so that the checks that did run still stand on their own
    const skip = (check, detail) => report.push({ check, ok: true, skipped: true, detail });

    const xml = fs.readFileSync(file, "utf8");
    const base = path.basename(file).replace(/\.xml$/i, "");
    const chain = await dependencyChain(file, options.require);

    // 1 - records: XML -> records -> NDJSON -> records
    const { records: fromXml, text } = await xmlToImageText(xml);
    // A goes to disk as soon as it exists, so that it is there to look at even when a later check
    // cannot run at all
    options.dump.write(base, "A.ndjson", text);
    const image = await gzipText(text);
    const fromImage = await collect(imageNodesetRecords(image, { expectedDigest: "equivalence" }));
    if (fromXml.length !== fromImage.length) {
        fail("records", `${fromXml.length} records from the XML, ${fromImage.length} from the NDJSON`);
    } else {
        const problems = [];
        for (let i = 0; i < fromXml.length && problems.length < 10; i++) {
            const diff = differences(canonicalRecord(fromXml[i]), canonicalRecord(fromImage[i]), 10 - problems.length);
            const where = fromXml[i].kind === "header" ? "header" : fromXml[i].nodeId.toString();
            for (const d of diff) problems.push(`${where} ${d}`);
        }
        if (problems.length) fail("records", problems.join("; "));
        else pass("records", `${fromXml.length} records identical`);
    }

    // 2 - lines: those records re-encoded must be the same bytes
    const rewriter = new NodesetImageWriter(WRITER_OPTIONS);
    for (const record of fromImage) rewriter.apply(record);
    const again = rewriter.text("equivalence", xml.length);
    if (again !== text) fail("lines", firstDifference(text, again, "wrote", "again"));
    else pass("lines", `${text.length} bytes reproduced`);

    // 3 and 4 - the address space, and the XML written from it, either way round
    const header = fromXml.find((r) => r.kind === "header");
    const modelUri = header && header.models[0] && header.models[0].modelUri;
    if (!modelUri) {
        fail("addressspace", "the document declares no model");
        return report;
    }
    const sourcesFromImage = chain.map((f) => (f === file ? { name: `${f} (ndjson)`, source: image } : asFile(f)));
    let viaXml;
    let viaImage;
    try {
        viaXml = await xmlOf(chain.map(asFile), modelUri);
        viaImage = await xmlOf(sourcesFromImage, modelUri);
    } catch (err) {
        // the address space still loaded from both, or `digestOf` would not have got this far; it
        // is writing the XML back out that failed, on both paths alike
        const digests = await Promise.all([digestOf(chain.map(asFile)), digestOf(sourcesFromImage)]);
        if (digests[0].hash !== digests[1].hash) {
            fail("addressspace", `XML ${digests[0].hash.slice(0, 12)} != NDJSON ${digests[1].hash.slice(0, 12)}`);
        } else {
            pass("addressspace", `${digests[0].nodes} nodes, ${digests[0].references} references, same digest`);
        }
        skip("xml", `the XML exporter cannot write this namespace back out: ${reasonOf(err)}`);
        skip("A==B nodes", "not run: it needs the exporter");
        skip("A==B attrs", "not run: it needs the exporter");
        skip("fixpoint", "not run: it needs the exporter");
        return report;
    }

    if (viaXml.digest.hash !== viaImage.digest.hash) {
        fail(
            "addressspace",
            `XML ${viaXml.digest.nodes} nodes/${viaXml.digest.references} refs ${viaXml.digest.hash.slice(0, 12)}` +
                ` != NDJSON ${viaImage.digest.nodes}/${viaImage.digest.references} ${viaImage.digest.hash.slice(0, 12)}`
        );
    } else {
        pass("addressspace", `${viaXml.digest.nodes} nodes, ${viaXml.digest.references} references, same digest`);
    }

    options.dump.write(base, "via-xml.xml", viaXml.xml);
    options.dump.write(base, "via-ndjson.xml", viaImage.xml);

    if (viaXml.xml !== viaImage.xml) {
        fail("xml", firstDifference(viaXml.xml, viaImage.xml, "via XML   ", "via NDJSON"));
        return report;
    }
    pass("xml", `${viaXml.xml.length} bytes, identical either way`);

    // 5 and 6 - A == B. A is the NDJSON of the document that came in, B the NDJSON of the one
    // node-opcua wrote back out after the model had been all the way round. Everything is resolved
    // through each document's own namespace table first: the two are free to order their
    // <NamespaceUris> differently, so a local index is not something they can be held to
    const before = modelOf(fromXml);
    const { records: writtenBack, text: textB } = await xmlToImageText(viaImage.xml);
    const after = modelOf(writtenBack);
    options.dump.write(base, "B.ndjson", textB);

    // the export writes one namespace; a node of the original outside it was never a candidate
    const domain = new Set([...before.nodes.keys()].filter((id) => id.startsWith(`${modelUri};`)));
    const outside = before.nodes.size - domain.size;
    const producedOutside = [...after.nodes.keys()].filter((id) => !id.startsWith(`${modelUri};`));

    // What the two documents must agree on is the namespaces they actually draw on. The declared
    // <NamespaceUris> table is not that: it may list a namespace no id refers to, and its order is
    // a local choice exactly as document order is -- every id here has already been resolved
    // through its own table, so neither can change what the document says. Both are still worth
    // knowing, and are reported below rather than swallowed
    const lostUris = [...before.used].filter((u) => !after.used.has(u));
    const gainedUris = [...after.used].filter((u) => !before.used.has(u));
    const declaredDiffers =
        before.uris.length !== after.uris.length || before.uris.some((uri, i) => uri !== after.uris[i]);
    const lostNodes = [...domain].filter((id) => !after.nodes.has(id));
    const gainedNodes = [...after.nodes.keys()].filter((id) => domain.has(id) === false && id.startsWith(`${modelUri};`));
    const beforeRefs = inDomain(before.references, domain);
    const afterRefs = inDomain(after.references, domain);
    const lostRefs = [...beforeRefs].filter((r) => !afterRefs.has(r));
    const gainedRefs = [...afterRefs].filter((r) => !beforeRefs.has(r));

    const modelProblems = [];
    if (lostUris.length) modelProblems.push(`${lostUris.length} namespaces no longer referred to (${sample(lostUris)})`);
    if (gainedUris.length) modelProblems.push(`${gainedUris.length} namespaces newly referred to (${sample(gainedUris)})`);
    if (lostNodes.length) modelProblems.push(`${lostNodes.length} nodes lost (${sample(lostNodes)})`);
    if (gainedNodes.length) modelProblems.push(`${gainedNodes.length} nodes appeared (${sample(gainedNodes)})`);
    if (producedOutside.length) {
        modelProblems.push(`${producedOutside.length} nodes written outside ${modelUri} (${sample(producedOutside)})`);
    }
    if (lostRefs.length) modelProblems.push(`${lostRefs.length} references lost (${sample(lostRefs)})`);
    if (gainedRefs.length) modelProblems.push(`${gainedRefs.length} references appeared (${sample(gainedRefs)})`);
    if (modelProblems.length) {
        fail("A==B nodes", modelProblems.join("; "));
    } else {
        pass(
            "A==B nodes",
            `${before.used.size} namespaces, ${domain.size} nodes, ${beforeRefs.size} references, all the same` +
                `${outside ? ` (${outside} nodes of the original lie outside ${modelUri} and were never exported)` : ""}`
        );
    }

    // 6 - and the attributes of each of those nodes
    const byAttribute = new Map();
    const examples = [];
    for (const id of domain) {
        const a = before.nodes.get(id);
        const b = after.nodes.get(id);
        if (!b) continue; // already reported as lost
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
            byAttribute.set(key, (byAttribute.get(key) ?? 0) + 1);
            if (examples.length < 3) {
                // for a nested value, the path of the first difference rather than 180 characters
                // of two JSON blobs whose first 179 are identical
                const inner = differences(a[key], b[key], 1, key);
                examples.push(
                    inner.length
                        ? `\n        ${id} ${inner[0].slice(0, 260)}`
                        : `\n        ${id} ${key}` +
                          `\n          A ${JSON.stringify(a[key] ?? null).slice(0, 180)}` +
                          `\n          B ${JSON.stringify(b[key] ?? null).slice(0, 180)}`
                );
            }
        }
    }
    if (byAttribute.size) {
        const tally = [...byAttribute.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k}×${n}`);
        // checks 1 to 4 have already shown the NDJSON reproduces this document exactly, so anything
        // that shows up only here is the XML writer dropping something, not the format losing it
        fail("A==B attrs", `${tally.join(", ")} differ — the NDJSON side is exact, so this is the XML export${examples.join("")}`);
    } else {
        pass("A==B attrs", `${COMPARED_ATTRIBUTES.length + 1} attributes agree on each of ${domain.size} nodes`);
    }

    // reported apart, for the same reason document order is: the two documents draw on the same
    // namespaces and every id was resolved through its own table, so the order they list them in
    // changes nothing about the model
    if (declaredDiffers) {
        const declaredExtra = after.uris.filter((u) => !before.uris.includes(u));
        const declaredGone = before.uris.filter((u) => !after.uris.includes(u));
        const how =
            declaredExtra.length || declaredGone.length
                ? `B declares ${after.uris.length - 1} namespaces where A declared ${before.uris.length - 1}` +
                  `${declaredExtra.length ? `, extra ${sample(declaredExtra)}` : ""}` +
                  `${declaredGone.length ? `, dropped ${sample(declaredGone)}` : ""}`
                : `the same ${after.uris.length - 1} namespaces, listed in another order`;
        report.push({
            check: "ns-table",
            ok: true,
            detail: `${how}; the ${before.used.size} actually referred to are the same, which is what the ids resolve through`
        });
    }

    // parentNodeId is reported apart: it is derivable from the aggregating reference, and a node
    // with more than one aggregating parent has more than one correct answer, so a difference here
    // is a difference of spelling and not of model
    const reparented = [...domain].filter((id) => after.nodes.has(id) && before.parents.get(id) !== after.parents.get(id));
    if (reparented.length) {
        report.push({
            check: "parentNodeId",
            ok: true,
            detail:
                `${reparented.length} of ${domain.size} nodes are written under another of their aggregating parents` +
                ` (first ${JSON.stringify(reparented[0])}); derivable from the references, which match`
        });
    }

    // 5 - a second pass, over the exporter's own XML this time, which reaches constructs a
    // hand-written file may not have. The question is still "does the trip through NDJSON change
    // anything", so the two second passes are compared with each other: whatever the XML pipeline
    // does to a document on its own, the one that went through NDJSON must come out the same.
    // Compared as node records rather than as bytes: the one freedom the exporter takes on the
    // second pass is the order it writes the nodes in, and neither form defines a document order.
    const canonical = viaXml.xml;
    const { text: canonicalText } = await xmlToImageText(canonical);
    const canonicalImage = await gzipText(canonicalText);
    const canonicalFile = { name: `${file} (canonical xml)`, source: () => [canonical] };
    let secondViaXml;
    let secondViaImage;
    try {
        secondViaXml = await xmlOf(
            chain.map((f) => (f === file ? canonicalFile : asFile(f))),
            modelUri
        );
        secondViaImage = await xmlOf(
            chain.map((f) => (f === file ? { name: `${file} (canonical ndjson)`, source: canonicalImage } : asFile(f))),
            modelUri
        );
    } catch (err) {
        skip("fixpoint", `the second pass could not be written back out: ${reasonOf(err)}`);
        return report;
    }
    const { text: afterXml } = await xmlToImageText(secondViaXml.xml);
    const { text: afterImage } = await xmlToImageText(secondViaImage.xml);
    const first = nodeLinesById(afterXml);
    const second = nodeLinesById(afterImage);
    const missing = [...first.keys()].filter((id) => !second.has(id));
    const added = [...second.keys()].filter((id) => !first.has(id));
    const changed = [...first.entries()].filter(([id, line]) => second.has(id) && second.get(id) !== line);
    if (missing.length || added.length || changed.length) {
        const detail = [];
        if (missing.length) detail.push(`${missing.length} nodes lost (${JSON.stringify(missing.slice(0, 3))})`);
        if (added.length) detail.push(`${added.length} nodes appeared (${JSON.stringify(added.slice(0, 3))})`);
        for (const [id, line] of changed.slice(0, 3)) {
            detail.push(`node ${JSON.stringify(id)}
      via XML    ${line.slice(0, 260)}
      via NDJSON ${second.get(id).slice(0, 260)}`);
        }
        fail("fixpoint", detail.join("; "));
    } else {
        pass("fixpoint", `${first.size} nodes, the second pass says the same either way`);
    }

    // and, as information rather than as a verdict: whether the XML pipeline is idempotent at all.
    // A node the exporter writes and the loader will not take back is a defect of the XML side, and
    // is not the NDJSON losing anything -- but it is worth knowing, so it is printed
    const firstPass = nodeLinesById(canonicalText);
    const drifted = [...firstPass.entries()].filter(([id, line]) => !first.has(id) || first.get(id) !== line);
    report.push({
        check: "xml-idempotent",
        ok: true,
        detail: drifted.length
            ? `no: ${drifted.length} of ${firstPass.size} nodes come back changed from the XML pipeline alone` +
              ` (first ${JSON.stringify(drifted[0][0])}); the NDJSON tracks it exactly`
            : `yes: all ${firstPass.size} nodes survive a second XML pass unchanged`
    });
    return report;
}

async function main() {
    const { files, options } = parseArgs(process.argv.slice(2));
    if (files.length === 0) usage();
    const dump = makeDump(options.dump);
    options.dump = dump;
    let failed = 0;
    for (const file of files) {
        const t0 = performance.now();
        let report;
        try {
            report = await checkFile(file, options);
        } catch (err) {
            report = [{ check: "load", ok: false, detail: process.env.EQUIVALENCE_STACK ? err.stack : reasonOf(err) }];
        }
        const bad = report.filter((r) => !r.ok);
        const skipped = report.filter((r) => r.skipped);
        failed += bad.length ? 1 : 0;
        // a check that could not run is not a check that passed: saying "equivalent" over a file
        // whose two strongest checks were skipped is exactly the reassurance this tool must not give
        const verdict = bad.length
            ? `${bad.length} FAILED`
            : skipped.length
              ? `${report.length - skipped.length} checks passed, ${skipped.length} COULD NOT RUN`
              : "equivalent";
        console.log(`${path.basename(file)}: ${verdict} (${(performance.now() - t0).toFixed(0)} ms)`);
        for (const line of report) {
            if (line.ok && options.quiet) continue;
            console.log(`  ${line.skipped ? "skip" : line.ok ? "ok  " : "FAIL"} ${line.check.padEnd(13)} ${line.detail}`);
        }
    }
    if (dump.used) {
        console.log(`\nA, B and the regenerated documents: ${dump.dir}`);
    }
    return failed > 0 ? 1 : 0;
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err.stack || err.message);
        process.exit(1);
    }
);
