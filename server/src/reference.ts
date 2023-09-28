import { TextDocument } from 'vscode-languageserver-textdocument';
import { Files } from './files';
import { Position, TextDocuments, Location } from 'vscode-languageserver';
import { Settings } from './types';

export class ReferenceProvider {
    constructor(public files: Files, public documents: TextDocuments<TextDocument>, public settings: Settings) {}

    async onReferences(pos: Position, docUri: string): Promise<Location[] | null> {
        const settings = await this.settings.getDocumentSettings(docUri);
        const content = this.documents.get(docUri)?.getText() || this.files.readFile(docUri);
        if (!content) {
            return null;
        }
        const line = content.split('\n')[pos.line];
        // Only support references of template targets for now
        if (!line.startsWith('-- target=template.') || pos.character < '-- target=template.'.length - 1) {
            return null;
        }
        let templateName = line.substring('-- target=template.'.length).trim();
        templateName = templateName.substring(0, templateName.indexOf(' ') === -1 ? templateName.length : templateName.indexOf(' '));
        if (!templateName || !/^[0-9a-zA-Z_]+$/.test(templateName) || pos.character > '-- target=template.'.length + templateName.length) {
            return null;
        }
        const files = this.files.findFiles(docUri, settings.filePatternToSearchForReferences || '**/*.sql');
        if (!files) {
            return null;
        }
        return files.flatMap((file) => {
            const content = this.files.readFile(file);
            if (!content) {
                return [];
            }
            const lines = content.split('\n');
            return lines.flatMap((line, i) => {
                return Array.from(line.matchAll(new RegExp(`@{\\s*(${templateName})\\s*[(}]`, 'g'))).map((m) => {
                    return Location.create(`${file.replace(/^file:\/\/?\/?/, 'file:///')}`, {
                        start: { line: i, character: m.index! },
                        end: { line: i, character: m.index! + m[0].length }
                    });
                });
            });
        });
    }
}
