import { TextDocument } from 'vscode-languageserver-textdocument';
import { Broadcast, EasySqlNode, Parser, SimpleNamedTarget, Temp, Template } from './shared/easysql';
import { logger } from './shared/logger';
import { LineNumberFinder } from './shared/document';
import { DocumentIncludes } from './include';
import { Files } from './files';
import { Definition, Position, Range, Location, TextDocuments } from 'vscode-languageserver';

export class DefinitionNode {
    constructor(public node: EasySqlNode, public uri: string, public lineNumberFinder: LineNumberFinder) {}

    toDefinition(): Definition {
        const { node, uri, lineNumberFinder } = this;
        if (!(node instanceof SimpleNamedTarget)) {
            throw new Error('node is not a SimpleNamedTarget: ' + node.join());
        }
        const tempTable = node as SimpleNamedTarget;
        const startPos = lineNumberFinder.findLineNumber(tempTable.name.tok.start);
        const endPos = [startPos[0], startPos[1] + tempTable.name.tok.length];
        return Location.create(uri, Range.create(Position.create(startPos[0], startPos[1]), Position.create(endPos[0], endPos[1])));
    }
}

export class DocumentAsts {
    constructor(private files: Files, public documents: TextDocuments<TextDocument>, public parser: Parser, public maxCacheCount = 10) {}
    private cachedAsts = new Map<string, EasySqlNode[]>();
    private cachedUris: string[] = [];

    getOrParseByTextAndUri(doc: string, uri: string): EasySqlNode[] {
        const indexFound = this.cachedUris.findIndex((path) => uri === path);
        if (indexFound !== -1) {
            if (!this.cachedAsts.has(uri)) {
                throw new Error('No cached ast found, but cached uris found. This should not happen!');
            }
            return this.cachedAsts.get(uri)!;
        }
        const ast = logger.timed(() => this.parser.parse(doc), 'DEBUG', 'create ast for doc: ', uri);
        this.cachedAsts.set(uri, ast);
        this.cachedUris.push(uri);
        if (this.cachedUris.length > this.maxCacheCount) {
            const docToRemove = this.cachedUris.splice(0, 1)[0];
            if (docToRemove) {
                this.cachedAsts.delete(docToRemove);
            }
        }
        return ast;
    }
    getOrParse(doc: TextDocument): EasySqlNode[] {
        return this.getOrParseByTextAndUri(doc.getText(), doc.uri);
    }

    findNode(ast: EasySqlNode[], type: any): EasySqlNode[] {
        const result = [];
        for (const node of ast) {
            if (node instanceof type) {
                result.push(node);
            } else {
                result.push(...this.findNode(node.getChildren(), type));
            }
        }
        return result;
    }

    remove(doc: TextDocument) {
        const indexFound = this.cachedUris.findIndex((path) => doc.uri === path);
        if (indexFound !== -1) {
            this.cachedAsts.delete(doc.uri);
            this.cachedUris.splice(indexFound, 1);
        }
    }

    findDefinitionNode(doc: TextDocument, startLine: number, predication: (node: EasySqlNode) => boolean): DefinitionNode | null {
        const ast = this.getOrParse(doc);
        const lineNumberFinder = new LineNumberFinder(doc.getText());
        const isDefinitionNode = (lineNumberFinder?: LineNumberFinder) => (node: EasySqlNode) => {
            const isTargetNode = predication(node);
            if (!isTargetNode) {
                return false;
            }
            if (lineNumberFinder) {
                const toks = node.getToks();
                return toks.length && lineNumberFinder.findLineNumber(toks[0].start)[0] < startLine;
            }
            return true;
        };

        const targetNode = ast.reverse().find(isDefinitionNode(lineNumberFinder));
        let targetNodeLocInFile: number | null = null;
        if (targetNode) {
            targetNodeLocInFile = lineNumberFinder.findLineNumber(targetNode.getToks()[0].start)[0];
        }

        const includes = DocumentIncludes.findAllIncludes(
            doc
                .getText()
                .split('\n')
                .slice(0, startLine + 1)
        ).reverse();
        for (let i = 0; i < includes.length; i++) {
            const { includeFilePath, lineNum } = includes[i];
            const fileUri = this.files.findFile(doc.uri, includeFilePath);
            if (fileUri) {
                const textDoc = this.documents.get(fileUri)?.getText() || this.files.readFile(fileUri);
                if (textDoc) {
                    const includeDocAst = this.getOrParseByTextAndUri(textDoc, fileUri);
                    const lineNumberFinderForIncludeFile = new LineNumberFinder(textDoc);
                    const targetNodeInIncludeFile = includeDocAst.filter(isDefinitionNode()).reverse()[0];
                    if (targetNodeInIncludeFile) {
                        return targetNodeLocInFile !== null && targetNodeLocInFile > lineNum
                            ? new DefinitionNode(targetNode!, doc.uri, lineNumberFinder)
                            : new DefinitionNode(targetNodeInIncludeFile!, fileUri, lineNumberFinderForIncludeFile);
                    }
                }
            }
        }
        return targetNodeLocInFile !== null ? new DefinitionNode(targetNode!, doc.uri, lineNumberFinder) : null;
    }

    findTempTableDefinition(doc: TextDocument, startLine: number, tempTableName: string): DefinitionNode | null {
        return this.findDefinitionNode(
            doc,
            startLine,
            (node) =>
                node instanceof SimpleNamedTarget &&
                (node instanceof Temp || node instanceof Cache || node instanceof Broadcast) &&
                node.name.name === tempTableName
        );
    }
    findTemplateDefinition(doc: TextDocument, startLine: number, templateName: string): DefinitionNode | null {
        return this.findDefinitionNode(doc, startLine, (node) => node instanceof Template && node.name.name === templateName);
    }
}
