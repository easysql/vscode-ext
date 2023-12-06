import { TextDocument } from 'vscode-languageserver-textdocument';
import { Files, toFsPath } from './files';
import { Position, TextDocuments, Location } from 'vscode-languageserver';
import { Settings } from './types';
import path from 'path';

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
        const m = templateName.match(/^([0-9a-zA-Z_]+)[^0-9a-zA-Z_]*/);
        if (!m) {
            return null;
        }
        templateName = m[1];

        if (pos.character > '-- target=template.'.length + templateName.length) {
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
            const docPath = toFsPath(docUri);
            const relativePath = path.relative(file, docPath);
            const workspaceFolder = toFsPath(this.files.findWorkspaceFolder(docUri)!);
            const workspaceFolderRelativePath = path.relative(workspaceFolder, docPath);
            const workspaceWorkflowFolderRelativePath = path.relative(path.join(workspaceFolder, 'workflow'), docPath);
            const possibleIncludes = [
                `-- include=${relativePath.replace('\\', '/')}`,
                `-- include=${workspaceFolderRelativePath.replace('\\', '/')}`,
                `-- include=${workspaceWorkflowFolderRelativePath.replace('\\', '/')}`
            ];

            if (docPath !== file && !lines.some((line) => possibleIncludes.includes(line.trim()))) {
                return [];
            }
            return lines.flatMap((line, i) => {
                return Array.from(line.matchAll(new RegExp(`@{\\s*(${templateName})\\s*[(}]`, 'g'))).map((m) => {
                    return Location.create(`${file.replace(/^file:\/\/?\/?/, 'file:///').replace(/^file:\\\\?\\?/, 'file:\\\\\\')}`, {
                        start: { line: i, character: m.index! },
                        end: { line: i, character: m.index! + m[0].length }
                    });
                });
            });
        });
    }
}
