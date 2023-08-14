import { expect } from 'chai';
import { Position } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TempTableDefinition } from './definition';
import { Parser } from './shared/easysql';
import { logger } from './shared/logger';

logger.setLevel('DEBUG');

describe('definition', () => {
    function newTempTableDefinition(line: string, textLeft: string) {
        return new TempTableDefinition(
            null as any,
            null as any,
            line,
            Position.create(0, textLeft.length),
            null as any,
            new Parser(),
            null as any,
            null as any
        );
    }

    describe('TempTableDefinition', () => {
        it('should find table name from target definition', () => {
            let d = newTempTableDefinition('-- target=check.abc, if=f(a.b, c.d)', '-- target=check.abc, if=f(');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('a');

            d = newTempTableDefinition('-- target=check.abc, if=f(a.b, c.d)', '-- target=check.');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('-- target=check.abc, if=f(a.b, c.d)', '-- target=check.abc, if=f(a.');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('-- target=check.abc, if=f(a.b, c.d)', '-- target=check.abc, if=f(a.b, c');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('c');

            d = newTempTableDefinition('-- target=check.abc, if=f(ab.b, c.d)', '-- target=check.abc, if=f(a');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('ab');
        });

        it('should find table table from sql', () => {
            let d = newTempTableDefinition('from table_a a', 'from ');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('table_a');

            d = newTempTableDefinition('from table_a a', 'from table_a');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('table_a');

            d = newTempTableDefinition('from  ', 'from ');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('from "table_a" a', 'from "table_a');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('from -- table_a" a', 'from -- ta');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('JOIN table_a a', 'JOIN ');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('table_a');

            d = newTempTableDefinition('join table_a a', 'join table_a');
            expect(d.accept()).to.eq(true);
            expect(d.tempTableName).to.eq('table_a');

            d = newTempTableDefinition('join  ', 'join ');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('join "table_a" a', 'join "table_a');
            expect(d.accept()).to.eq(false);

            d = newTempTableDefinition('join -- table_a" a', 'join -- ta');
            expect(d.accept()).to.eq(false);
        });
    });
});
