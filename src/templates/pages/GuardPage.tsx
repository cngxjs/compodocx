import { renderEntityPage } from './EntityPage';
import { isMiscShaped, renderFunctionalPage } from './MiscDetailPage';

export const GuardPage = (data: any): string =>
    isMiscShaped(data.injectable)
        ? renderFunctionalPage(data.injectable, data.depth)
        : renderEntityPage({
              entity: data.injectable,
              entityKey: 'guard',
              breadcrumbLabel: 'guards',
              depth: data.depth,
              navTabs: data.navTabs,
              disableFilePath: data.disableFilePath,
              showExtends: true,
              showIndex: true,
              showConstructor: true,
              showMethods: true,
              showProperties: true,
              showAccessors: true,
              contextLine: data.injectable?.functionalKind
                  ? `Functional ${data.injectable.functionalKind}`
                  : undefined,
              showJsdocBadges: true
          });
