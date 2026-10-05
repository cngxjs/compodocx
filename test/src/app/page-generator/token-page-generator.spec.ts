import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { TokenPageGenerator } from '../../../../src/app/page-generator/token-page-generator';
import { TokenPage } from '../../../../src/templates/pages/TokenPage';

const navTabsStub = { resolve: () => [] } as any;

describe('TokenPageGenerator', () => {
    let addPageSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        addPageSpy = vi.spyOn(Configuration, 'addPage').mockImplementation(() => undefined);
    });

    afterEach(() => {
        addPageSpy.mockRestore();
        Configuration.mainData.tokens = [];
        DependenciesEngine.tokens = [];
    });

    it('emits one page per token at path "tokens" with context "token"', async () => {
        const tokens = [
            { name: 'API_BASE_URL', id: 'token-api', file: 'src/tokens.ts' },
            { name: 'STORAGE_KEY', id: 'token-storage', file: 'src/tokens.ts' }
        ];
        await new TokenPageGenerator(navTabsStub).prepare(tokens as any);
        expect(addPageSpy).toHaveBeenCalledTimes(2);
        const pages = addPageSpy.mock.calls.map(([page]: any[]) => page);
        expect(pages.every(p => p.path === 'tokens')).toBe(true);
        expect(pages.every(p => p.context === 'token')).toBe(true);
        expect(pages.map(p => p.name).sort()).toEqual(['API_BASE_URL', 'STORAGE_KEY']);
    });

    it('emits nothing when the tokens list is empty', async () => {
        await new TokenPageGenerator(navTabsStub).prepare([]);
        expect(addPageSpy).not.toHaveBeenCalled();
    });

    it('threads `token` payload through the page envelope so the template reads it', async () => {
        const token = {
            name: 'API_BASE_URL',
            id: 'token-api',
            file: 'src/tokens.ts',
            tokenType: 'string',
            providedIn: 'root'
        };
        await new TokenPageGenerator(navTabsStub).prepare([token] as any);
        const page = addPageSpy.mock.calls[0][0] as any;
        expect(page.token).toBe(token);
        expect(page.token.tokenType).toBe('string');
        expect(page.token.providedIn).toBe('root');
    });

    it('renders HttpContextToken<T> for an HttpContextToken', () => {
        const html = TokenPage({
            token: {
                name: 'CACHE_ENABLED',
                file: 'src/tokens.ts',
                tokenClass: 'HttpContextToken',
                tokenType: 'boolean'
            },
            depth: 1
        });
        expect(html).toContain('HttpContextToken&lt;boolean>');
        expect(html).not.toContain('InjectionToken&lt;');
    });

    it('keeps InjectionToken<T> for an InjectionToken', () => {
        const html = TokenPage({
            token: {
                name: 'API_BASE_URL',
                file: 'src/tokens.ts',
                tokenClass: 'InjectionToken',
                tokenType: 'string',
                providedIn: 'root'
            },
            depth: 1
        });
        expect(html).toContain('InjectionToken&lt;string>');
        expect(html).toContain("<code>'root'</code>");
    });
});
