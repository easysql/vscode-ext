export class TokType {
    constructor(public id: number, public name: string) {}

    get isVarCurlyBracketStart() {
        return this.id === Tok.TYPES.varCurlyBracketStart.id;
    }
    get isTplCurlyBracketStart() {
        return this.id === Tok.TYPES.tplCurlyBracketStart.id;
    }
    get isTplVarCurlyBracketStart() {
        return this.id === Tok.TYPES.tplVarCurlyBracketStart.id;
    }
    get isCurlyBracketEnd() {
        return this.id === Tok.TYPES.curlyBracketEnd.id;
    }
    get isParenthesisStart() {
        return this.id === Tok.TYPES.parenthesisStart.id;
    }
    get isParenthesisEnd() {
        return this.id === Tok.TYPES.parenthesisEnd.id;
    }
    get isName() {
        return this.id === Tok.TYPES.name.id;
    }
    get isComma() {
        return this.id === Tok.TYPES.comma.id;
    }
    get isAssignment() {
        return this.id === Tok.TYPES.assignment.id;
    }
    get isNameWide() {
        return this.id === Tok.TYPES.nameWide.id;
    }
    get isCommentStart() {
        return this.id === Tok.TYPES.commentStart.id;
    }
    get isWhiteSpace() {
        return this.id === Tok.TYPES.whiteSpace.id;
    }
    get isAny() {
        return this.id === Tok.TYPES.any.id;
    }
}

export class Tok {
    static TYPES = {
        varCurlyBracketStart: new TokType(1, 'varCurlyBracketStart'),
        tplCurlyBracketStart: new TokType(2, 'tplCurlyBracketStart'),
        tplVarCurlyBracketStart: new TokType(3, 'tplVarCurlyBracketStart'),
        curlyBracketEnd: new TokType(4, 'curlyBracketEnd'),
        parenthesisStart: new TokType(5, 'parenthesisStart'),
        parenthesisEnd: new TokType(6, 'parenthesisEnd'),
        comma: new TokType(7, 'comma'),
        assignment: new TokType(8, 'assignment'),
        name: new TokType(20, 'name'),
        nameWide: new TokType(21, 'nameWide'),
        commentStart: new TokType(22, 'commentStart'),
        whiteSpace: new TokType(23, 'whiteSpace'),
        any: new TokType(24, 'any')
    };
    static typeId2Type = new Map<number, TokType>(Object.values(Tok.TYPES).map((type) => [type.id, type]));

    constructor(
        public start: number,
        public readonly length: number,
        public content: string,
        public readonly tokeType: TokType,
        public readonly textHint?: string
    ) {}

    get text() {
        if (this.textHint !== undefined) {
            return this.textHint;
        }
        return this.content.substring(this.start, this.start + this.length);
    }

    resetParentTokFrom(start: number, content: string) {
        this.start = this.start + start;
        this.content = content;
    }

    parentTokFrom(start: number, content: string) {
        return new Tok(this.start + start, this.length, content, this.tokeType, this.textHint);
    }
}

