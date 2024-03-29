import { sep } from 'path';
import { logger } from '../shared/logger';

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
    get isPoint() {
        return this.id === Tok.TYPES.point.id;
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
    get isTargetName() {
        return this.id === Tok.TYPES.tartetName.id;
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
        quote: new TokType(9, 'quote'),
        point: new TokType(10, 'point'),
        targetStart: new TokType(11, 'targetStart'),
        name: new TokType(20, 'name'),
        nameWide: new TokType(21, 'nameWide'),
        commentStart: new TokType(22, 'commentStart'),
        whiteSpace: new TokType(23, 'whiteSpace'),
        any: new TokType(24, 'any'),
        tartetName: new TokType(25, 'targetName')
    };
    static typeId2Type = new Map<number, TokType>(Object.values(Tok.TYPES).map((type) => [type.id, type]));

    constructor(
        public start: number,
        public length: number,
        public content: string,
        public readonly tokeType: TokType,
        public readonly textHint?: string
    ) {}

    get end() {
        return this.start + this.length;
    }

    get text() {
        if (this.textHint !== undefined) {
            return this.textHint;
        }
        return this.content.substring(this.start, this.start + this.length);
    }

    get isValid() {
        if (this.tokeType.isAssignment) {
            return this.text === '=';
        }
        if (this.tokeType.isName) {
            return /^[a-zA-Z_]\w*$/.test(this.text);
        }
        if (this.tokeType.isNameWide) {
            return /^[^,()\n'"`]+$/.test(this.text);
        }
        if (this.tokeType.isWhiteSpace) {
            return /^\s*$/.test(this.text);
        }
        if (this.tokeType.isPoint) {
            return this.text === '.';
        }
        if (this.tokeType.isComma) {
            return this.text === ',';
        }
        if (this.tokeType.isParenthesisStart) {
            return this.text === '(';
        }
        if (this.tokeType.isParenthesisEnd) {
            return this.text === ')';
        }
        if (this.tokeType.isTargetName) {
            return ['variables', 'list_variables', 'template', 'log', 'action', 'temp', 'cache', 'broadcast', 'check', 'func', 'output'].includes(
                this.text
            );
        }
        return true;
    }

    get invalidReason() {
        if (this.tokeType.isAssignment) {
            return 'Operator "=" required.';
        }
        if (this.tokeType.isName) {
            return 'An identifier or keyword should match /^[a-zA-Z_]\\w*$/ .';
        }
        if (this.tokeType.isNameWide) {
            return 'A literal cannot contain characters of ,()\'"` . Please define a variable instead.';
        }
        if (this.tokeType.isPoint) {
            return 'Should be `.` here.';
        }
        if (this.tokeType.isComma) {
            return 'Should be `,` here.';
        }
        if (this.tokeType.isParenthesisStart) {
            return 'Should be `(` here.';
        }
        if (this.tokeType.isParenthesisEnd) {
            return 'Should be `)` here.';
        }
        if (this.tokeType.isTargetName) {
            return 'Unrecognized target.';
        }
        if (!this.text) {
            return 'Must not be empty.';
        }
        if (this.tokeType.isWhiteSpace) {
            return 'Unrecognize text.';
        }
        return 'Unknown.';
    }

    addCharOfLength(charLength: number) {
        if (charLength < 0) {
            this.start += charLength; // add to head
            this.length += -charLength;
        } else {
            this.length += charLength; // add to end
        }
    }

    resetParentTokFrom(start: number, content: string) {
        this.start = this.start + start;
        this.content = content;
    }

    parentTokFrom(start: number, content: string) {
        return new Tok(this.start + start, this.length, content, this.tokeType, this.textHint);
    }
}

export class EasySQLContentFinder {
    public static findCommentStartInCurrentLine(content: string): number {
        // backslash is backslash in sql, it's not used to escape characters.
        // If we need to insert a quote inside string, just use double quotes. e.g. '''' is for single quote in string.
        const quoteChars = '\'"`';
        let quoteOpen = '';
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\n') {
                return -1;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch) {
                    quoteOpen = '';
                } else if (!quoteOpen) {
                    quoteOpen = ch;
                }
            } else if (ch === '-' && content.charAt(i + 1) === '-' && !quoteOpen) {
                return i;
            }
        }
        return -1;
    }

    public static findOpenQuoteInCurrentLine(content: string): number {
        // backslash is backslash in sql, it's not used to escape characters.
        // If we need to insert a quote inside string, just use double quotes. e.g. '''' is for single quote in string.
        const quoteChars = '\'"`';
        let quoteOpen = '';
        let quoteOpenIdx = -1;
        for (let i = 0; i < content.length; i++) {
            const ch = content.charAt(i);
            if (ch === '\n') {
                return quoteOpenIdx;
            }
            if (quoteChars.includes(ch)) {
                if (quoteOpen === ch) {
                    quoteOpen = '';
                    quoteOpenIdx = -1;
                } else if (!quoteOpen) {
                    quoteOpen = ch;
                    quoteOpenIdx = i;
                }
            }
        }
        return quoteOpenIdx;
    }
}

