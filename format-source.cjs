// Development utility: print TypeScript sources with consistent readable formatting.
const fs = require('node:fs');
const ts = require('typescript');
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
for (const dir of ['src', 'tests']) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.ts'))) {
    const path = `${dir}/${file}`;
    const parsed = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    fs.writeFileSync(path, printer.printFile(parsed));
  }
}
