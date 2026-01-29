#!/usr/bin/env node

/**
 * Render graphviz diagrams from a skill's SKILL.md to SVG files.
 *
 * Usage:
 *   ./render-graphs.js <skill-directory>           # Render each diagram separately
 *   ./render-graphs.js <skill-directory> --combine # Combine all into one diagram
 *
 * Extracts all ```dot blocks from SKILL.md and renders to SVG.
 * Useful for helping your human partner visualize the process flows.
 *
 * Requires: graphviz (dot) installed on system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function extractDotBlocks(markdown) {
    const blocks = [];
    const regex = /```dot\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        const content = match[1].trim();

        // Extract digraph name or generate fallback
        const nameMatch = content.match(/(?:strict\s+)?(?:di)?graph\s+(\w+)/);
        let name = nameMatch ? nameMatch[1] : `graph_${blocks.length + 1}`;
        // Sanitize name
        name = name.replaceAll(/[^A-Za-z0-9_]/g, '_');

        blocks.push({ name, content });
    }

    return blocks;
}

function extractGraphBody(dotContent) {
    // Extract just the body (nodes and edges) from a digraph
    // Matches "digraph Name {" or "digraph {" or "graph Name {" etc.
    const match = dotContent.match(/(?:strict\s+)?(?:di)?graph(?:\s+\w+)?\s*\{([\s\S]*)\}/);
    if (!match) {
        return '';
    }

    let body = match[1];

    // Remove rankdir (we'll set it once at the top level)
    body = body.replace(/^\s*rankdir\s*=\s*\w+\s*;?\s*$/gm, '');

    return body.trim();
}

function combineGraphs(blocks, skillName) {
    const bodies = blocks.map((block, i) => {
        const body = extractGraphBody(block.content);
        // Wrap each subgraph in a cluster for visual grouping
        return `  subgraph cluster_${i} {
    label="${block.name}";
    ${body
        .split('\n')
        .map((line) => '  ' + line)
        .join('\n')}
  }`;
    });

    return `digraph ${skillName}_combined {
  rankdir=TB;
  compound=true;
  newrank=true;

${bodies.join('\n\n')}
}`;
}

function renderToSvg(dotContent) {
    try {
        return execSync('dot -Tsvg', {
            input: dotContent,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });
    } catch (err) {
        process.stderr.write(`Error running dot: ${err.message}\n`);
        if (err.stderr) {
            process.stderr.write(err.stderr.toString() + '\n');
        }
        return null;
    }
}

function main() {
    const args = process.argv.slice(2);
    const combine = args.includes('--combine');
    const skillDirArg = args.find((a) => !a.startsWith('--'));

    if (!skillDirArg) {
        process.stderr.write('Usage: render-graphs.js <skill-directory> [--combine]\n');
        process.stderr.write('\n');
        process.stderr.write('Options:\n');
        process.stderr.write('  --combine    Combine all diagrams into one SVG\n');
        process.stderr.write('\n');
        process.stderr.write('Example:\n');
        process.stderr.write('  ./render-graphs.js ../subagent-driven-development\n');
        process.stderr.write('  ./render-graphs.js ../subagent-driven-development --combine\n');
        process.exit(1);
    }

    const skillDir = path.resolve(skillDirArg);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const skillName = path.basename(skillDir).replace(/-/g, '_');

    if (!fs.existsSync(skillFile)) {
        process.stderr.write(`Error: ${skillFile} not found\n`);
        process.exit(1);
    }

    // Check if dot is available
    try {
        execSync('which dot', { encoding: 'utf-8' });
    } catch {
        process.stderr.write('Error: graphviz (dot) not found. Install with:\n');
        process.stderr.write('  brew install graphviz    # macOS\n');
        process.stderr.write('  apt install graphviz     # Linux\n');
        process.exit(1);
    }

    const markdown = fs.readFileSync(skillFile, 'utf-8');
    const blocks = extractDotBlocks(markdown);

    if (blocks.length === 0) {
        process.stdout.write(`No \`\`\`dot blocks found in ${skillFile}\n`);
        process.exit(0);
    }

    process.stdout.write(`Found ${blocks.length} diagram(s) in ${path.basename(skillDir)}/SKILL.md\n`);

    const outputDir = path.join(skillDir, 'diagrams');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    if (combine) {
        // Combine all graphs into one
        let failure = false;
        try {
            const combined = combineGraphs(blocks, skillName);
            const svg = renderToSvg(combined);
            if (svg) {
                const outputPath = path.join(outputDir, `${skillName}_combined.svg`);
                fs.writeFileSync(outputPath, svg);
                process.stdout.write(`  Rendered: ${skillName}_combined.svg\n`);

                // Also write the dot source for debugging
                const dotPath = path.join(outputDir, `${skillName}_combined.dot`);
                fs.writeFileSync(dotPath, combined);
                process.stdout.write(`  Source: ${skillName}_combined.dot\n`);
            } else {
                process.stderr.write('  Failed to render combined diagram\n');
                failure = true;
            }
        } catch (error) {
            process.stderr.write(`  Error processing combined graph: ${error.message}\n`);
            failure = true;
        }

        if (failure) {
            process.exit(1);
        }
    } else {
        // Render each separately
        let failure = false;
        for (const block of blocks) {
            try {
                const svg = renderToSvg(block.content);
                if (svg) {
                    const outputPath = path.join(outputDir, `${block.name}.svg`);
                    fs.writeFileSync(outputPath, svg);
                    process.stdout.write(`  Rendered: ${block.name}.svg\n`);
                } else {
                    process.stderr.write(`  Failed: ${block.name}\n`);
                    failure = true;
                }
            } catch (error) {
                process.stderr.write(`  Error processing ${block.name}: ${error.message}\n`);
                failure = true;
            }
        }

        if (failure) {
            process.exit(1);
        }
    }

    process.stdout.write(`\nOutput: ${outputDir}/\n`);
}

main();