export class SinlgeFuncCallParser {
    parse(content: string, withoutCurlyBracket?: boolean): VarFuncCall | TplFuncCall | FuncCall {
        // e.g. ${func(var1, ${var2}, var3)}, @{func(a=var1, b=${var2})}, ${func()}, @{func()}
        const tokType = withoutCurlyBracket
            ? Tok.TYPES.varCurlyBracketStart
            : content[0] === '$'
            ? Tok.TYPES.varCurlyBracketStart
            : Tok.TYPES.tplCurlyBracketStart;
        const startNode = new Sentinel([new Tok(0, 2, content, tokType)]);

        // handle: func(
        let contentStart = withoutCurlyBracket ? 0 : 2;
        const funcCallContent = content.substring(contentStart, content.length - contentStart);
        const parenthesisStart = funcCallContent.indexOf('(');
        if (parenthesisStart === -1) {
            throw new Error('Must have parenthesis start, found nothing');
        }
        const [sentinelNode, funcNameNode, argStart] = this.parseFuncStartNodes(funcCallContent, parenthesisStart).map((node) =>
            node.resetTokFrom(contentStart, content)
        ) as [Sentinel, Name, Sentinel];
        startNode.merge(sentinelNode);

        // handle params
        contentStart = contentStart + parenthesisStart + 1;
        const parenthesisEndIdx = content.lastIndexOf(')');
        if (parenthesisEndIdx === -1) {
            throw new Error('Should contain right parenthesis, found nothing!');
        }
        const paramsContent = content.substring(contentStart, parenthesisEndIdx);
        const paramsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = this.parseParams(paramsContent, contentStart, content, tokType);

        // handle end: )}, ) }
        const endNode = this.parseEndNode(parenthesisEndIdx, content, withoutCurlyBracket);

        if (withoutCurlyBracket) {
            return new FuncCall(funcNameNode, argStart, paramsNode as (Sentinel | Lit | VarReference)[], endNode);
        }

        return tokType.isVarCurlyBracketStart
            ? new VarFuncCall(startNode, funcNameNode, argStart, paramsNode as (Sentinel | Lit | VarReference)[], endNode)
            : new TplFuncCall(startNode, funcNameNode, argStart, paramsNode as (Sentinel | TplFuncArg)[], endNode);
    }

