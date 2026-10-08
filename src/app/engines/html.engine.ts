import * as path from 'node:path';
import { CoverageBadge } from '../../templates/components/CoverageBadge';
import { Menu } from '../../templates/components/Menu';
import { Layout } from '../../templates/Layout';
import { AdditionalPage } from '../../templates/pages/AdditionalPage';
import { ApiReferencePage } from '../../templates/pages/ApiReferencePage';
import { AppConfigPage } from '../../templates/pages/AppConfigPage';
import { BucketLandingPage } from '../../templates/pages/BucketLandingPage';
import { ClassPage } from '../../templates/pages/ClassPage';
import { ClusterPage } from '../../templates/pages/ClusterPage';
import { ComponentPage } from '../../templates/pages/ComponentPage';
import { CoverageReport } from '../../templates/pages/CoverageReport';
import { DirectivePage } from '../../templates/pages/DirectivePage';
import { EntityDetailPage } from '../../templates/pages/EntityDetailPage';
import { GuardPage } from '../../templates/pages/GuardPage';
import { InjectablePage } from '../../templates/pages/InjectablePage';
import { InterceptorPage } from '../../templates/pages/InterceptorPage';
import { InterfacePage } from '../../templates/pages/InterfacePage';
import { Markdown } from '../../templates/pages/Markdown';
import {
    MiscEnumerationPage,
    MiscFunctionPage,
    MiscTypealiasPage,
    MiscVariablePage,
    renderProviderPage
} from '../../templates/pages/MiscDetailPage';
import { Overview } from '../../templates/pages/Overview';
import { PackageDependencies } from '../../templates/pages/PackageDependencies';
import { PackageProperties } from '../../templates/pages/PackageProperties';
import { PipePage } from '../../templates/pages/PipePage';
import { ResolverPage } from '../../templates/pages/ResolverPage';
import { Routes } from '../../templates/pages/Routes';
import { TokenPage } from '../../templates/pages/TokenPage';
import { UnitTestReport } from '../../templates/pages/UnitTestReport';
import { UtilitiesPage } from '../../templates/pages/UtilitiesPage';
import { logger } from '../../utils/logger';
import { loadCustomTemplates, renderCustomTemplate } from './custom-template.engine';
import DependenciesEngine from './dependencies.engine';
import FileEngine from './file.engine';

/** Map page context to its custom template file name */
const CONTEXT_TEMPLATE_MAP: Record<string, string> = {
    'getting-started': 'markdown',
    readme: 'markdown',
    changelog: 'markdown',
    contributing: 'markdown',
    license: 'markdown',
    overview: 'overview',
    component: 'component',
    entity: 'entity',
    directive: 'directive',
    injectable: 'injectable',
    token: 'token',
    'di-cluster': 'di-cluster',
    interceptor: 'interceptor',
    guard: 'guard',
    resolver: 'resolver',
    pipe: 'pipe',
    class: 'class',
    interface: 'interface',
    routes: 'routes',
    'package-dependencies': 'package-dependencies',
    'package-properties': 'package-properties',
    utilities: 'utilities',
    function: 'function',
    variable: 'variable',
    typealias: 'typealias',
    enumeration: 'enumeration',
    coverage: 'coverage-report',
    'unit-test': 'unit-test-report',
    'additional-page': 'additional-page',
    'bucket-landing': 'bucket-landing',
    'api-reference': 'api-reference'
};

export class HtmlEngine {
    private static instance: HtmlEngine;
    private constructor() {}
    public static getInstance() {
        if (!HtmlEngine.instance) {
            HtmlEngine.instance = new HtmlEngine();
        }
        return HtmlEngine.instance;
    }

    public init(templatePath: string): Promise<void> {
        loadCustomTemplates(templatePath);
        return Promise.resolve();
    }

    /** TSX-rendered content for specific contexts */
    private renderTsxContent(data: any): string {
        // Check for custom JS template override first
        const templateName = CONTEXT_TEMPLATE_MAP[data.context];
        if (templateName) {
            const custom = renderCustomTemplate(templateName, data);
            if (custom !== null) {
                return custom;
            }
        }

        switch (data.context) {
            case 'getting-started':
            case 'readme':
            case 'changelog':
            case 'contributing':
            case 'license':
                return Markdown({ markdown: data.markdown, aiGenerated: data.aiGenerated });
            case 'additional-page':
                return AdditionalPage({
                    additionalPage: data.additionalPage,
                    aiGenerated: data.aiGenerated
                });
            case 'package-dependencies':
                return data.disableDependencies ? '' : PackageDependencies(data);
            case 'package-properties':
                return data.disableProperties ? '' : PackageProperties(data);
            case 'overview':
                return Overview(data);
            case 'routes':
                return Routes(data);
            case 'coverage':
                return CoverageReport(data);
            case 'unit-test':
                return UnitTestReport(data);
            case 'class':
                return ClassPage(data);
            case 'directive':
                data.relationships = DependenciesEngine.getRelationships(data.directive?.name);
                return DirectivePage(data);
            case 'entity':
                return EntityDetailPage(data);
            case 'guard':
                return GuardPage(data);
            case 'injectable':
                data.relationships = DependenciesEngine.getRelationships(data.injectable?.name);
                return InjectablePage(data);
            case 'token':
                return TokenPage(data);
            case 'di-cluster':
                return ClusterPage(data);
            case 'provider':
                return renderProviderPage(data.provider, data.depth);
            case 'interceptor':
                return InterceptorPage(data);
            case 'interface':
                return InterfacePage(data);
            case 'pipe':
                data.relationships = DependenciesEngine.getRelationships(data.pipe?.name);
                return PipePage(data);
            case 'resolver':
                return ResolverPage(data);
            case 'utilities':
                return UtilitiesPage(data);
            case 'function':
                return MiscFunctionPage(data);
            case 'variable':
                return MiscVariablePage(data);
            case 'typealias':
                return MiscTypealiasPage(data);
            case 'enumeration':
                return MiscEnumerationPage(data);
            case 'component':
                data.relationships = DependenciesEngine.getRelationships(data.component?.name);
                return ComponentPage(data);
            case 'app-config':
                return AppConfigPage(data);
            case 'bucket-landing':
                return BucketLandingPage(data);
            case 'api-reference':
                return ApiReferencePage(data);
            default:
                return '';
        }
    }

    public render(mainData: any, page: any): string {
        const data = { ...mainData, ...page };
        const content = this.renderTsxContent(data);

        // Check for custom menu override
        const customMenu = renderCustomTemplate('menu', data);
        const menuHtml = customMenu ?? Menu({ data });

        return Layout({
            data,
            content,
            menuHtml
        });
    }

    public generateCoverageBadge(outputFolder: string, label: string, coverageData: any) {
        coverageData.label = label;
        const result = CoverageBadge(coverageData);

        const testOutputDir = outputFolder.match(process.cwd());
        if (testOutputDir && testOutputDir.length > 0) {
            outputFolder = outputFolder.replace(process.cwd() + path.sep, '');
        }

        return FileEngine.write(
            `${outputFolder + path.sep}/images/coverage-badge-${label}.svg`,
            result
        ).catch(err => {
            logger.error(`Error during coverage badge ${label} file generation `, err);
            return Promise.reject(err);
        });
    }
}

export default HtmlEngine.getInstance();
