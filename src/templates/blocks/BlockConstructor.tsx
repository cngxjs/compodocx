import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import {
    codeWrap,
    functionSignature,
    hasJsdocParams,
    modifKind,
    modifSlug,
    parseDescription,
    t
} from '../helpers';
import { DefinedInRow } from './DefinedInRow';
import { JsdocExamplesBlock } from './JsdocExamplesBlock';
import { ParamsTable } from './ParamsTable';

type BlockConstructorProps = {
    readonly constructor: any;
    readonly file: string;
    readonly depth: number;
    readonly navTabs?: any[];
};

export const BlockConstructor = (props: BlockConstructorProps): string => {
    const custom = renderCustomTemplate('block-constructor', props);
    if (custom !== null) {
        return custom;
    }
    const ctor = props.constructor;
    return (
        <section data-compodoc="block-constructor">
            <h3 id="constructor">{t('constructor')}</h3>
            <article class="cdx-member-card">
                <div class="cdx-member-body cdx-member-body--flush">
                    {ctor.modifierKind && ctor.modifierKind.length > 0 && (
                        <div class="cdx-member-row">
                            {ctor.modifierKind.map((k: number) => (
                                <span
                                    class={`cdx-member-modifier cdx-member-modifier--${modifSlug(k)}`}
                                >
                                    {modifKind(k)}
                                </span>
                            ))}
                        </div>
                    )}
                    <div class="cdx-member-signature">
                        {codeWrap(functionSignature(ctor, props.depth))}
                    </div>
                    {DefinedInRow({
                        line: ctor.line,
                        file: props.file,
                        navTabs: props.navTabs,
                        depth: props.depth
                    })}
                    {ctor.description && (
                        <div class="cdx-member-description">
                            {parseDescription(ctor.description, props.depth)}
                        </div>
                    )}
                    {ctor.jsdoctags && hasJsdocParams(ctor.jsdoctags) && (
                        <div>
                            {ParamsTable({
                                jsdocTags: ctor.jsdoctags,
                                depth: props.depth,
                                showOptional: true
                            })}
                            {JsdocExamplesBlock({ tags: ctor.jsdoctags, variant: 'text' })}
                        </div>
                    )}
                </div>
            </article>
        </section>
    ) as string;
};
