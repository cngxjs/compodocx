import Html from '@kitajs/html';

/** `Label n · Label n` context line under the hero badges; zero counts are left out. */
export const HeroCounts = (counts: readonly (readonly [string, number])[]): string => {
    const shown = counts.filter(([, n]) => n > 0);
    return shown.length === 0
        ? ''
        : ((
              <p class="cdx-entity-hero-context">
                  {shown.map(([label, n]) => `${Html.escapeHtml(label)} ${n}`).join(' · ')}
              </p>
          ) as string);
};
