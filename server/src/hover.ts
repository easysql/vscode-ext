import { Hover, HoverOptions, TextDocuments } from 'vscode-languageserver';
import { Position, Range, TextDocument } from 'vscode-languageserver-textdocument';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';

export class HoverProvider {
    constructor(private documents: TextDocuments<TextDocument>) {}

    onHover(position: Position, docUri: string): Hover | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);
            const [leftText, rightText] = [line.substring(0, position.character), line.substring(position.character)];
            const funcNameLeft = leftText.match(/(?<=(\${|-- target=check.|-- target=func.|if=))([\w]+)$/);
            const funcNameRight = rightText.match(/^([\w]+)\(/);
            if (funcNameLeft && funcNameRight) {
                const funcName = funcNameLeft[0] + funcNameRight[1];
                const headerCode = doc!.getText().substring(0, 500);
                const backendMatch = headerCode.match(/(^|\n)-- backend:\s*([\w]+)(\s|\n)/);
                if (backendMatch) {
                    const funcs = backendMatch[1].toLowerCase() == 'spark' ? sparkFuncs : rdbFuncs;
                    const func = funcs.funcs.find((func) => func.label.startsWith(funcName + '('));
                    if (func) {
                        const label = func.label
                            .replace(/\${[\d]+:/g, '{')
                            .replaceAll('{', '')
                            .replaceAll('}', '');

                        return {
                            contents: { kind: 'plaintext', value: '(EasySQL Function) ' + label },
                            range: {
                                start: { line: position.line, character: funcNameLeft.index! + 2 },
                                end: { line: position.line, character: position.character + funcNameRight[1].length }
                            }
                        };
                    }
                }
            } else {
                const nameLeft = leftText.match(/(?<=[^\w])([\w]*)$/);
                const nameRight = rightText.match(/^([\w]+)[^\w]/);
                if (nameLeft && nameRight) {
                    const name = nameLeft[0] + nameRight[1];
                    const description: { [name: string]: string } = {
                        __backend__:
                            'The backend instance provided by EasySQL runtime. Could be used to execute queries. Usually passed to functions as parameter.',
                        __step__:
                            'The current step, instance of a Step, provides information about the current step. Usually used as function parameter.',
                        __context__:
                            'The context instance, provide information about current variables and templates. Usually used as function parameter.'
                    };
                    if (description[name]) {
                        return {
                            contents: { kind: 'plaintext', value: '(EasySQL Variable) ' + description[name] },
                            range: {
                                start: { line: position.line, character: nameLeft.index! + 2 },
                                end: { line: position.line, character: position.character + nameRight[1].length }
                            }
                        };
                    } else {
                        const targetDescriptions: { [name: string]: string } = {
                            check: "A check target.\nIf a query is specified, it should return one row of two columns named actual and expected. A equality checked will be performed for the values of the two columns.\nIf a function call follows the check target, the function will be called and the result will be checked to see if it's true or false.",
                            log: 'A log target.\nA query should be specified. It should return one row of any columns. The result will be recorded to messages and will be show in the final report.',
                            func: 'A function target.\nThe function will be called.',
                            template:
                                'A template target.\nA name should be followed and any expression could be specified.\nUsually used to reuse pieces of code. Template variable of format #{name} could be used in the expression below.',
                            output: 'An output target.\nA full table name consists of {DB}.{TABLE_NAME} or {DB}.{SCHEMA}{TABLE_NAME} should be followed.\nA query should be specified and the result will be written to the specified table.',
                            variables:
                                'A variables target.\nA query must be specified. The query should return one row of any columns.\nThe result will be recorded as variables and could be used in any queries after.',
                            list_variables:
                                "A list variable target.\nIt's similar to variable target. But could return any number of rows. And the result will be saved as variables of list of values.\nCould be used in functions.",
                            action: "An action target. A name should be followed and any query could be specified. The query will be executed but it's result will be ignored.",
                            temp: 'A temporary table target.\nA name should be followed and a query should be specified. The result of the query will be registered as a temporary table (actually view in most backends).',
                            cache: 'A cached temporary table target.\nA name should be followed and a query should be specified. The result of the query will be registered as a cached temporary table (actually view in most backends).',
                            broadcast:
                                'A broadcasted temporary table target.\nA name should be followed and a query should be specified. The result of the query will be registered as a broadcasted temporary table (actually view in most backends).'
                        };
                        if (targetDescriptions[name] && leftText.substring(0, nameLeft.index!) === '-- target=') {
                            return {
                                contents: { kind: 'plaintext', value: '(EasySQL Target) ' + targetDescriptions[name] },
                                range: {
                                    start: { line: position.line, character: nameLeft.index! + 2 },
                                    end: { line: position.line, character: position.character + nameRight[1].length }
                                }
                            };
                        }
                    }
                }
            }
        }
        return null;
    }
}
