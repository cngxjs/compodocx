import Html from '@kitajs/html';
import { BlockProperty } from '../blocks/BlockProperty';
import { IndexMisc } from '../blocks/IndexMisc';
import { MiscHero } from '../blocks/MiscHero';
import { TaggedDetailLinks } from '../blocks/TaggedDetailLinks';
import { shortPath } from '../helpers';

type MiscVariablesProps = {
    readonly miscellaneous: {
        readonly variables: any[];
        readonly groupedVariables: Record<string, any[]>;
    };
    readonly depth?: number;
};

export const MiscellaneousVariables = (props: MiscVariablesProps): string =>
    (
        <>
            {MiscHero({ kind: 'variable', count: props.miscellaneous.variables.length })}
            {IndexMisc({ list: props.miscellaneous.variables, kind: 'variable' })}
            {Object.entries(props.miscellaneous.groupedVariables).map(([key, properties]) => (
                <div class="cdx-content-section">
                    <h3 class="cdx-section-heading" title={key}>
                        {shortPath(key)}
                    </h3>
                    {TaggedDetailLinks({
                        items: properties as any[],
                        kind: 'variable',
                        depth: props.depth
                    })}
                    {BlockProperty({ properties, title: '', file: '', depth: props.depth })}
                </div>
            ))}
        </>
    ) as string;
