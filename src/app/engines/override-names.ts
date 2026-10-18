/** Override names that were renamed; a file with the old name is ignored with a rename hint. */
export const RENAMED_OVERRIDES: Readonly<Record<string, string>> = {
    'miscellaneous-functions': 'utilities',
    'miscellaneous-variables': 'utilities',
    'miscellaneous-typealiases': 'utilities',
    'miscellaneous-enumerations': 'utilities',
    'miscellaneous-function': 'function',
    'miscellaneous-variable': 'variable',
    'miscellaneous-typealias': 'typealias',
    'miscellaneous-enumeration': 'enumeration'
};

/** Override names whose page no longer exists; a file with such a name is ignored. */
export const REMOVED_OVERRIDES: readonly string[] = ['bucket-landing', 'module', 'modules'];