export class Parser {
    parse(content: string, ignoreComment?: boolean, ignoreFuncCall?: boolean): EasySqlNode[] {
        if (!/[\\$#]{[^}]+}/.test(content)) {
            return [new Any(new Tok(0, content.length, content, Tok.TYPES.any))];
        }
        const fullContent = content;

        const comments: Comment[] = [];
        let commentStartIdx = -1;
        if (!ignoreComment) {
            commentStartIdx = this.findCommentStart(content);
            if (commentStartIdx !== -1) {
                comments.push(
                    new Comment(
                        new Sentinel([new Tok(commentStartIdx, 2, content, Tok.TYPES.commentStart)]),
                        new Tok(commentStartIdx + 2, content.length - commentStartIdx - 2, content, Tok.TYPES.any)
                    )
                );
                content = content.substring(0, commentStartIdx);
            }
        }

        if (!ignoreFuncCall) {
            const funcCallMatches = Array.from(content.matchAll(/[$@]{\s*[\w]+\([^)]*\)}/g));
            if (funcCallMatches.length) {
                if (funcCallMatches.length === 1 && funcCallMatches[0][0] === content) {
                    return [this.parseSingleFuncCall(content).resetTokFrom(0, fullContent) as EasySqlNode].concat(comments);
                }
                let nodes: EasySqlNode[] = [];
                funcCallMatches.forEach((funcCallMatch, i) => {
                    if (i === 0 && funcCallMatch.index !== 0) {
                        nodes = nodes.concat(this.parse(content.substring(0, funcCallMatch.index), true, true));
                    }
                    nodes.push(this.parseSingleFuncCall(funcCallMatch[0]).resetTokFrom(funcCallMatch.index!, fullContent));
                    if (i === funcCallMatches.length - 1) {
                        nodes = nodes.concat(
                            this.parse(content.substring(funcCallMatch.index! + funcCallMatch[0].length, content.length), true, true).map((node) =>
                                node.resetTokFrom(funcCallMatch[0].length + funcCallMatch.index!, fullContent)
                            )
                        );
                    }
                });

                return nodes.map((node) => node.resetTokFrom(0, fullContent)).concat(comments);
            }
        }

        const varMatches = Array.from(content.matchAll(/[$@#]{[\w]+}/g));
        if (varMatches.length) {
            if (varMatches.length === 1 && varMatches[0][0] === content) {
                return [this.parseSingleVar(content).resetTokFrom(0, fullContent) as EasySqlNode].concat(comments);
            }
            const nodes: EasySqlNode[] = [];
            varMatches.forEach((varMatch, i) => {
                if (i === 0 && varMatch.index !== 0) {
                    nodes.push(new Any(new Tok(0, varMatch.index!, fullContent, Tok.TYPES.any)));
                }
                nodes.push(this.parseSingleVar(varMatch[0]).resetTokFrom(varMatch.index!, fullContent));
                if (i === varMatches.length - 1 && content.length - varMatch.index! - varMatch[0].length > 0) {
                    nodes.push(
                        new Any(
                            new Tok(
                                varMatch.index! + varMatch[0].length,
                                content.length - varMatch.index! - varMatch[0].length,
                                fullContent,
                                Tok.TYPES.any
                            )
                        )
                    );
                }
            });
            return nodes.map((tok) => tok.resetTokFrom(0, fullContent)).concat(comments);
        }

        if (content) {
            return [new Any(new Tok(0, content.length, fullContent, Tok.TYPES.any)) as EasySqlNode].concat(comments);
        }

        return comments;
    }

    public findCommentStart(content: string): number {
        const quoteChars = '\'"`';
        let quoteOpen = '';
        let hasLeadingBackslash = false;
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\\') {
                hasLeadingBackslash = !hasLeadingBackslash;
                continue;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch && !hasLeadingBackslash) {
                    quoteOpen = '';
                } else if (!quoteOpen && !hasLeadingBackslash) {
                    quoteOpen = ch;
                }
                hasLeadingBackslash = false;
            } else if (ch === '-' && content.charAt(i + 1) === '-' && !quoteOpen) {
                return i;
            }
        }
        return -1;
    }

