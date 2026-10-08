import Html from '@kitajs/html';
import { BlockTypealias } from '../blocks/BlockTypealias';
import { IndexMisc } from '../blocks/IndexMisc';
import { MiscHero } from '../blocks/MiscHero';
import { TaggedDetailLinks } from '../blocks/TaggedDetailLinks';
import { shortPath } from '../helpers';

type MiscTypealiasesProps = {
    readonly miscellaneous: {
        readonly typealiases: any[];
        readonly groupedTypeAliases: Record<string, any[]>;
    };
    readonly depth?: number;
};

export const MiscellaneousTypealiases = (props: MiscTypealiasesProps): string =>
    (
        <>
            {MiscHero({ kind: 'typealias', count: props.miscellaneous.typealiases.length })}
            {IndexMisc({ list: props.miscellaneous.typealiases, kind: 'typealias' })}
            {Object.entries(props.miscellaneous.groupedTypeAliases).map(([key, typealias]) => (
                <div class="cdx-content-section">
                    <h3 class="cdx-section-heading" title={key}>
                        {shortPath(key)}
                    </h3>
                    {TaggedDetailLinks({
                        items: typealias as any[],
                        kind: 'typealias',
                        depth: props.depth
                    })}
                    {BlockTypealias({ typealias, depth: props.depth })}
                </div>
            ))}
        </>
    ) as string;
