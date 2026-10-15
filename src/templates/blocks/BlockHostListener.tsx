import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import {
    codeWrap,
    hasJsdocParams,
    linkTypeHtml,
    modifKind,
    modifSlug,
    parseDescription,
    returnsHtml,
    t
} from '../helpers';
import { DefinedInRow } from './DefinedInRow';
import { JsdocExamplesBlock } from './JsdocExamplesBlock';
import { MemberCard } from './MemberCard';
import { ParamsTable } from './ParamsTable';

type BlockHostListenerProps = {
    readonly methods: any[];
    readonly file: string;
    readonly title?: string;
    readonly depth: number;
    readonly navTabs?: any[];
};

export const BlockHostListener = (props: BlockHostListenerProps): string => {
    const custom = renderCustomTemplate('block-host-listener', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section data-compodoc="block-host-listener">
            <h3 id={props.title ? props.title.toLowerCase() : 'methods'}>
                {props.title ?? t('methods')}
            </h3>
            {props.methods.map(m => {
                const header = (
                    <header class="cdx-member-header">
                        <span class="cdx-member-name">
                            {(m.modifierKind ?? []).map((k: number) => (
                                <span
                                    class={`cdx-member-modifier cdx-member-modifier--${modifSlug(k)}`}
                                >
                                    {modifKind(k)}
                                </span>
                            ))}
                            {m.optional && <span class="cdx-member-modifier">{t('optional')}</span>}
                            <span
                                class={`cdx-member-name-text${m.deprecated ? ' cdx-member-name--deprecated' : ''}`}
                            >
                                {m.name}
                            </span>
                            <a
                                href={`#${m.name}`}
                                class="cdx-member-permalink"
                                aria-label={`Link to ${m.name}`}
                            >
                                #
                            </a>
                        </span>
                        <span class="cdx-member-type">
                            {m.returnType && linkTypeHtml(m.returnType, { depth: props.depth })}
                        </span>
                    </header>
                ) as string;

                const body = (
                    <>
                        {m.deprecated && (
                            <div class="cdx-member-deprecated">
                                {m.deprecationMessage || t('deprecated')}
                            </div>
                        )}
                        {m.argsDecorator && (
                            <div class="cdx-member-row">
                                <i>{t('arguments')} : </i>
                                {codeWrap(m.argsDecorator.map((a: string) => `'${a}' `).join(''))}
                            </div>
                        )}
                        {m.decorators && (
                            <div class="cdx-member-row">
                                <b>{t('decorators')} : </b>
                                {codeWrap(
                                    m.decorators
                                        .map((d: any) =>
                                            d.stringifiedArguments
                                                ? `@${d.name}(${d.stringifiedArguments})`
                                                : `@${d.name}()`
                                        )
                                        .join(', ')
                                )}
                            </div>
                        )}
                        {DefinedInRow({
                            line: m.line,
                            file: props.file,
                            inheritance: m.inheritance,
                            navTabs: props.navTabs,
                            depth: props.depth
                        })}
                        {m.typeParameters?.length > 0 && (
                            <div class="cdx-member-row">
                                <b>{t('type-parameters')} :</b>
                                <ul class="type-parameters">
                                    {m.typeParameters.map((tp: string) => (
                                        <li>{tp}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {m.description && (
                            <div class="cdx-member-description">
                                {parseDescription(m.description, props.depth)}
                            </div>
                        )}
                        {m.jsdoctags && hasJsdocParams(m.jsdoctags) && (
                            <>
                                <div class="cdx-member-description">
                                    {ParamsTable({
                                        jsdocTags: m.jsdoctags,
                                        depth: props.depth,
                                        showOptional: true,
                                        showDefaultValue: true
                                    })}
                                </div>
                                {JsdocExamplesBlock({ tags: m.jsdoctags, variant: 'code' })}
                            </>
                        )}
                        {m.returnType && (
                            <div class="cdx-member-returns">
                                <b>{t('returns')} : </b>
                                {linkTypeHtml(m.returnType, { depth: props.depth })}
                            </div>
                        )}
                        {m.returnType && m.jsdoctags && (
                            <div class="cdx-member-description">
                                {returnsHtml(m.jsdoctags, props.depth)}
                            </div>
                        )}
                    </>
                ) as string;

                return MemberCard({
                    id: m.name,
                    deprecated: m.deprecated,
                    header,
                    children: body
                });
            })}
        </section>
    ) as string;
};
