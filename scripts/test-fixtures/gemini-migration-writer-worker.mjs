import path from 'node:path';

const options = JSON.parse(process.argv[2] ?? 'null');
if (!options) throw new Error('Writer worker options are required.');
const module = await import(options.moduleUrl);
const writer = module[options.exportName];
if (typeof writer !== 'function') {
  throw new Error(`Missing writer export ${options.exportName}`);
}

const artifactPaths = {
  json: path.join(options.outputRoot, 'nested', `${options.id}.json`),
  markdown: path.join(options.outputRoot, 'nested', `${options.id}.md`),
  latestJson: path.join(options.outputRoot, 'nested', `latest-${options.id}.json`),
  latestMarkdown: path.join(options.outputRoot, 'nested', `latest-${options.id}.md`),
};
const payload = { id: options.id, prompt: 'private local-only fixture' };
const markdown = `# ${options.id}\n\nprivate local-only fixture\n`;

if (options.kind === 'rebuild') {
  await writer({
    jsonPath: artifactPaths.latestJson,
    markdownPath: artifactPaths.latestMarkdown,
    payload,
    markdown,
  });
} else {
  await writer({ artifactPaths, payload, markdown });
}

process.stdout.write(`${JSON.stringify(artifactPaths)}\n`);
