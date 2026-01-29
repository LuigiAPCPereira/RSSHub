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

/**
 * Extrai blocos DOT de um texto Markdown.
 *
 * Retorna um array com objetos representando cada bloco encontrado; cada objeto contém
 * `name` — um identificador sanitizado do gráfico — e `content` — o conteúdo DOT bruto do bloco.
 * O identificador é derivado do nome declarado no `graph`/`digraph` do conteúdo quando presente;
 * caso contrário é gerado como `graph_<n>`. Caracteres não alfanuméricos (exceto `_`) no nome são
 * substituídos por underscore.
 *
 * @param {string} markdown - Texto Markdown que pode conter blocos de código rotulados como ```dot.
 * @returns {{name: string, content: string}[]} Array de blocos DOT com `name` e `content`.
 */
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

/**
 * Extrai o corpo (nós e arestas) de um bloco DOT que contém uma declaração `graph` ou `digraph`.
 * @param {string} dotContent - Conteúdo DOT completo que inclui a declaração do grafo e seu corpo entre chaves.
 * @returns {string} O texto dentro das chaves da declaração principal, com diretivas `rankdir` removidas; retorna string vazia se a declaração não for encontrada.
 */
function extractGraphBody(dotContent) {
    // Extract just the body (nodes and edges) from a digraph
    // Matches "digraph Name {" or "digraph {" or "graph Name {" etc.
    const match = dotContent.match(/(?:strict\s+)?(?:di)?graph(?:\s+\w+)?\s*\{([\s\S]*)\}/);
    if (!match) return '';

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

/**
 * Gera uma representação SVG a partir de um grafo DOT.
 *
 * Executa o binário `dot` para converter o conteúdo DOT fornecido em SVG; em caso de falha escreve detalhes em stderr e encerra o processo com código 1.
 * @param {string} dotContent - Texto contendo o grafo em formato DOT.
 * @returns {string} O conteúdo SVG gerado pelo Graphviz `dot`.
 */
function renderToSvg(dotContent) {
    try {
        return execSync('dot -Tsvg', {
            input: dotContent,
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
        });
    } catch (err) {
        process.stderr.write(`Error running dot: ${err.message}\n`);
        if (err.stderr) process.stderr.write(err.stderr.toString() + '\n');
        process.exit(1);
    }
}

/**
 * Processa argumentos, extrai blocos DOT de SKILL.md e gera SVGs de diagramas.
 *
 * Lê o diretório de skill fornecido na linha de comando, valida a existência de SKILL.md
 * e do binário `dot`, extrai blocos ```dot do arquivo e gera arquivos SVG em
 * <skillDir>/diagrams. Suporta renderizar cada diagrama separadamente ou combinar todos
 * em um único diagrama com a flag `--combine`. Em caso de erro (arquivo ausente,
 * ausência do `dot` ou falhas de renderização) o processo é finalizado com código de
 * saída diferente de zero; se não houver blocos DOT, o processo sai com código 0.
 */
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