    private parseEndNode(parenthesisEndIdx: number, content: string, withoutCurlyBracket?: boolean) {
        const endToks = [new Tok(parenthesisEndIdx, 1, content, Tok.TYPES.parenthesisEnd)];
        if (withoutCurlyBracket) {
            return new Sentinel(endToks);
        }
        if (parenthesisEndIdx !== content.length - 2) {
            endToks.push(new Tok(parenthesisEndIdx + 1, content.length - parenthesisEndIdx - 2, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        const endNode = new Sentinel(endToks);
        return endNode;
    }

    private parseFuncStartNodes(funcCallContent: string, parenthesisStart: number): [Sentinel, Name, Sentinel] {
        const funcName = funcCallContent.substring(0, parenthesisStart + 1);
        const matches = funcName.match(/^(\s*)([^\s]?.*)\($/);
        if (!matches) {
            throw new Error('Must have a match, found nothing: ' + funcCallContent);
        }

        const sentinelToks = [];
        if (matches[1]) {
            sentinelToks.push(new Tok(0, matches[1].length, funcCallContent, Tok.TYPES.whiteSpace));
        }

        const sentinelNode = new Sentinel(sentinelToks);
        const funcNameNode = new Name(new Tok(matches[1].length, matches[2].length, funcCallContent, Tok.TYPES.name));
        const argStart = new Sentinel([new Tok(parenthesisStart, 1, funcCallContent, Tok.TYPES.parenthesisStart)]);
        return [sentinelNode, funcNameNode, argStart];
    }

    private parseParams(paramsContent: string, contentStart: number, content: string, tokType: TokType) {
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
                    const tplFuncVar = this.parseTplFuncVarWithNoAssignment(paramContent).resetTokFrom(contentStart + paramStart, content);
                    paramsNode.push(tplFuncVar);
                } else {
                    const tplFuncVar = this.parseTplFuncVar(paramContent, assignmentIdx, contentStart, paramStart, content);
                    paramsNode.push(tplFuncVar);
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
        const squeezedParamsNode: (Lit | VarReference | TplFuncArg | Sentinel)[] = this.squeezeSentinelNodes(paramsNode);

        return squeezedParamsNode;
    }

    private parseTplFuncVar(paramContent: string, assignmentIdx: number, contentStart: number, paramStart: number, content: string) {
        const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(paramContent.substring(0, assignmentIdx), Tok.TYPES.name).map(
            (node) => node.resetTokFrom(contentStart + paramStart, content)
        ) as [Sentinel, Lit, Sentinel];
        const assignment = new Sentinel([new Tok(contentStart + paramStart + assignmentIdx, 1, content, Tok.TYPES.assignment)]);
        const value: [Sentinel, Lit | VarReference, Sentinel] = this.parseNameWithWhiteSpace(
            paramContent.substring(assignmentIdx + 1),
            Tok.TYPES.nameWide,
            true
        ).map((node) => node.resetTokFrom(contentStart + paramStart + assignmentIdx + 1, content)) as [Sentinel, Lit | VarReference, Sentinel];
        const tplFuncVar = new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment).merge(value[0]), value[1], value[2]);
        return tplFuncVar;
    }

    private parseTplFuncVarWithNoAssignment(paramContent: string) {
        const argName: [Sentinel, Lit, Sentinel] = this.parseNameWithWhiteSpace(paramContent, Tok.TYPES.name) as [Sentinel, Lit, Sentinel];
        const assignment = new Sentinel([new Tok(paramContent.length, 0, paramContent, Tok.TYPES.assignment)]);
        const value = new Lit(new Tok(paramContent.length, 0, paramContent, Tok.TYPES.nameWide));
        const tplFuncVar = new TplFuncArg(argName[0], argName[1].asName(), argName[2].merge(assignment), value, new Sentinel([]));
        return tplFuncVar;
    }

    private squeezeSentinelNodes(paramsNode: (VarReference | Sentinel | Lit | TplFuncArg)[]) {
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
        return squeezedParamsNode;
    }

    private parseNameWithWhiteSpace(content: string, tokType: TokType, parseVarReference?: boolean): [Sentinel, Lit | VarReference, Sentinel] {
        const leftTrimed = content.trimStart();
        const leftSpaceLength = content.length - leftTrimed.length;
        const startNode = new Sentinel(leftSpaceLength > 0 ? [new Tok(0, leftSpaceLength, content, Tok.TYPES.whiteSpace)] : []);

        let valueNode: Lit | VarReference;
        const rightTrimed = leftTrimed.trimEnd();
        if (parseVarReference && /^\${.*}$/.test(rightTrimed)) {
            valueNode = new SingleVarParser().parse(rightTrimed).resetTokFrom(leftSpaceLength, content) as VarReference;
        } else {
            valueNode = new Lit(new Tok(leftSpaceLength, rightTrimed.length, content, tokType));
        }

        const rightSpaceLength = leftTrimed.length - rightTrimed.length;
        const endNode = new Sentinel(
            rightSpaceLength > 0 ? [new Tok(content.length - rightSpaceLength, rightSpaceLength, content, Tok.TYPES.whiteSpace)] : []
        );

        return [startNode, valueNode, endNode];
    }
}

export class SingleVarParser {
    parse(content: string) {
        // e.g. ${var2}  @{ var2 }
        const tokType =
            content[0] === '$'
                ? Tok.TYPES.varCurlyBracketStart
                : content[0] === '@'
                ? Tok.TYPES.tplCurlyBracketStart
                : Tok.TYPES.tplVarCurlyBracketStart;

        // start node
        const startToks = [new Tok(0, 2, content, tokType)];
        const nameContent = content.substring(2, content.length - 1);
        const startMatches = nameContent.match(/^(\s*)/);
        if (!startMatches) {
            throw new Error('Must have a match, found nothing');
        }
        const start = 2;
        if (startMatches[1]) {
            startToks.push(new Tok(start, startMatches[1].length, content, Tok.TYPES.whiteSpace));
        }
        const startNode = new Sentinel(startToks);

        const endMatches = nameContent.substring(startMatches[1]?.length || 0).match(/(\s*)$/);
        if (!endMatches) {
            throw new Error('Must have a match, found nothing');
        }

        // var name node
        const varTok = new Tok(
            start + startMatches[1].length,
            nameContent.length - startMatches[1].length - endMatches[1].length,
            content,
            Tok.TYPES.name
        );
        const varName = new Name(varTok);

        // end node
        const endToks: Tok[] = [];
        if (endMatches[1]) {
            endToks.push(new Tok(start + (startMatches[1]?.length || 0) + endMatches.index!, endMatches[1].length, content, Tok.TYPES.whiteSpace));
        }
        endToks.push(new Tok(content.length - 1, 1, content, Tok.TYPES.curlyBracketEnd));
        const endNode = new Sentinel(endToks);

        return tokType.isVarCurlyBracketStart
            ? new VarReference(startNode, varName, endNode)
            : tokType.isTplCurlyBracketStart
            ? new TplReference(startNode, varName, endNode)
            : new TplVarReference(startNode, varName, endNode);
    }
}

export class ConditionParser {
    accept(content: string) {
        return content.match(/^if=[^(]*\([^)]*\)/);
    }
    parse(content: string): Condition {
        const funcEndPos = content.indexOf(')');
        if (funcEndPos === -1) {
            throw new Error('func end parenthesis must exist');
        }
        const contentWithEndTrimed = content.substring(0, funcEndPos + 1);
        const end =
            contentWithEndTrimed.length === content.length
                ? new Sentinel([])
                : new Sentinel([new Tok(contentWithEndTrimed.length, content.length - contentWithEndTrimed.length, content, Tok.TYPES.whiteSpace)]);
        return new Condition(
            new Sentinel([new Tok(0, 2, content, Tok.TYPES.name), new Tok(2, 1, content, Tok.TYPES.assignment)]),
            (new SinlgeFuncCallParser().parse(content.substring(3, funcEndPos + 1), true) as FuncCall).resetTokFrom(3, content),
            end
        );
    }

    acceptWithSeparator(content: string) {
        return !!content.match(/^(\s*),(\s*)if=[^(]*\([^)]*\)/);
    }

    parseWithSeparator(content: string): [Sentinel, Condition] {
        const m = content.match(/^(\s*),(\s*)if=[^(]*\([^)]*\)/);
        if (!m) {
            throw new Error('should exist a match');
        }
        const separatorToks: Tok[] = [];
        let startPos = 0;
        if (m[1]) {
            separatorToks.push(new Tok(0, m[1].length, content, Tok.TYPES.whiteSpace));
            startPos = m[1].length;
        }
        separatorToks.push(new Tok(startPos, 1, content, Tok.TYPES.comma));
        startPos += 1;
        if (m[2]) {
            separatorToks.push(new Tok(startPos, m[2].length, content, Tok.TYPES.whiteSpace));
            startPos += m[2].length;
        }

        const separator = new Sentinel(separatorToks);
        const condition = this.parse(content.substring(startPos)).resetTokFrom(startPos, content);
        return [separator, condition];
    }
}

export class TargetParser {
    private conditionParser = new ConditionParser();
    accept(content: string): boolean {
        return !!content.match(/^-- target=\w+/);
    }
    parse(content: string): Target {
        const m = content.match(/^(-- target)(=)(\w*)([^\w].*)?$/);
        if (m) {
            const targetStartTokLen = '-- target'.length;
            const type = m[3];
            const startTok = new Sentinel([
                new Tok(0, targetStartTokLen, content, Tok.TYPES.targetStart),
                new Tok(targetStartTokLen, 1, content, Tok.TYPES.assignment),
                new Tok(targetStartTokLen + 1, type.length, content, Tok.TYPES.tartetName)
            ]);

            switch (type) {
                case 'variables':
                case 'list_variables':
                    return this.parseVariables(type, content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                case 'template':
                case 'log':
                case 'action':
                case 'temp':
                case 'cache':
                case 'broadcast':
                    return this.parseSimpleNamedTarget(type, content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                case 'check':
                    if (!m[4] || !m[4].match(/^[^,]*\([^)]*\)/)) {
                        return this.parseSimpleNamedTarget('check', content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                    }
                    return this.parseFunc(type, content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                case 'func':
                    return this.parseFunc(type, content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                case 'output':
                    return this.parseOutput(content, startTok, targetStartTokLen + 1 + type.length, m[4]);
                default:
                    return new Target(
                        startTok,
                        new Sentinel([]),
                        null,
                        m[4]
                            ? new Sentinel([new Tok(targetStartTokLen + 1 + type.length, m[4].length, content, Tok.TYPES.whiteSpace)])
                            : new Sentinel([])
                    );
            }
        } else {
            throw new Error('should exist a match!');
        }
    }
    private parseFunc(type: 'check' | 'func', content: string, startTok: Sentinel, endBlockStart: number, endBlock: string | undefined) {
        const cls = type === 'check' ? Check : Func;
        if (!endBlock) {
            return new cls(
                startTok,
                new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]),
                new FuncCall(
                    new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.parenthesisStart)]),
                    [],
                    new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.parenthesisEnd)])
                ),
                new Sentinel([]),
                null,
                new Sentinel([])
            );
        }
        const separator = endBlock.startsWith('.')
            ? new Sentinel([new Tok(endBlockStart, 1, content, Tok.TYPES.point)])
            : new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]);
        const funcCallStart = endBlock.startsWith('.') ? 1 : 0;
        const m = endBlock.match(/^\.?([^(]*\([^)]*\))([^,]*)?(,.*)?$/);
        if (!m) {
            const nameStartPos = endBlock.startsWith('.') ? 1 : 0;
            return new cls(
                startTok,
                separator,
                new FuncCall(
                    new Name(new Tok(endBlockStart + nameStartPos, endBlock.length - nameStartPos, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart + endBlock.length, 0, content, Tok.TYPES.parenthesisStart)]),
                    [],
                    new Sentinel([new Tok(endBlockStart + endBlock.length, 0, content, Tok.TYPES.parenthesisEnd)])
                ),
                new Sentinel([]),
                null,
                new Sentinel([])
            );
        }
        const funcContent = m[1];
        const funcCall = (new SinlgeFuncCallParser().parse(funcContent, true) as FuncCall).resetTokFrom(endBlockStart + funcCallStart, content);
        let conditionSeparator = m[2]
            ? new Sentinel([new Tok(endBlockStart + funcCallStart + funcContent.length, m[2].length, content, Tok.TYPES.whiteSpace)])
            : new Sentinel([]);
        if (m[3] && this.conditionParser.acceptWithSeparator(m[3])) {
            const [_separator, condition] = this.conditionParser.parseWithSeparator(m[3]);
            const conditionStart = endBlockStart + funcCallStart + funcContent.length + (m[2]?.length || 0);
            return new cls(
                startTok,
                separator,
                funcCall,
                conditionSeparator.merge(_separator.resetTokFrom(conditionStart, content)),
                condition.resetTokFrom(conditionStart, content),
                new Sentinel([])
            );
        }
        if (m[3]) {
            conditionSeparator = new Sentinel([
                new Tok(endBlockStart + funcCallStart + funcContent.length, (m[2]?.length || 0) + m[3].length, content, Tok.TYPES.whiteSpace)
            ]);
        }
        return new cls(startTok, separator, funcCall, conditionSeparator, null, new Sentinel([]));
    }
    private parseOutput(content: string, startTok: Sentinel, endBlockStart: number, endBlock: string | undefined) {
        if (!endBlock) {
            return new Output(
                startTok,
                new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]),
                new Table(
                    new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name))
                ),
                new Sentinel([]),
                null,
                new Sentinel([])
            );
        }
        const m = endBlock.match(/^(\.[^.,\s]*)?(\.[^.,\s]*)?(\.[^.,\s]*)?([^,]*)(,.*)?$/);
        if (m) {
            const tableSeparator = m[1]
                ? new Sentinel([new Tok(endBlockStart, 1, content, Tok.TYPES.point)])
                : new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]);
            let table: Table | FullTable;
            let conditionSeparatorStart = 0;
            if (m[1] && m[2] && m[3]) {
                table = new FullTable(
                    new Name(new Tok(endBlockStart + 1, m[1].length - 1, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart + m[1].length, 1, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart + m[1].length + 1, m[2].length - 1, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart + m[1].length + m[2].length, 1, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart + m[1].length + m[2].length + 1, m[3].length - 1, content, Tok.TYPES.name))
                );
                conditionSeparatorStart = endBlockStart + m[1].length + m[2].length + m[3].length;
            } else if (m[1] && m[2]) {
                table = new Table(
                    new Name(new Tok(endBlockStart + 1, m[1].length - 1, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart + m[1].length, 1, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart + m[1].length + 1, m[2].length - 1, content, Tok.TYPES.name))
                );
                conditionSeparatorStart = endBlockStart + m[1].length + m[2].length;
            } else if (m[1]) {
                table = new Table(
                    new Name(new Tok(endBlockStart + 1, m[1].length - 1, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart + m[1].length, 0, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart + m[1].length, 0, content, Tok.TYPES.name))
                );
                conditionSeparatorStart = endBlockStart + m[1].length;
            } else {
                table = new Table(
                    new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name)),
                    new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]),
                    new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name))
                );
                conditionSeparatorStart = endBlockStart;
            }
            let conditionSeparator = m[4]
                ? new Sentinel([new Tok(conditionSeparatorStart, m[4].length, content, Tok.TYPES.whiteSpace)])
                : new Sentinel([]);
            conditionSeparatorStart = m[4] ? conditionSeparatorStart + m[4].length : conditionSeparatorStart;
            if (m[5]) {
                const conditionContent = endBlock.substring(conditionSeparatorStart - endBlockStart);
                if (this.conditionParser.acceptWithSeparator(conditionContent)) {
                    const [separator, condition] = this.conditionParser.parseWithSeparator(conditionContent);
                    return new Output(
                        startTok,
                        tableSeparator,
                        table,
                        conditionSeparator.merge(separator.resetTokFrom(conditionSeparatorStart, content)),
                        condition.resetTokFrom(conditionSeparatorStart, content),
                        new Sentinel([])
                    );
                } else {
                    conditionSeparator = m[4]
                        ? new Sentinel([new Tok(conditionSeparator.toks[0].start, m[4].length + m[5].length, content, Tok.TYPES.whiteSpace)])
                        : new Sentinel([new Tok(conditionSeparatorStart, m[5].length, content, Tok.TYPES.whiteSpace)]);
                    return new Output(startTok, tableSeparator, table, conditionSeparator, null, new Sentinel([]));
                }
            }
            return new Output(startTok, tableSeparator, table, conditionSeparator, null, new Sentinel([]));
        }
        throw new Error('should exist match');
    }
    private parseSimpleNamedTarget(
        type: 'template' | 'log' | 'action' | 'temp' | 'cache' | 'broadcast' | 'check',
        content: string,
        startTok: Sentinel,
        endBlockStart: number,
        endBlock: string | undefined
    ) {
        const cls = {
            template: Template,
            log: Log,
            action: Action,
            temp: Temp,
            cache: Cache,
            broadcast: Broadcast,
            check: Check
        }[type];
        if (!endBlock) {
            return new cls(
                startTok,
                new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]),
                new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name)),
                new Sentinel([]),
                null,
                new Sentinel([])
            );
        }
        const m = endBlock.match(/^(\.[^\s,]*)?([^,]*)?(,.*)?$/);
        if (!m) {
            throw new Error('should exist match');
        }
        const nameSep = m[1]
            ? new Sentinel([new Tok(endBlockStart, 1, content, Tok.TYPES.point)])
            : new Sentinel([new Tok(endBlockStart, 0, content, Tok.TYPES.point)]);
        const name = m[1]
            ? new Name(new Tok(endBlockStart + 1, m[1].length - 1, content, Tok.TYPES.name))
            : new Name(new Tok(endBlockStart, 0, content, Tok.TYPES.name));
        const whiteSpaceStart = m[1] ? m[1].length : 0;
        let whiteSpace = m[2]
            ? new Tok(endBlockStart + whiteSpaceStart, m[2].length, content, Tok.TYPES.whiteSpace)
            : new Tok(endBlockStart + whiteSpaceStart, 0, content, Tok.TYPES.whiteSpace);
        const nextBlockStart = m[2] ? whiteSpaceStart + m[2].length : whiteSpaceStart;
        if (m[3] && this.conditionParser.acceptWithSeparator(m[3])) {
            const [separator, condition] = this.conditionParser.parseWithSeparator(endBlock.substring(nextBlockStart));
            return new cls(
                startTok,
                nameSep,
                name,
                new Sentinel(whiteSpace.length ? [whiteSpace] : []).merge(separator.resetTokFrom(endBlockStart + nextBlockStart, content)),
                condition.resetTokFrom(endBlockStart + nextBlockStart, content),
                new Sentinel([])
            );
        }
        whiteSpace = new Tok(whiteSpace.start, whiteSpace.length + endBlock.length - nextBlockStart, content, Tok.TYPES.whiteSpace);
        return new cls(startTok, nameSep, name, new Sentinel([whiteSpace]), null, new Sentinel([]));
    }
    private parseVariables(
        type: 'variables' | 'list_variables',
        content: string,
        startTok: Sentinel,
        endBlockStart: number,
        endBlock: string | undefined
    ) {
        const cls = type === 'variables' ? Variables : ListVariables;
        if (!endBlock) {
            return new cls(startTok, new Sentinel([]), null, new Sentinel([]));
        }
        const m = endBlock.match(/^([^,]*)?(,.*)?$/);
        if (!m) {
            throw new Error('should exist a match');
        }
        let whiteSpace = m[1]
            ? new Tok(endBlockStart, m[1].length, content, Tok.TYPES.whiteSpace)
            : new Tok(endBlockStart, 0, content, Tok.TYPES.whiteSpace);
        if (m[2] && this.conditionParser.acceptWithSeparator(m[2])) {
            const [separator, condition] = this.conditionParser.parseWithSeparator(m[2]);
            return new cls(
                startTok,
                new Sentinel(whiteSpace.length ? [whiteSpace] : []).merge(separator.resetTokFrom(endBlockStart + (m[1]?.length || 0), content)),
                condition.resetTokFrom(endBlockStart + (m[1]?.length || 0), content),
                new Sentinel([])
            );
        }
        whiteSpace = new Tok(whiteSpace.start, whiteSpace.length + (m[2]?.length || 0), content, Tok.TYPES.whiteSpace);
        return new cls(startTok, new Sentinel([whiteSpace]), null, new Sentinel([]));
    }
}

