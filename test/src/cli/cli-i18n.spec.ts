import { hasStderrError, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();

describe('CLI i18n', () => {
    const distFolder = `${tmp.name}-i18n`;

    const checkWcMenuFile = (lang, message) => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--language',
                lang,
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        // The sentence is in the menu footer, shared by every page in `js/menu.js`.
        it('it should contain a sentence in the correct language', () => {
            const file = menuOf(distFolder);
            expect(file).to.contain(message);
        });
    };

    describe('with supported language - en-US', () => {
        return checkWcMenuFile('en-US', 'Documentation generated using');
    });

    describe('with supported language - es-ES', () => {
        return checkWcMenuFile('es-ES', 'Documentación generada utilizando');
    });

    describe('with supported language - fr-FR', () => {
        return checkWcMenuFile('fr-FR', 'Documentation générée avec');
    });

    describe('with supported language - hu-HU', () => {
        return checkWcMenuFile('hu-HU', 'A dokumentációt generálta:');
    });

    describe('with supported language - it-IT', () => {
        return checkWcMenuFile('it-IT', 'Documentazione generata usando');
    });

    describe('with supported language - ja-JP', () => {
        return checkWcMenuFile('ja-JP', 'このドキュメントは以下を使用して生成されています');
    });

    describe('with supported language - ka-GE', () => {
        return checkWcMenuFile('ka-GE', 'დოკუმენტაცია დაგენერირდა გამოყენებით');
    });

    describe('with supported language - nl-NL', () => {
        return checkWcMenuFile('nl-NL', 'Documentatie gegenereed met');
    });

    describe('with supported language - pt-BR', () => {
        return checkWcMenuFile('pt-BR', 'Documentação gerada usando');
    });

    describe('with supported language - ru-RU', () => {
        return checkWcMenuFile('ru-RU', 'Документация создана с помощью');
    });

    describe('with supported language - sk-SK', () => {
        return checkWcMenuFile('sk-SK', 'Dokumentácia vytvorená pomocou');
    });

    describe('with supported language - zh-CN', () => {
        return checkWcMenuFile('zh-CN', '文档生成使用');
    });

    describe('with supported language - zh-TW', () => {
        return checkWcMenuFile('zh-TW', '產生文件使用');
    });

    describe('with un-supported language', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--language',
                'invalid-Lang',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should fall back to English', () => {
            const file = menuOf(distFolder);
            expect(file).to.contain('Documentation generated using');
        });
    });
});