    public parseSingleFuncCall(content: string): VarFuncCall | TplFuncCall {
        // e.g. ${func(var1, ${var2}, var3)}, @{func(a=var1, b=${var2})}, ${func()}, @{func()}
        const tokType = content[0] === '$' ? Tok.TYPES.varCurlyBracketStart : Tok.TYPES.tplCurlyBracketStart;
        const startToks = [new Tok(0, 2, content, tokType)];

        const parenthesisEndIdx = content.lastIndexOf(')');
        if (parenthesisEndIdx === -1) {
            throw new Error('Should contain right parenthesis, found nothing!');
        }

        // handle: func(
        let contentStart = 2;
        const funcCallContent = content.substring(contentStart, content.length - contentStart);

        const parenthesisStart = funcCallContent.indexOf('(');
        if (parenthesisStart === -1) {
            throw new Error('Must have parenthesis start, found nothing');
        }
        const funcName = funcCallContent.substring(0, parenthesisStart + 1);
        const matches = funcName.match(/^(\s*)([^\s]+)\($/);
        if (!matches) {
            throw new Error('Must have a match, found nothing');
        }
        if (matches[1]) {
            startToks.push(new Tok(contentStart, matches[1].length, content, Tok.TYPES.whiteSpace));
        }

        const funcNameNode = new Name(new Tok(contentStart + matches[1].length, matches[2].length, content, Tok.TYPES.name));
        const argStart = new Sentinel([new Tok(contentStart + parenthesisStart, 1, content, Tok.TYPES.parenthesisStart)]);

        // handle params
        contentStart = contentStart + parenthesisStart + 1;
        const paramsContent = content.substring(contentStart, parenthesisEndIdx);
        let paramStart = 0;
        const splits = paramsContent.split(',');
        const paramsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = [];

        splits.forEach((paramContent, i) => {
            if (splits.length === 1) {
                if (/^\s+$/.test(paramContent)) {
                    paramsNode.push(new Sentinel([new Tok(contentStart + paramStart, paramContent.length, content, Tok.TYPES.whiteSpace)]));
                    return;
                } else if (!paramContent) {
                    return;
                }
            }

            if (tokType === Tok.TYPES.varCurlyBracketStart) {
                // handle parameters: var1 | ${var2} | var3
                this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.nameWide, true).forEach((node) =>
                    paramsNode.push(node.resetTokFrom(contentStart + paramStart, content))
                );
            } else if (tokType === Tok.TYPES.tplCurlyBracketStart) {
                // handle parameters: var1=var1, var2=${var2}, var3=
                const assignmentIdx = paramContent.indexOf('=');
                if (assignmentIdx === -1) {
                    const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.name).map((node) =>
                        node.resetTokFrom(contentStart + paramStart, content)
                    ) as [Sentinel, Lit, Sentinel];
                    const assignment = new Sentinel([new Tok(contentStart + paramStart + paramContent.length, 0, content, Tok.TYPES.assignment)]);
                    const value = new Lit(new Tok(contentStart + paramStart + paramContent.length, 0, content, Tok.TYPES.nameWide));
                    paramsNode.push(new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment), value, new Sentinel([])));
                } else {
                    const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(
                        paramContent.substring(0, assignmentIdx),
                        Tok.TYPES.name
                    ).map((node) => node.resetTokFrom(contentStart + paramStart, content)) as [Sentinel, Lit, Sentinel];
                    const assignment = new Sentinel([new Tok(contentStart + paramStart + assignmentIdx, 1, content, Tok.TYPES.assignment)]);
                    const value: [Sentinel, Lit | VarReference, Sentinel] = this.parseNameWithWhiteSpace(
                        paramContent.substring(assignmentIdx + 1),
                        Tok.TYPES.nameWide,
                        true
                    ).map((node) => node.resetTokFrom(contentStart + paramStart + assignmentIdx + 1, content)) as [
                        Sentinel,
                        Lit | VarReference,
                        Sentinel
                    ];
                    paramsNode.push(
                        new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment).merge(value[0]), value[1], value[2])
                    );
                }
            } else {
                throw new Error('unsupported token type: ' + tokType.name);
            }

            if (i !== splits.length - 1) {
                paramsNode.push(new Sentinel([new Tok(contentStart + paramStart + paramContent.length, 1, content, Tok.TYPES.comma)]));
            }
            paramStart += paramContent.length + 1;
        });

        // squeeze sentinel nodes in parameter nodes
        const squeezedParamsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = [];
        paramsNode.forEach((node) => {
            if (node instanceof Sentinel) {
                if (!node.isEmpty) {
                    const lastNode = squeezedParamsNode[squeezedParamsNode.length - 1];
                    if (lastNode && lastNode instanceof Sentinel) {
                        lastNode.merge(node);
                    } else {
                        squeezedParamsNode.push(node);
                    }
                }
            } else {
                squeezedParamsNode.push(node);
            }
        });

        // handle: )}, ) }
        const endToks = [new Tok(parenthesisEndIdx, 1, content, Tok.TYPES.parenthesisEnd)];
        if (parenthesisEndIdx !== content.length - 2) {
            endToks.push(new Tok(parenthesisEndIdx + 1, content.length - parenthesisEndIdx - 2, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        const endNode = new Sentinel(endToks);
        const startNode = new Sentinel(startToks);

        return tokType.isVarCurlyBracketStart
            ? new VarFuncCall(startNode, funcNameNode, argStart, squeezedParamsNode as (Sentinel | Lit | VarReference)[], endNode)
            : new TplFuncCall(startNode, funcNameNode, argStart, squeezedParamsNode as (Sentinel | TplFuncArg)[], endNode);
    }

    private parseNameWithWhiteSpace(content: string, tokType: TokType, parseVarReference?: boolean): [Sentinel, Lit | VarReference, Sentinel] {
        const leftTrimed = content.trimStart();
        const leftSpaceLength = content.length - leftTrimed.length;
        const startNode = new Sentinel(leftSpaceLength > 0 ? [new Tok(0, leftSpaceLength, content, Tok.TYPES.whiteSpace)] : []);

        let valueNode: Lit | VarReference;
        const rightTrimed = leftTrimed.trimEnd();
        if (parseVarReference && /^\${.*}$/.test(rightTrimed)) {
            valueNode = this.parseSingleVar(rightTrimed).resetTokFrom(leftSpaceLength, content) as VarReference;
        } else {
            valueNode = new Lit(new Tok(leftSpaceLength, rightTrimed.length, content, tokType));
        }

        const rightSpaceLength = leftTrimed.length - rightTrimed.length;
        const endNode = new Sentinel(
            rightSpaceLength > 0 ? [new Tok(content.length - rightSpaceLength, rightSpaceLength, content, Tok.TYPES.whiteSpace)] : []
        );

        return [startNode, valueNode, endNode];
    }

    public parseSingleVar(content: string): VarReference | TplReference | TplVarReference {
        // e.g. ${var2}  @{ var2 }
        const tokType =
            content[0] === '$'
                ? Tok.TYPES.varCurlyBracketStart
                : content[0] === '@'
                ? Tok.TYPES.tplCurlyBracketStart
                : Tok.TYPES.tplVarCurlyBracketStart;
        const startToks = [new Tok(0, 2, content, tokType)];

        const nameContent = content.substring(2, content.length - 1);
        const matches = nameContent.match(/^(\s*)([^\s]*)(\s*)$/);
        if (!matches) {
            throw new Error('Must have a match, found nothing');
        }
        const start = 2;
        if (matches[1]) {
            startToks.push(new Tok(start, matches[1].length, content, Tok.TYPES.whiteSpace));
        }
        const varTok = new Tok(start + matches[1].length, matches[2].length, content, Tok.TYPES.name);

        const endToks: Tok[] = [];
        if (matches[3]) {
            endToks.push(new Tok(start + matches[1].length + matches[2].length, matches[3].length, content, Tok.TYPES.whiteSpace));
        }

        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        return tokType.isVarCurlyBracketStart
            ? new VarReference(new Sentinel(startToks), new Name(varTok), new Sentinel(endToks))
            : tokType.isTplCurlyBracketStart
            ? new TplReference(new Sentinel(startToks), new Name(varTok), new Sentinel(endToks))
            : new TplVarReference(new Sentinel(startToks), new Name(varTok), new Sentinel(endToks));
    }
}

export abstract class EasySqlNode {
    abstract getChildren(): EasySqlNode[];
    abstract getToks(): Tok[];

    resetTokFrom(start: number, content: string) {
        this.getToks().forEach((tok) => tok.resetParentTokFrom(start, content));
        return this;
    }
}

export class SqlLine {
    constructor(public nodes: EasySqlNode[]) {}
}

export class Any extends EasySqlNode {
    constructor(public tok: Tok) {
        super();
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
}

export class Sentinel extends EasySqlNode {
    constructor(public toks: Tok[]) {
        super();
    }

    get isEmpty() {
        return this.toks.length === 0;
    }

    merge(node: Sentinel) {
        node.getToks().forEach((tok) => this.toks.push(tok));
        return this;
    }

    getToks() {
        return this.toks;
    }
    getChildren() {
        return [];
    }
}

export class Lit extends EasySqlNode {
    public readonly value: string;
    constructor(public tok: Tok) {
        super();
        this.value = tok.text;
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
    asName(): Name {
        return new Name(this.tok);
    }
}

export class Name extends EasySqlNode {
    public readonly name: string;
    constructor(public tok: Tok) {
        super();
        this.name = tok.text;
    }
    getToks() {
        return [this.tok];
    }
    getChildren() {
        return [];
    }
}
export class VarReference extends EasySqlNode {
    constructor(public start: Sentinel, public var_: Name, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start.getToks().concat(this.var_.getToks()).concat(this.end.getToks());
    }

    getChildren() {
        return [this.var_];
    }
}

export class VarFuncCall extends EasySqlNode {
    constructor(
        public start: Sentinel,
        public funcName: Name,
        public argStart: Sentinel,
        public args: (Lit | VarReference | Sentinel)[],
        public end: Sentinel
    ) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.funcName.getToks())
            .concat(this.argStart.getToks())
            .concat(this.args.flatMap((node) => node.getToks()))
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.funcName, ...this.args.filter((node) => !(node instanceof Sentinel))];
    }
}

