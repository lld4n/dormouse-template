/**
 * Bumps `version` in package.json (semver major/minor/patch) and records
 * it as its own `chore(release): vX.Y.Z` commit — nothing else gets in,
 * even if other changes are staged (`git commit --only package.json`).
 *
 * Exists for the release flow enforced by `.githooks/pre-push`: every
 * push to the template's default branch must raise the version, so repos
 * generated from the template can tell which template revision they are
 * synced to just by reading package.json. The hook can't fold a new
 * commit into a push that is already underway (pre-push runs after the
 * pushed refs are fixed), so it creates this commit and asks the pusher
 * to run `git push` again.
 *
 * Usage: bun scripts/bump-version.ts <major|minor|patch>
 */

const KINDS = ['major', 'minor', 'patch'] as const;
type Kind = (typeof KINDS)[number];

function isKind(value: string | undefined): value is Kind {
    return KINDS.includes(value as Kind);
}

const kind = process.argv[2];
if (!isKind(kind)) {
    console.error(`Usage: bun scripts/bump-version.ts <${KINDS.join('|')}>`);
    process.exit(1);
}

const pkg = await Bun.file('package.json').json();
const current = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!current) {
    console.error(`package.json version ${JSON.stringify(pkg.version)} is not plain semver`);
    process.exit(1);
}

const [major, minor, patch] = current.slice(1).map(Number);
const next =
    kind === 'major'
        ? `${major! + 1}.0.0`
        : kind === 'minor'
          ? `${major}.${minor! + 1}.0`
          : `${major}.${minor}.${patch! + 1}`;

pkg.version = next;
await Bun.write('package.json', `${JSON.stringify(pkg, null, 4)}\n`);

const commit = Bun.spawnSync(
    ['git', 'commit', '--only', 'package.json', '-m', `chore(release): v${next}`],
    { stdout: 'inherit', stderr: 'inherit' },
);
if (!commit.success) {
    process.exit(commit.exitCode ?? 1);
}

console.log(`version: ${current[0]} -> ${next}`);
