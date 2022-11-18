import { Hover, HoverOptions, TextDocuments } from 'vscode-languageserver';
import { Position, Range, TextDocument } from 'vscode-languageserver-textdocument';
import * as sparkFuncs from './generated/spark.json';
import * as rdbFuncs from './generated/rdb.json';
import { FuncInfoSource } from './funcInfoSource';

interface TypedHover {
    accept: () => boolean;
    hover: () => Hover | null;
}

export class TemplateHover implements TypedHover {
    constructor(private position: Position, private leftText: string, private rightText: string) {}
    private tplNameLeft = this.leftText.match(/@{([\w]+)$/);
    private tplNameRight = this.rightText.match(/^([\w]+)([^\w]|$)/);

    accept() {
        return !!(this.tplNameLeft && this.tplNameRight);
    }

    hover(): Hover | null {
        if (!this.tplNameLeft || !this.tplNameRight) {
            throw new Error('Should check accept before call hover!');
        }
        const templateName = this.tplNameLeft[1] + this.tplNameRight[1];
        const range = {
            start: { line: this.position.line, character: this.tplNameLeft.index! },
            end: { line: this.position.line, character: this.position.character + this.tplNameRight[1].length }
        };
        return {
            contents: { kind: 'plaintext', value: '(Template.) ' + templateName },
            range: range
        };
    }
}

export class FunctionHover implements TypedHover {
    constructor(
        private funcInfoSource: FuncInfoSource,
        private doc: TextDocument,
        private position: Position,
        private line: string,
        private leftText: string,
        private rightText: string
    ) {}
    private funcNameLeft = this.leftText.match(/(?<=(\${|-- target=check.|-- target=func.|if=))([\w]+)$/);
    private funcNameRight = this.rightText.match(/^([\w]+)\(/);

    accept() {
        return !!(this.funcNameLeft && this.funcNameRight);
    }

    hover(): Hover | null {
        if (!this.funcNameLeft || !this.funcNameRight) {
            throw new Error('Should check accept before call hover!');
        }
        const funcName = this.funcNameLeft[0] + this.funcNameRight[1];
        const range = {
            start: { line: this.position.line, character: this.funcNameLeft.index! },
            end: { line: this.position.line, character: this.position.character + this.funcNameRight[1].length }
        };

        const headerCode = this.doc.getText().substring(0, 500);
        const backendMatch = headerCode.match(/(^|\n)-- backend:\s*([\w]+)(\s|\n)/);
        const funcs = !backendMatch || backendMatch[1].toLowerCase() == 'spark' ? sparkFuncs : rdbFuncs;
        const func = funcs.funcs.find((func) => func.label.startsWith(funcName + '('));
        if (func) {
            const itemInfo = this.funcInfoSource.getFuncInfo(!backendMatch || backendMatch[1].toLowerCase() == 'spark' ? 'spark' : 'rdb', funcName);
            const label = func.label
                .replace(/\${[\d]+:/g, '{')
                .replace(/\\\${__(\w+)__}/g, '$1')
                .replaceAll('{', '')
                .replaceAll(', ...', '')
                .replaceAll('}', '');
            const type = func.type === 'easysql' ? 'EasySQL' : 'Python system';
            return {
                contents: { kind: 'markdown', value: `(${type} function) ${label}` + (itemInfo ? '\n' + itemInfo.tooltip : '') },
                range: range
            };
        }
        return {
            contents: { kind: 'plaintext', value: '(User-defined function. Signature unknown.) ' + funcName },
            range: range
        };
    }
}

export class VariableHover implements TypedHover {
    constructor(
        protected doc: TextDocument,
        protected position: Position,
        protected line: string,
        protected leftText: string,
        protected rightText: string
    ) {}
    protected nameLeft = this.leftText.match(/(?<=[^\w])([\w]*)$/);
    protected nameRight = this.rightText.match(/^([\w]+)[^\w]/);

    accept() {
        return !!(this.nameLeft && this.nameRight);
    }

    hover(): Hover | null {
        if (!this.nameLeft || !this.nameRight) {
            throw new Error('Should check accept before call hover!');
        }

        const name = this.nameLeft[0] + this.nameRight[1];
        const description: { [name: string]: string } = {
            __backend__: `The backend instance provided by EasySQL runtime.\n\nCould be used to execute queries. Usually passed to functions as parameter.`,
            __step__: `The current step, instance of a Step, provides information about the current step.\n\nUsually used as function parameter.`,
            __context__: `The context instance, provide information about current variables and templates.\n\nUsually used as function parameter.`
        };
        if (description[name]) {
            return {
                contents: { kind: 'markdown', value: '(EasySQL variable) ' + description[name] },
                range: {
                    start: { line: this.position.line, character: this.nameLeft.index! },
                    end: { line: this.position.line, character: this.position.character + this.nameRight[1].length }
                }
            };
        }
        return null;
    }
}

export class TargetHover extends VariableHover {
    constructor(doc: TextDocument, position: Position, line: string, leftText: string, rightText: string) {
        super(doc, position, line, leftText, rightText);
    }

    hover(): Hover | null {
        if (!this.nameLeft || !this.nameRight) {
            throw new Error('Should check accept before call hover!');
        }

        const name = this.nameLeft[0] + this.nameRight[1];
        const targetDescriptions: { [name: string]: string } = {
            check: `A check target.

If a function call follows the check target, the function will be called and the result will be checked to see if it's true or false.

If a query is specified, it should return one row of two columns named actual and expected. A equality checked will be performed for the values of the two columns.

e.g.

Followed by a function call:
\`\`\`sql
-- target=check.some_function(arg1, \${some_var})
\`\`\`

Followed by a query:
\`\`\`sql
-- target=check.should_equal
select 1 as actual, 1 as expected
\`\`\`
`,
            log: `A log target.

A query should be specified. It should return one row of any columns. The result will be recorded to messages and will be show in the final report.

e.g.

\`\`\`sql
-- target=log.should_log_things
select 1 as thing_to_log
\`\`\`
`,
            func: `A function target.

The function will be called.

e.g.

\`\`\`sql
-- target=func.some_function(arg1, \${var})
\`\`\`
`,
            template: `A template target.

A name should be followed and any expression could be specified.

Usually used to reuse pieces of code. Template variable of format #{name} could be used in the expression below.

e.g.

\`\`\`sql
-- target=template.some_template
a=#{tpl_var1} and b=#{tpl_var2}

-- target=temp.some_table_created_using_template
select * from some_table where @{some_template(a=1, b=2)}
\`\`\`
`,
            output: `An output target.

A full table name consists of {DB}.{TABLE_NAME} or {DB}.{SCHEMA}{TABLE_NAME} should be followed.

A query should be specified and the result will be written to the specified table.

e.g.

\`\`\`sql
-- target=output.some_db.some_table
select * from some_other_table
\`\`\`
`,
            variables: `A variables target.

A query must be specified. The query should return one row of any columns.

The result will be recorded as variables and could be used in any queries after.

e.g.

\`\`\`sql
-- target=variables
select 1 as var_a, select 2 a var_b

-- target=temp.some_table_created_using_variable
select * from some_other_table where a=\${var_a}
\`\`\`
`,
            list_variables: `A list variable target.

It's similar to variable target. But could return any number of rows. And the result will be saved as variables of list of values.

Could be used in functions.

e.g.

\`\`\`sql
-- target=template.list_variables
select var_a, var_b from some_table

-- target=func.some_function_using_list_var(\${var_a}, \${var_b})
\`\`\`
`,
            action: `An action target.

A name should be followed and any query could be specified. The query will be executed but it's result will be ignored.

e.g.

\`\`\`sql
-- target=action.create_some_table
create table a(id int)
\`\`\`
`,
            temp: `A temporary table target.

A name should be followed and a query should be specified. The result of the query will be registered as a temporary table (actually view in most backends).

e.g.

\`\`\`sql
-- target=temp.some_temporary_table
select * from some_other_table
\`\`\`
`,
            cache: `A cached temporary table target.

A name should be followed and a query should be specified. The result of the query will be registered as a cached temporary table (actually view in most backends).

Will be cached only when the backend supports, or it will fallback to temporary table.

e.g.

\`\`\`sql
-- target=cache.some_cached_temporary_table
select * from some_other_table
\`\`\`
`,
            broadcast: `A broadcasted temporary table target.

A name should be followed and a query should be specified. The result of the query will be registered as a broadcasted temporary table (actually view in most backends).

Will be broadcast only when the backend supports, or it will fallback to temporary table.

e.g.

\`\`\`sql
-- target=broadcast.some_broadcasted_temporary_table
select * from some_other_table
\`\`\`
`
        };
        const keywordDescriptions: { [name: string]: string } = {
            target: `To define a target.

The supported target types are: variables, temp, cache, broadcast, func, log, check, output, template, list_variables, action.

e.g.

\`\`\`sql
-- target=variables

-- target=temp.some_temp_table
select * from other_table
\`\`\`
`,
            include: `To include other ETL file.

e.g.

\`\`\`sql
-- include=path/to/other_etl.sql
\`\`\`
`,
            backend: `To specify what type of backend this ETL used.

The supported backends are: spark, clickhouse, bigquery, flink etc.

e.g.

\`\`\`sql
-- backend: spark
\`\`\`
`,
            config: `To specify task related configuration.

e.g.

\`\`\`sql
-- config: spark.jars=lib/mysql-driver.jar
\`\`\`
`,
            inputs: `To specify tables used in this ETL.

e.g.

\`\`\`sql
-- inputs: db_a.table_a, db_b.table_b
\`\`\`
`,
            outputs: `To specify the output tables in this ETL.

e.g.

\`\`\`sql
-- outputs: db_a.table_a, db_b.table_b
\`\`\`
`,
            'prepare-sql': `Use in tests to specify the sql to execute before run the ETL.

e.g.

\`\`\`sql
-- prepare-sql: create table a(id int)
\`\`\`
`
        };
        const range = {
            start: { line: this.position.line, character: this.nameLeft.index! },
            end: { line: this.position.line, character: this.position.character + this.nameRight[1].length }
        };
        if (targetDescriptions[name] && this.leftText.substring(0, this.nameLeft.index!) === '-- target=') {
            return {
                contents: { kind: 'markdown', value: '(EasySQL target) ' + targetDescriptions[name] },
                range: range
            };
        }
        if (this.leftText.substring(0, this.nameLeft.index!) === '-- ') {
            if (keywordDescriptions[name]) {
                return {
                    contents: { kind: 'markdown', value: '(EasySQL keyword) ' + keywordDescriptions[name] },
                    range: range
                };
            }
        }
        return null;
    }
}

export class HoverProvider {
    constructor(private funcInfoSource: FuncInfoSource, private documents: TextDocuments<TextDocument>) {}

    onHover(position: Position, docUri: string): Hover | null {
        const doc = this.documents.get(docUri);
        if (doc) {
            const range: Range = { start: { line: position.line, character: 0 }, end: { line: position.line, character: 1000 } };
            const line = doc.getText(range);
            const [leftText, rightText] = [line.substring(0, position.character), line.substring(position.character)];
            const tplHover = new TemplateHover(position, leftText, rightText);
            if (tplHover.accept()) {
                return tplHover.hover();
            }
            const funcHover = new FunctionHover(this.funcInfoSource, doc, position, line, leftText, rightText);
            if (funcHover.accept()) {
                return funcHover.hover();
            }
            const varHover = new VariableHover(doc, position, line, leftText, rightText);
            const targetHover = new TargetHover(doc, position, line, leftText, rightText);
            if (varHover.accept()) {
                return varHover.hover() || targetHover.hover();
            }
        }
        return null;
    }
}