let i = 0;
export class Parser {
    private targetParser = new TargetParser();

    parse(content: string): EasySqlNode[] {
        let targetStartPos = 0;
        return content.split(new RegExp('\\n-- target=(?=\\w)')).flatMap((targetContent, i) => {
            targetContent = i !== 0 ? '-- target=' + targetContent : targetContent;
            const startNodes: EasySqlNode[] = i !== 0 ? [new Any(new Tok(targetStartPos, 1, content, Tok.TYPES.any))] : [];
            const nextLineBreakIdx = targetContent.indexOf('\n');
            if (nextLineBreakIdx === -1) {
                const target: EasySqlNode[] = this.targetParser.accept(targetContent)
                    ? [this.targetParser.parse(targetContent)]
                    : this.parseBody(targetContent);
                const result = target.map((node) => node.resetTokFrom(targetStartPos + (i === 0 ? 0 : 1), content));
                targetStartPos += targetContent.length + (i === 0 ? 0 : 1);
                return startNodes.concat(result);
            } else {
                const target: EasySqlNode[] = this.targetParser.accept(targetContent)
                    ? [this.targetParser.parse(targetContent.substring(0, nextLineBreakIdx))]
                    : this.parseBody(targetContent.substring(0, nextLineBreakIdx));
                const bodyContent = targetContent.substring(nextLineBreakIdx);
                const result = target
                    .concat(this.parseBody(bodyContent).map((node) => node.resetTokFrom(nextLineBreakIdx, bodyContent)))
                    .map((node) => node.resetTokFrom(targetStartPos + (i === 0 ? 0 : 1), content));
                targetStartPos += targetContent.length + (i === 0 ? 0 : 1);
                return startNodes.concat(result);
            }
        });
    }

