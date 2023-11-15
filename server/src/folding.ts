import { FoldingRange, FoldingRangeKind, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { LineNumberFinder } from './shared/document';
import { Target } from './shared/easysql';

export class FoldingRangeProvider {
    constructor(public documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>) {}

    onFoldingRanges(docUri: string): FoldingRange[] | undefined | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const ast = this.documentAsts.getOrParse(doc);
            const lines = doc.getText().split('\n');
            const lineNumberFinder = new LineNumberFinder(doc.getText());
            const result = ast
                .map((node, i) => {
                    if (!(node instanceof Target)) {
                        return null;
                    }
                    const target = node as Target;
                    const startLine = lineNumberFinder.findLineNumber(target.startPos)[0];
                    let endLine = -1;
                    if (i < ast.length - 1) {
                        let nextTarget = null;
                        let nextTargetIndex = i + 1;
                        while (nextTargetIndex < ast.length - 1 && (!nextTarget || !(nextTarget instanceof Target))) {
                            nextTarget = ast[nextTargetIndex++];
                        }
                        if (nextTarget && nextTarget instanceof Target) {
                            endLine = lineNumberFinder.findLineNumber(nextTarget.startPos)[0] - 1;
                        } else {
                            endLine = lines.length - 1;
                        }
                    } else {
                        endLine = lines.length - 1;
                    }
                    while (endLine > startLine && lines[endLine].trim() === '') {
                        endLine--;
                    }
                    if (endLine <= startLine) {
                        return null;
                    }
                    for (let j = startLine + 1; j <= endLine; j++) {
                        if (lines[j].startsWith('-- include=') || lines[j].startsWith('-- config:')) {
                            endLine = j - 1;
                            while (endLine > startLine && lines[endLine].trim() === '') {
                                endLine--;
                            }
                            if (endLine <= startLine) {
                                return null;
                            }
                            break;
                        }
                    }
                    return FoldingRange.create(startLine, endLine, 0, 0, FoldingRangeKind.Region);
                })
                .filter((f) => f !== null) as FoldingRange[];
            return result;
        }
        return null;
    }
}
