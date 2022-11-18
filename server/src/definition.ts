import { Definition, Position, Range, Location, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { LineNumberFinder } from './shared/document';
import { Template } from './shared/easysql';

export class DefinitionProvider {
    constructor(public documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>) {}

    onDefinition(position: Position, docUri: string): Definition | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);
            const [leftText, rightText] = [line.substring(0, position.character), line.substring(position.character)];
            const leftMatch = leftText.match(/@{(\w*)$/);
            const rightMatch = rightText.match(/^(\w+)([^\w]|$)/);
            if (leftMatch && rightMatch) {
                const templateName = leftMatch[1] + rightMatch[1];
                const ast = this.documentAsts.getOrParse(doc);
                const template = ast.filter((node) => node instanceof Template && node.name.name === templateName).reverse()[0] as Template;
                const lineNumberFinder = new LineNumberFinder(doc.getText());
                if (template) {
                    const startPos = lineNumberFinder.findLineNumber(template.name.tok.start);
                    const endPos = [startPos[0], startPos[1] + template.name.tok.length];
                    return Location.create(docUri, Range.create(Position.create(startPos[0], startPos[1]), Position.create(endPos[0], endPos[1])));
                }
            }
        }
        return null;
    }
}