    parseBody(content: string, ignoreComment?: boolean, ignoreQuote?: boolean): EasySqlNode[] {
        i += 1;
        if (i > 50) {
            // throw new Error('stuck overflow');
        }
        logger.debug(`parsing content: ${content}, ignoreComment=${ignoreComment}, ignoreQuote=${ignoreQuote}`);
        if (ignoreQuote && !ignoreComment) {
            throw new Error("If quote is ignored, comment must be ignored. Since we don't need to find comments inside a string!");
        }

        let commentStartIdx = -1;
        if (!ignoreComment) {
            commentStartIdx = EasySQLContentFinder.findCommentStartInCurrentLine(content);
            if (commentStartIdx !== -1) {
                return this.parseContentWithCommentInCurrentLine(content, commentStartIdx);
            }
        }

        if (!ignoreQuote) {
            const openQuoteIdx = EasySQLContentFinder.findOpenQuoteInCurrentLine(content);
            if (openQuoteIdx !== -1) {
                return this.parseContentWithOpenQuoteInCurrentLine(content, openQuoteIdx);
            }
        }

        let nodes: EasySqlNode[] = [];
        let tplCallMatch = content.match(/@{(\n|[^'"`(}])+\((\n|[^'"`)])*\)(\n|\s)*}/);
        let funcCallMatch = content.match(/\${([^'"`(}])+\(([^'"`)])*\)(\s)*}/);
        let varMatch = content.match(/[$@#]{[^}]*}/);
        let quoteMatch = ignoreQuote ? null : content.match(/(['"`])/);
        const nextLineBreakIdx = content.indexOf('\n');
        if (nextLineBreakIdx !== -1) {
            if (tplCallMatch && tplCallMatch.index! > nextLineBreakIdx) {
                tplCallMatch = null;
            }
            if (funcCallMatch && funcCallMatch.index! > nextLineBreakIdx) {
                funcCallMatch = null;
            }
            if (varMatch && varMatch.index! > nextLineBreakIdx) {
                varMatch = null;
            }
            if (quoteMatch && quoteMatch.index! > nextLineBreakIdx) {
                quoteMatch = null;
            }
        }

        const firstMatch = this.findFirstMatch([tplCallMatch, funcCallMatch, varMatch, quoteMatch]);
        if (firstMatch) {
            if (firstMatch.index! !== 0) {
                nodes.push(new Any(new Tok(0, firstMatch.index!, content, Tok.TYPES.any)));
            }
            let nextStartIndex = firstMatch.index! + firstMatch[0].length;
            if (firstMatch === varMatch) {
                nodes.push(this.parseSingleVar(firstMatch[0]).resetTokFrom(firstMatch.index!, content));
            } else if (firstMatch !== quoteMatch) {
                nodes.push(this.parseSingleFuncCall(firstMatch[0]).resetTokFrom(firstMatch.index!, content));
            } else {
                const [nodesFromStr, strEndIdx] = this.parseStr(quoteMatch, content);
                nextStartIndex = strEndIdx + 1;
                nodes = nodes.concat(nodesFromStr);
            }
            this.parseBody(content.substring(nextStartIndex), ignoreComment, ignoreQuote).forEach((node) =>
                nodes.push(node.resetTokFrom(nextStartIndex, content))
            );
            return nodes;
        }

        if (content) {
            const nextLineBreakIdx = content.indexOf('\n');
            if (nextLineBreakIdx !== -1) {
                const nodes: EasySqlNode[] = [
                    new Any(new Tok(0, nextLineBreakIdx === -1 ? content.length : nextLineBreakIdx + 1, content, Tok.TYPES.any))
                ];
                return nodes.concat(
                    this.parseBody(content.substring(nextLineBreakIdx + 1)).map((node) => node.resetTokFrom(nextLineBreakIdx + 1, content))
                );
            }
            return [new Any(new Tok(0, content.length, content, Tok.TYPES.any)) as EasySqlNode];
        }

        return [];
    }

    private parseContentWithOpenQuoteInCurrentLine(content: string, openQuoteIdx: number) {
        let nodes: EasySqlNode[] = [];
        nodes = nodes.concat(this.parseBody(content.substring(0, openQuoteIdx), true).map((node) => node.resetTokFrom(0, content)));

        const nextLineBreakIdx = content.indexOf('\n');
        const openStrLength = nextLineBreakIdx === -1 ? content.length - openQuoteIdx : nextLineBreakIdx - openQuoteIdx;
        nodes.push(new Str(new Tok(openQuoteIdx, openStrLength, content, Tok.TYPES.any)));

        if (nextLineBreakIdx !== -1) {
            nodes.push(new Any(new Tok(nextLineBreakIdx, 1, content, Tok.TYPES.any)));
            this.parseBody(content.substring(nextLineBreakIdx + 1)).forEach((node) => nodes.push(node.resetTokFrom(nextLineBreakIdx + 1, content)));
        }
        return nodes;
    }

    private parseContentWithCommentInCurrentLine(content: string, commentStartIdx: number) {
        let nodes: EasySqlNode[] = [];

        const nextLineBreakIdx = content.indexOf('\n');
        nodes = nodes.concat(this.parseBody(content.substring(0, commentStartIdx), true).map((node) => node.resetTokFrom(0, content)));
        nodes.push(
            new Comment(
                new Sentinel([new Tok(commentStartIdx, 2, content, Tok.TYPES.commentStart)]),
                new Tok(
                    commentStartIdx + 2,
                    (nextLineBreakIdx === -1 ? content.length : nextLineBreakIdx) - commentStartIdx - 2,
                    content,
                    Tok.TYPES.any
                )
            )
        );

        if (nextLineBreakIdx !== -1) {
            nodes.push(new Any(new Tok(nextLineBreakIdx, 1, content, Tok.TYPES.any)));
            this.parseBody(content.substring(nextLineBreakIdx + 1)).forEach((node) => nodes.push(node.resetTokFrom(nextLineBreakIdx + 1, content)));
        }
        return nodes;
    }

    private parseStr(quoteMatch: RegExpMatchArray, content: string): [EasySqlNode[], number] {
        let nodesFromStr: EasySqlNode[] = [];
        const quoteStartIdx = quoteMatch.index!;
        const quoteEndIdx = content.indexOf(quoteMatch[0], quoteStartIdx + 1);
        if (!quoteEndIdx) {
            throw new Error('No quote end found, this should not happen! Current line: ' + content.substring(0, quoteEndIdx + 1));
        }

        const stringContent = content.substring(quoteStartIdx + 1, quoteEndIdx);
        if (stringContent.includes('\n')) {
            throw new Error('No line break should be included in string. This should not happen! Current string: ' + stringContent);
        }

        logger.debug('parsing string: ', stringContent);
        const nodesInStr = this.parseBody(stringContent, true, true).map((node) => node.resetTokFrom(quoteStartIdx + 1, content));

        // change first any and add starting quote to str
        if (nodesInStr.length && nodesInStr[0] instanceof Any) {
            nodesFromStr.push(nodesInStr[0].addCharOfLength(-1).asStr()); // include starting quote
            nodesInStr.splice(0, 1);
        } else {
            nodesFromStr.push(new Str(new Tok(quoteStartIdx, 1, content, Tok.TYPES.quote)));
        }
        if (nodesInStr.length && nodesInStr[0] instanceof Any) {
            throw new Error('Should not contain Any node at the top. Found: ' + nodesInStr[0].join());
        }

        // add nodes, and change last any and add ending quote to str
        if (nodesInStr.length && nodesInStr[nodesInStr.length - 1] instanceof Any) {
            nodesFromStr = nodesFromStr.concat(nodesInStr.slice(0, nodesInStr.length - 1).map((node) => (node instanceof Any ? node.asStr() : node)));
            nodesFromStr.push((nodesInStr[nodesInStr.length - 1] as Any).addCharOfLength(1).asStr()); // include end quote
        } else {
            nodesFromStr = nodesFromStr.concat(nodesInStr.map((node) => (node instanceof Any ? node.asStr() : node)));
            nodesFromStr.push(new Str(new Tok(quoteEndIdx, 1, content, Tok.TYPES.quote)));
        }

        if (nodesFromStr.length === 2) {
            // only start and end, merge them into one
            const [start, end] = [nodesFromStr[0] as Str, nodesFromStr[1] as Str];
            nodesFromStr = [new Str(new Tok(start.text.start, start.text.length + end.text.length, start.text.content, Tok.TYPES.any))];
        }

        return [nodesFromStr, quoteEndIdx];
    }

    private findFirstMatch([tplCallMatch, funcCallMatch, varMatch, quoteMatch]: (RegExpMatchArray | null)[]): RegExpMatchArray | null {
        const matches = [
            { priorityOnEq: -1, match: tplCallMatch }, // will never conflict with the other three
            { priorityOnEq: 1, match: funcCallMatch },
            { priorityOnEq: 2, match: varMatch },
            { priorityOnEq: -1, match: quoteMatch } // will never conflict with the other three
        ].filter((m) => !!m.match);
        matches.sort((a, b) => {
            if (a.match!.index! === b.match!.index!) {
                return a.priorityOnEq - b.priorityOnEq;
            }
            return a.match!.index! - b.match!.index!;
        });
        if (!matches.length) {
            return null;
        }
        return matches[0].match;
    }

    public parseSingleFuncCall(content: string): VarFuncCall | TplFuncCall {
        return new SinlgeFuncCallParser().parse(content) as VarFuncCall | TplFuncCall;
    }

    public parseTarget(content: string): Target {
        return new TargetParser().parse(content);
    }

    public acceptTarget(content: string): boolean {
        return new TargetParser().accept(content);
    }

    public parseSingleVar(content: string): VarReference | TplReference | TplVarReference {
        return new SingleVarParser().parse(content);
    }
}

export abstract class EasySqlNode {
    abstract getChildren(): EasySqlNode[];
    abstract getToks(): Tok[];

    resetTokFrom(start: number, content: string) {
        this.getToks().forEach((tok) => tok.resetParentTokFrom(start, content));
        return this;
    }

    get startPos(): number {
        if ((this as any).start) {
            return (this as any).start.startPos;
        }
        const start = this.getToks()[0]?.start;
        return start === undefined ? -1 : start;
    }

    get endPos(): number {
        if ((this as any).end) {
            return (this as any).end.endPos;
        }
        const toks = this.getToks();
        const end = toks[toks.length - 1]?.end;
        return end === undefined ? -1 : end;
    }

    join(): string {
        const toks = this.getToks();
        if (!toks.length) {
            return '';
        }
        return toks[0].content.substring(toks[0].start, toks[toks.length - 1].end);
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
    asStr(): Str {
        return new Str(this.tok);
    }
    addCharOfLength(charLength: number) {
        if (!this.tok) {
            throw new Error('no tok found to add chars');
        }
        this.tok.addCharOfLength(charLength);
        return this;
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

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    getToks() {
        return this.start.getToks().concat(this.var_.getToks()).concat(this.end.getToks());
    }

    getChildren() {
        return [this.var_];
    }

    get varTok() {
        return this.var_.tok;
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

    get argStartTok() {
        return this.argStart.getToks().find((tok) => tok.tokeType.isParenthesisStart)!;
    }

    get argEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isParenthesisEnd)!;
    }
    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
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

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    get varTok() {
        return this.tpl.tok;
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

    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplVarCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
    }

    get varTok() {
        return this.var_.tok;
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

    get assignmentTok() {
        return this.assignment.getToks().find((tok) => tok.tokeType.isAssignment)!;
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
    get argStartTok() {
        return this.argStart.getToks().find((tok) => tok.tokeType.isParenthesisStart)!;
    }

    get argEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isParenthesisEnd)!;
    }
    get bracketStartTok() {
        return this.start.getToks().find((tok) => tok.tokeType.isTplCurlyBracketStart)!;
    }

    get bracketEndTok() {
        return this.end.getToks().find((tok) => tok.tokeType.isCurlyBracketEnd)!;
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

export class Str extends EasySqlNode {
    constructor(public text: Tok) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return [this.text];
    }
}

export class FuncCall extends EasySqlNode {
    constructor(public funcName: Name, public argStart: Sentinel, public args: (Lit | VarReference | Sentinel)[], public end: Sentinel) {
        super();
    }
    getToks() {
        return this.funcName
            .getToks()
            .concat(this.argStart.getToks())
            .concat(this.args.flatMap((node) => node.getToks()))
            .concat(this.end.getToks());
    }
    getChildren() {
        return [this.funcName, ...this.args.filter((node) => !(node instanceof Sentinel))];
    }
}

export class Condition extends EasySqlNode {
    constructor(public start: Sentinel, public funcCall: FuncCall, public end: Sentinel) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [this.funcCall];
    }
    getToks(): Tok[] {
        return this.start.getToks().concat(this.funcCall.getToks()).concat(this.end.getToks());
    }
}

export class Target extends EasySqlNode {
    constructor(public start: Sentinel, public separator: Sentinel, public condition: Condition | null, public end: Sentinel) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
    targetName() {
        return 'unknown';
    }
}

export class Check extends Target {
    constructor(
        public start: Sentinel,
        public separator: Sentinel,
        public content: Name | FuncCall,
        public conditionSeparator: Sentinel,
        public condition: Condition | null,
        public end: Sentinel
    ) {
        super(start, separator, condition, end);
    }
    getChildren(): EasySqlNode[] {
        return this.condition ? [this.content, this.condition] : [this.content];
    }
    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.content.getToks())
            .concat(this.conditionSeparator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
    targetName() {
        return 'check';
    }
}

export class Func extends Target {
    constructor(
        public start: Sentinel,
        public separator: Sentinel,
        public content: FuncCall,
        public conditionSeparator: Sentinel,
        public condition: Condition | null,
        public end: Sentinel
    ) {
        super(start, separator, condition, end);
    }
    getChildren(): EasySqlNode[] {
        return this.condition ? [this.content, this.condition] : [this.content];
    }
    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.content.getToks())
            .concat(this.conditionSeparator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
    targetName() {
        return 'function';
    }
}

export class Variables extends Target {
    constructor(public start: Sentinel, public separator: Sentinel, public condition: Condition | null, public end: Sentinel) {
        super(start, separator, condition, end);
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
    targetName() {
        return 'variables';
    }
}

export class ListVariables extends Variables {
    constructor(public start: Sentinel, public separator: Sentinel, public condition: Condition | null, public end: Sentinel) {
        super(start, separator, condition, end);
    }
    targetName() {
        return 'list_variables';
    }
}

export class SimpleNamedTarget extends Target {
    constructor(
        public start: Sentinel,
        public separator: Sentinel,
        public name: Name,
        public conditionSeparator: Sentinel,
        public condition: Condition | null,
        public end: Sentinel
    ) {
        super(start, separator, condition, end);
    }

    getChildren(): EasySqlNode[] {
        return this.condition ? [this.condition] : [];
    }

    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.name.getToks())
            .concat(this.conditionSeparator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
}

export class Template extends SimpleNamedTarget {
    targetName() {
        return 'template';
    }
}

export class Log extends SimpleNamedTarget {
    targetName() {
        return 'log';
    }
}

export class Action extends SimpleNamedTarget {
    targetName() {
        return 'action';
    }
}

export class Temp extends SimpleNamedTarget {
    targetName() {
        return 'temp';
    }
}

export class Cache extends SimpleNamedTarget {
    targetName() {
        return 'cache';
    }
}

export class Broadcast extends SimpleNamedTarget {
    targetName() {
        return 'broadcast';
    }
}

export class Table extends EasySqlNode {
    constructor(public db: Name, public separator: Sentinel, public table: Name) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return this.db.getToks().concat(this.separator.getToks()).concat(this.table.getToks());
    }
}

export class FullTable extends EasySqlNode {
    constructor(public db: Name, public dbSeparator: Sentinel, public schema: Name, public separator: Sentinel, public table: Name) {
        super();
    }
    getChildren(): EasySqlNode[] {
        return [];
    }
    getToks(): Tok[] {
        return this.db
            .getToks()
            .concat(this.dbSeparator.getToks())
            .concat(this.schema.getToks())
            .concat(this.separator.getToks())
            .concat(this.table.getToks());
    }
}

export class Output extends Target {
    constructor(
        public start: Sentinel,
        public separator: Sentinel,
        public table: Table | FullTable,
        public conditionSeparator: Sentinel,
        public condition: Condition | null,
        public end: Sentinel
    ) {
        super(start, separator, condition, end);
    }
    getToks(): Tok[] {
        return this.start
            .getToks()
            .concat(this.separator.getToks())
            .concat(this.table.getToks())
            .concat(this.conditionSeparator.getToks())
            .concat(this.condition?.getToks() || [])
            .concat(this.end.getToks());
    }
    targetName() {
        return 'output';
    }
}
