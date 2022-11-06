import { TextDocument } from 'vscode-languageserver-textdocument';
import { EasySqlNode, Parser } from './shared/easysql';
import { logger } from './shared/logger';

export class DocumentAsts {
    constructor(public parser: Parser, public maxCacheCount = 10) {}
    private cachedAsts = new Map<string, EasySqlNode[]>();
    private cachedUris: string[] = [];

    getOrParse(doc: TextDocument): EasySqlNode[] {
        const indexFound = this.cachedUris.findIndex((path) => doc.uri === path);
        if (indexFound !== -1) {
            if (!this.cachedAsts.has(doc.uri)) {
                throw new Error('No cached ast found, but cached uris found. This should not happen!');
            }
            return this.cachedAsts.get(doc.uri)!;
        }
        const ast = logger.timed(() => this.parser.parse(doc.getText()), 'DEBUG', 'create ast for doc: ', doc.uri);
        this.cachedAsts.set(doc.uri, ast);
        this.cachedUris.push(doc.uri);
        if (this.cachedUris.length > this.maxCacheCount) {
            const docToRemove = this.cachedUris.splice(0, 1)[0];
            if (docToRemove) {
                this.cachedAsts.delete(docToRemove);
            }
        }
        return ast;
    }

    remove(doc: TextDocument) {
        const indexFound = this.cachedUris.findIndex((path) => doc.uri === path);
        if (indexFound !== -1) {
            this.cachedAsts.delete(doc.uri);
            this.cachedUris.splice(indexFound, 1);
        }
    }
}
