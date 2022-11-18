import { Definition, Position, Range, Location, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { Files } from './files';
import { LineNumberFinder } from './shared/document';
import { Template } from './shared/easysql';

export class IncludeDefinition {
    constructor(private files: Files, private docUri: string, private position: Position, private line: string) {}

    accept() {
        return (
            this.line.startsWith('-- include=') &&
            ((this.position.character >= '-- '.length && this.position.character < '-- include'.length) ||
                (this.position.character >= '-- include='.length &&
                    /[^\s]/.test(this.line.substring(this.position.character, this.position.character + 1))))
        );
    }

    definition(): Definition | null {
        const filePath = this.line.substring('-- include='.length).trim();
        if (this.position.character >= '-- '.length && this.position.character < '-- include'.length) {
            return null;
        } else {
            const fileUri = this.files.findFile(this.docUri, filePath);
            if (fileUri) {
                const range = {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 }
                };
                return Location.create(fileUri, range);
            }
            return null;
        }
    }
}

export class DefinitionProvider {
    constructor(private files: Files, private documentAsts: DocumentAsts, private documents: TextDocuments<TextDocument>) {}

    onDefinition(position: Position, docUri: string): Definition | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);

            const includeDefinition = new IncludeDefinition(this.files, docUri, position, line);
            if (includeDefinition.accept()) {
                return includeDefinition.definition();
            }

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
