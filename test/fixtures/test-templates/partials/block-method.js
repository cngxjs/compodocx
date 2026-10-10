// Block-level override for the `block-method` template.
//
// Receives `{ methods, file, title, depth, navTabs }`. Returns a raw HTML
// string that replaces the entire built-in BlockMethod section.
//
// Compared to compodocx's default cdx-io-member layout this version is
// table-based and skips badges and source links — useful for printable
// docs or PDF export.

module.exports = function (data, helpers) {
    const { methods, file, title } = data;
    const t = helpers.t;
    const linkType = type => helpers.linkTypeHtml(type, { depth: data.depth });

    if (!methods || methods.length === 0) {
        return '';
    }

    const heading = title ?? t('methods');

    const rows = methods.map(m => {
        const params = (m.args ?? [])
            .map(a => `${a.name}: ${linkType(a.type ?? 'any')}`)
            .join(', ');
        const signature = `${m.name}(${params})${m.returnType ? `: ${linkType(m.returnType)}` : ''}`;
        const desc = m.description
            ? helpers.parseDescription(m.description, data.depth ?? 0)
            : '';
        const deprecated = m.deprecated
            ? `<span class="deprecated">${t('deprecated')}${
                m.deprecationMessage ? `: ${m.deprecationMessage}` : ''
            }</span>`
            : '';
        return `
            <tr>
                <td>${signature} ${deprecated}</td>
                <td>${desc}</td>
                <td><code>${file}:${m.line ?? '?'}</code></td>
            </tr>
        `;
    }).join('');

    return `
        <section class="custom-methods">
            <h3>${heading}</h3>
            <table>
                <thead>
                    <tr>
                        <th>${t('signature') ?? 'Signature'}</th>
                        <th>${t('description') ?? 'Description'}</th>
                        <th>${t('source') ?? 'Source'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </section>
    `;
};
