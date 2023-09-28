import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { DocumentAsts } from './ast';
import { Settings } from './types';
import { EasySqlNode, TplFuncArg, TplFuncCall, TplReference } from './shared/easysql';
import { LineNumberFinder } from './shared/document';
import { DocumentIncludes } from './include';
import { Files } from './files';

export class CodeDiagnosticProvider {
    constructor(private settings: Settings, private files: Files, private documentAsts: DocumentAsts) {}

    async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
        // In this simple example we get the settings for every validate run.
        const settings = await this.settings.getDocumentSettings(textDocument.uri);

        const ast = this.documentAsts.getOrParse(textDocument);

        const semanticErrors: Diagnostic[] = this.extractSemanticErrors(textDocument, ast);
        const includeErrors: Diagnostic[] = this.extractIncludeErrors(textDocument);

        return ast
            .flatMap((node) => node.getToks().filter((tok) => !tok.isValid))
            .map((tok) => {
                const diagnostic: Diagnostic = {
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: textDocument.positionAt(tok.start),
                        end: textDocument.positionAt(tok.start + tok.length)
                    },
                    message: tok.invalidReason,
                    source: '(EasySQL)'
                };
                return diagnostic;
            })
            .concat(semanticErrors)
            .concat(includeErrors)
            .slice(0, settings.maxNumberOfProblems);
    }

    private extractIncludeErrors(textDocument: TextDocument): Diagnostic[] {
        return DocumentIncludes.findAllIncludes(textDocument.getText())
            .map((include) => {
                const filePath = this.files.findFile(textDocument.uri, include.includeFilePath);
                if (!filePath) {
                    return {
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line: include.lineNum, character: '-- include='.length },
                            end: { line: include.lineNum, character: '-- include='.length + include.includeFilePath.length }
                        },
                        message: 'Include file not found',
                        source: '(EasySQL)'
                    };
                }
                return null;
            })
            .filter((diag) => diag !== null) as Diagnostic[];
    }

    private extractSemanticErrors(textDocument: TextDocument, ast: EasySqlNode[]) {
        const semanticErrors: Diagnostic[] = [];

        const lineNumberFinder = new LineNumberFinder(textDocument.getText());
        const validTplReferenceNodes = this.documentAsts
            .findNode(ast, TplReference)
            .filter((node) => node.getToks().filter((tok) => !tok.isValid).length === 0);
        const validTplCallNodes: (TplFuncCall | TplReference)[] = this.documentAsts
            .findNode(ast, TplFuncCall)
            .filter((node) => node.getToks().filter((tok) => !tok.isValid).length === 0)
            .concat(validTplReferenceNodes) as (TplFuncCall | TplReference)[];

        validTplCallNodes.forEach((node) => {
            const tplName = node instanceof TplReference ? node.tpl : node.funcName;
            const tplArgs: TplFuncArg[] = node instanceof TplReference ? [] : (node.args.filter((arg) => arg instanceof TplFuncArg) as TplFuncArg[]);
            const templateDef = this.documentAsts.findTemplateDefinition(
                textDocument,
                lineNumberFinder.findLineNumber(tplName.tok.start)[0],
                tplName.name
            );
            if (!templateDef) {
                semanticErrors.push({
                    severity: DiagnosticSeverity.Error,
                    range: {
                        start: textDocument.positionAt(tplName.tok.start),
                        end: textDocument.positionAt(tplName.tok.start + tplName.tok.length)
                    },
                    message: `Template ${tplName.name} not defined`,
                    source: '(EasySQL)'
                });
            } else {
                const templateContentLines = this.files.readFile(templateDef.uri)!.substring(templateDef.node.startPos).split('\n').slice(1);
                const nextTargetIndex = templateContentLines.findIndex((line) => line.startsWith('-- target='));
                const templateContent = templateContentLines.slice(0, nextTargetIndex === -1 ? undefined : nextTargetIndex).join('\n');
                let allDefinedArgs = Array.from(templateContent.matchAll(/#{\s*([0-9a-zA-Z_]+)\s*}/g)).map((m) => m[1]);
                allDefinedArgs = Array.from(new Set(allDefinedArgs));

                if (allDefinedArgs.length && !tplArgs.length) {
                    semanticErrors.push({
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: textDocument.positionAt(tplName.tok.start),
                            end: textDocument.positionAt(tplName.tok.start + tplName.tok.length)
                        },
                        message: `Required template args: ${allDefinedArgs.join(', ')}`,
                        source: '(EasySQL)'
                    });
                } else {
                    tplArgs.forEach((arg, i) => {
                        if (!allDefinedArgs.includes(arg.name.name)) {
                            semanticErrors.push({
                                severity: DiagnosticSeverity.Error,
                                range: {
                                    start: textDocument.positionAt(arg.name.tok.start),
                                    end: textDocument.positionAt(arg.name.tok.start + arg.name.tok.length)
                                },
                                message: `Template arg ${arg.name.name} not defined`,
                                source: '(EasySQL)'
                            });
                        }
                        if (tplArgs.findIndex((_arg) => _arg.name.name === arg.name.name) !== i) {
                            semanticErrors.push({
                                severity: DiagnosticSeverity.Error,
                                range: {
                                    start: textDocument.positionAt(arg.name.tok.start),
                                    end: textDocument.positionAt(arg.name.tok.start + arg.name.tok.length)
                                },
                                message: `Duplicate template arg ${arg.name}`,
                                source: '(EasySQL)'
                            });
                        }
                    });
                }
            }
        });
        return semanticErrors;
    }
}