export class TplReference extends EasySqlNode {
    constructor(public start: Sentinel, public tpl: Name, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start.getToks().concat(this.tpl.getToks()).concat(this.end.getToks());
    }
    getChildren() {
        return [this.tpl];
    }
}

export class TplVarReference extends EasySqlNode {
    constructor(public start: Sentinel, public var_: Name, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start.getToks().concat(this.var_.getToks()).concat(this.end.getToks());
    }
    getChildren() {
        return [this.var_];
    }
}

export class TplFuncArg extends EasySqlNode {
    constructor(public start: Sentinel, public name: Name, public assignment: Sentinel, public value: Lit | VarReference, public end: Sentinel) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.name.getToks())
            .concat(this.assignment.getToks())
            .concat(this.value.getToks())
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.name];
    }
}

export class TplFuncCall extends EasySqlNode {
    constructor(
        public start: Sentinel,
        public funcName: Name,
        public argStart: Sentinel,
        public args: (TplFuncArg | Sentinel)[],
        public end: Sentinel
    ) {
        super();
    }
    getToks() {
        return this.start
            .getToks()
            .concat(this.funcName.getToks())
            .concat(this.argStart.getToks())
            .concat(this.args.flatMap((node) => node.getToks()))
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.funcName, ...this.args.filter((node) => !(node instanceof Sentinel))];
    }
}

export class Comment extends EasySqlNode {
    constructor(public start: Sentinel, public text: Tok) {
        super();
    }

    getToks() {
        return this.start.getToks().concat([this.text]);
    }

    getChildren(): EasySqlNode[] {
        return [];
    }
}
