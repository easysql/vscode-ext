import { Definition, Position, Range, Location, TextDocuments, DocumentLink } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAsts } from './ast';
import { Files } from './files';
import { DocumentIncludes } from './include';
import { LineNumberFinder } from './shared/document';
import { Template } from './shared/easysql';

export class IncludeDefinition {
    constructor(private files: Files, private docUri: string, private position: Position, private line: string) {}

    accept() {
        return (
            DocumentIncludes.isInclude(this.line) &&
            (DocumentIncludes.inIncludeContent(this.line, this.position.character) ||
                DocumentIncludes.inIncludeKeyword(this.line, this.position.character))
        );
    }

    definition(): Definition | null {
        const filePath = DocumentIncludes.includeFilePath(this.line);
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

    onDocumentLinks(docUri: string): DocumentLink[] {
        const doc = this.documents.get(docUri);
        if (doc) {
            const lines = doc.getText().split('\n');
            const links: (DocumentLink | null)[] = lines.map((line, i) => {
                if (!line.startsWith('-- include=')) {
                    return null;
                }

                const filePath = DocumentIncludes.includeFilePath(line);
                const fileUri = this.files.findFile(docUri, filePath);
                if (filePath && fileUri) {
                    const m = line.match(/^(-- include=\s*)([^\s]).*/);
                    if (!m) {
                        throw new Error('should exist a match');
                    }
                    const pos = m[1].length;
                    return { range: DocumentIncludes.toRange(line, i, pos) };
                }
                return null;
            });
            return links.filter((link) => !!link) as DocumentLink[];
        }
        return [];
    }
}
