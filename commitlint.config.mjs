/**
 * Commitlint config, enforced by `.githooks/commit-msg` on every local
 * commit. Plain conventional commits — `type(scope?): subject` — nothing
 * custom, so the rules are documented by the preset itself:
 * https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional
 */
export default {
    extends: ['@commitlint/config-conventional'],
};
