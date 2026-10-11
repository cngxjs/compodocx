/**
 * Custom component detail template (JS override).
 * Replaces the built-in ComponentPage for the 'component' context.
 */
module.exports = function(data, helpers) {
    const c = data.component;
    let html = '';

    html += `<p class="comment"><h3>File</h3></p>`;
    html += `<p class="comment"><code>${c.file}</code></p>`;

    if (c.selector) {
        html += `<p class="comment"><h3>Selector</h3></p>`;
        html += `<p class="comment"><code>${c.selector}</code></p>`;
    }

    if (c.description) {
        html += `<p class="comment"><h3>Description</h3></p>`;
        html += `<p class="comment">${helpers.parseDescription(c.description, data.depth)}</p>`;
    }

    if (c.constructorObj) {
        html += `<section><h3 id="constructor">Constructor</h3>`;
        html += `<table class="table table-sm table-bordered"><tbody>`;
        html += `<tr><td class="col-md-4"><code>${helpers.functionSignature(c.constructorObj, data.depth)}</code></td></tr>`;
        if (c.constructorObj.jsdoctags) {
            const params = helpers.extractJsdocParams(c.constructorObj.jsdoctags);
            if (params.length > 0) {
                html += `<tr><td class="col-md-4"><div><b>Parameters :</b>`;
                html += `<table class="params"><thead><tr><td>Name</td>`;
                if (params.some(p => p.type)) html += `<td>Type</td>`;
                html += `<td>Optional</td>`;
                if (params.some(p => p.comment)) html += `<td>Description</td>`;
                html += `</tr></thead><tbody>`;
                for (const p of params) {
                    html += `<tr>`;
                    if (p.name) html += `<td><code>${p.name}</code></td>`;
                    if (params.some(t => t.type)) html += `<td>${p.type ? helpers.linkTypeHtml(p.type, { depth: data.depth }) : ''}</td>`;
                    html += `<td>${p.optional ? 'yes' : 'no'}</td>`;
                    if (params.some(t => t.comment)) html += `<td>${p.comment ? '<i>' + p.comment + '</i>' : ''}</td>`;
                    html += `</tr>`;
                }
                html += `</tbody></table></div></td></tr>`;
            }
        }
        html += `</tbody></table></section>`;
    }

    return html;
};
