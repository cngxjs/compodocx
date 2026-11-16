import type { LanguageRegistration } from 'shiki';

/**
 * Angular grammars Shiki does not ship, injected into `angular-html` and
 * `angular-ts`. Copied from the Angular Language Service
 * (angular/vscode-ng-language-service, `syntaxes/`, MIT licence); only
 * `name`, `injectTo` and `embeddedLangs` are added for Shiki. Drop
 * each once Shiki ships it.
 */

/**
 * `template-tag.json`: property, event, two-way and template bindings in
 * tags, their values highlighted as Angular expressions (else plain strings).
 */
const TEMPLATE_TAG: LanguageRegistration = {
    scopeName: 'template.tag.ng',
    injectionSelector: 'L:text.html#meta.tag -comment -string',
    patterns: [
        {
            include: '#inlineComments'
        },
        {
            include: '#leadingSpace'
        },
        {
            include: '#twoWayBinding'
        },
        {
            include: '#propertyBinding'
        },
        {
            include: '#eventBinding'
        },
        {
            include: '#templateBinding'
        }
    ],
    repository: {
        leadingSpace: {
            match: '^\\s+',
            name: 'template.tag.leading-space'
        },
        propertyBinding: {
            begin: '(\\[\\s*@?(?:[-_a-zA-Z0-9.$]+|\\[[^\\[\\]]*]|\\([^()]*\\))*%?\\s*])(=)(["\'])',
            beginCaptures: {
                '1': {
                    name: 'entity.other.attribute-name.html entity.other.ng-binding-name.property.html',
                    patterns: [
                        {
                            include: '#bindingKey'
                        }
                    ]
                },
                '2': {
                    name: 'punctuation.separator.key-value.html'
                },
                '3': {
                    name: 'string.quoted.html punctuation.definition.string.begin.html'
                }
            },
            end: '\\3',
            endCaptures: {
                '0': {
                    name: 'string.quoted.html punctuation.definition.string.end.html'
                }
            },
            name: 'meta.ng-binding.property.html',
            contentName: 'expression.ng',
            patterns: [
                {
                    include: 'expression.ng'
                }
            ]
        },
        eventBinding: {
            begin: '(\\(\\s*@?[-_a-zA-Z0-9.$]*\\s*\\))(=)(["\'])',
            beginCaptures: {
                '1': {
                    name: 'entity.other.attribute-name.html entity.other.ng-binding-name.event.html',
                    patterns: [
                        {
                            include: '#bindingKey'
                        }
                    ]
                },
                '2': {
                    name: 'punctuation.separator.key-value.html'
                },
                '3': {
                    name: 'string.quoted.html punctuation.definition.string.begin.html'
                }
            },
            end: '\\3',
            endCaptures: {
                '0': {
                    name: 'string.quoted.html punctuation.definition.string.end.html'
                }
            },
            name: 'meta.ng-binding.event.html',
            contentName: 'expression.ng',
            patterns: [
                {
                    include: 'expression.ng'
                }
            ]
        },
        twoWayBinding: {
            begin: '(\\[\\s*\\(\\s*@?[-_a-zA-Z0-9.$]*\\s*\\)\\s*\\])(=)(["\'])',
            beginCaptures: {
                '1': {
                    name: 'entity.other.attribute-name.html entity.other.ng-binding-name.two-way.html',
                    patterns: [
                        {
                            include: '#bindingKey'
                        }
                    ]
                },
                '2': {
                    name: 'punctuation.separator.key-value.html'
                },
                '3': {
                    name: 'string.quoted.html punctuation.definition.string.begin.html'
                }
            },
            end: '\\3',
            endCaptures: {
                '0': {
                    name: 'string.quoted.html punctuation.definition.string.end.html'
                }
            },
            name: 'meta.ng-binding.two-way.html',
            contentName: 'expression.ng',
            patterns: [
                {
                    include: 'expression.ng'
                }
            ]
        },
        templateBinding: {
            begin: '(\\*[-_a-zA-Z0-9.$]*)(=)(["\'])',
            beginCaptures: {
                '1': {
                    name: 'entity.other.attribute-name.html entity.other.ng-binding-name.template.html',
                    patterns: [
                        {
                            include: '#bindingKey'
                        }
                    ]
                },
                '2': {
                    name: 'punctuation.separator.key-value.html'
                },
                '3': {
                    name: 'string.quoted.html punctuation.definition.string.begin.html'
                }
            },
            end: '\\3',
            endCaptures: {
                '0': {
                    name: 'string.quoted.html punctuation.definition.string.end.html'
                }
            },
            name: 'meta.ng-binding.template.html',
            contentName: 'expression.ng',
            patterns: [
                {
                    include: 'expression.ng'
                }
            ]
        },
        bindingKey: {
            patterns: [
                {
                    match: '([\\[\\(]{1,2}|\\*)(?:\\s*)(@?(?:[-_a-zA-Z0-9.$]+|\\[[^\\[\\]]*]|\\([^()]*\\))*%?)(?:\\s*)([\\]\\)]{1,2})?',
                    captures: {
                        '1': {
                            name: 'punctuation.definition.ng-binding-name.begin.html'
                        },
                        '2': {
                            name: 'entity.other.ng-binding-name.$2.html',
                            patterns: [
                                {
                                    match: '\\.',
                                    name: 'punctuation.accessor.html'
                                }
                            ]
                        },
                        '3': {
                            name: 'punctuation.definition.ng-binding-name.end.html'
                        }
                    }
                }
            ]
        },
        inlineComments: {
            patterns: [
                {
                    begin: '\\/\\*',
                    captures: {
                        '0': {
                            name: 'punctuation.definition.comment.ts'
                        }
                    },
                    name: 'comment.block.ts',
                    end: '\\*\\/'
                },
                {
                    begin: '\\/\\/',
                    beginCaptures: {
                        '0': {
                            name: 'punctuation.definition.comment.ts'
                        }
                    },
                    name: 'comment.line.double-slash.ts',
                    end: '(?=$)'
                }
            ]
        }
    },
    name: 'angular-template-tag',
    injectTo: ['text.html.derivative', 'text.html.derivative.ng', 'source.ts.ng'],
    embeddedLangs: ['angular-expression']
};

