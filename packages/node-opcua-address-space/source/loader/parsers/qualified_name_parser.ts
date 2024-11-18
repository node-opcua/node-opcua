import { QualifiedNameOptions, QualifiedName, coerceQualifiedName } from "node-opcua-data-model";
import { resolveNodeId, NodeId, NodeIdLike } from "node-opcua-nodeid";
import { ReaderStateParserLike } from "node-opcua-xml2json";


interface QualifiedNameParserL1 extends ReaderStateParserLike {
    value: QualifiedName| null;
    qualifiedName: QualifiedNameOptions;
}

export interface QualifiedNameParserL2 {
    parent: QualifiedNameParserL1;
    text: string;
}

export const makeQualifiedNameParser = (_translateNodeId: (nodeId: string)=> NodeId) => ({
    QualifiedName: {
        init(this: QualifiedNameParserL1) {
            this.qualifiedName = {
                namespaceIndex: 0,
                name: null
            } as QualifiedNameOptions;
            this.value = null;
        },
        parser: {
            Name: {
                finish(this: QualifiedNameParserL2) {
                    this.parent.qualifiedName.name = this.text.trim();
                }
            },
            NamespaceIndex: {
                finish(this: QualifiedNameParserL2) {
                    const ns = parseInt(this.text, 10);
                    const t = _translateNodeId(resolveNodeId(`ns=${ns};i=1`).toString());
                    this.parent.qualifiedName.namespaceIndex = t.namespace;
                }
            }
        },
        finish(this: QualifiedNameParserL1) {
            this.value = coerceQualifiedName(this.qualifiedName)
        }
    }
});