/**
 * `host-object-literal.json`: `host: { ... }` in a decorator, binding
 * keys as attribute names and dynamic values as Angular expressions.
 */
const HOST_OBJECT_LITERAL: LanguageRegistration = {
    scopeName: 'host-object-literal.ng',
    injectionSelector: 'L:meta.decorator.ts -comment -text.html -expression.ng',
    patterns: [
        {
            include: '#hostObjectLiteral'
        }
    ],
    repository: {
        hostObjectLiteral: {
            begin: '(host)\\s*(:)\\s*{',
            beginCaptures: {
                '1': {
                    name: 'meta.object-literal.key.ts'
                },
                '2': {
                    name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'
                }
            },
            contentName: 'hostbindings.ng',
            end: '}',
            patterns: [
                {
                    include: '#ngHostBindingDynamic'
                },
                {
                    include: '#ngHostBindingStatic'
                },
                {
                    include: 'source.ts'
                }
            ]
        },
        ngHostBindingDynamic: {
            begin: '\\s*(\'|")([\\[(].*?[\\])])(\\1)(:)',
            beginCaptures: {
                '1': {
                    name: 'string'
                },
                '2': {
                    name: 'entity.other.attribute-name.html'
                },
                '3': {
                    name: 'string'
                },
                '4': {
                    name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'
                }
            },
            contentName: 'hostbinding.dynamic.ng',
            patterns: [
                {
                    include: '#ngHostBindingDynamicValue'
                }
            ],
            end: '(?=,|})'
        },
        ngHostBindingDynamicValue: {
            begin: '\\s*(`|\'|")',
            beginCaptures: {
                '1': {
                    name: 'string'
                }
            },
            patterns: [
                {
                    include: 'expression.ng'
                }
            ],
            end: '\\1',
            endCaptures: {
                '0': {
                    name: 'string'
                }
            }
        },
        ngHostBindingStatic: {
            begin: '\\s*(\'|")?(.*?)(\\1)?\\s*:',
            end: '(?=,|})',
            beginCaptures: {
                '1': {
                    name: 'string'
                },
                '2': {
                    name: 'entity.other.attribute-name.html'
                },
                '3': {
                    name: 'string'
                },
                '4': {
                    name: 'meta.object-literal.key.ts punctuation.separator.key-value.ts'
                }
            },
            contentName: 'hostbinding.static.ng',
            patterns: [
                {
                    include: 'source.ts'
                }
            ]
        }
    },
    name: 'angular-host-object-literal',
    injectTo: ['source.ts.ng'],
    embeddedLangs: ['angular-expression', 'typescript']
};

export const ANGULAR_EXTRA_GRAMMARS: readonly LanguageRegistration[] = [
    TEMPLATE_TAG,
    HOST_OBJECT_LITERAL
];
