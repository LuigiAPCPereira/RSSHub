2025-02-18 - [Worker Route Normalization]

Tema: Bolt
Persona: Winston
O que descobrimos: Cloudflare Workers bundle pode exportar rotas como ESM default, objeto `{ handler }` ou função direta.
Por que importa: O router antigo falhava ao tentar carregar rotas sem normalização (`TypeError: r918.hasOwnProperty is not a function`).
Como aplicar: Implementar `normalizeHandler` que detecta o formato do export e retorna sempre a função handler correta.

2025-02-18 - [Dynamic Code Execution Safety]

Tema: Sentinel
Persona: Winston
O que descobrimos: Uso de `eval()` em `lib/utils/common-config.ts` era inseguro.
Por que importa: `eval()` tem acesso ao escopo local, permitindo vazamento de variáveis e potenciais ataques se input for controlado.
Como aplicar: Substituir por `new Function` com escopo explícito (`new Function('$', 'parseDate', 'return ' + result)`).

2025-02-18 - [Lazy Loading de Debug Info]

Tema: Bolt
Persona: Winston
O que descobrimos: Cálculos pesados (`toSorted`, `map`) em `lib/views/index.tsx` rodavam em todo render.
Por que importa: Aumenta latência da homepage desnecessariamente.
Como aplicar: Mover lógica pesada para dentro da condicional `if (showDebug)` ou função auxiliar lazy.

2025-02-18 - [Security: Comparação Segura de Strings]

Tema: Sentinel
Persona: Winston
O que descobrimos: Comparação de strings com `===` é vulnerável a *timing attacks* em verificações de chaves de API.
Por que importa: Permite que atacantes deduzam a chave medindo o tempo de resposta.
Como aplicar: Usar `crypto.timingSafeEqual` sempre que comparar segredos.

2025-02-18 - [Performance: Otimização de Hash em Middleware]

Tema: Bolt
Persona: Winston
O que descobrimos: Cálculo redundante de hash dentro de middleware crítico aumenta latência.
Por que importa: Em middlewares de alta frequência (como cache), cada milissegundo conta.
Como aplicar: Calcular hash uma única vez e reutilizar.

2025-02-18 - [UX: Acessibilidade em Links de Imagem]

Tema: Palette
Persona: Sally
O que descobrimos: Links contendo apenas imagens com `alt` redundante não são acessíveis.
Por que importa: Leitores de tela leem o nome do arquivo ou texto duplicado.
Como aplicar: Usar `aria-label` no link e `alt=""` na imagem decorativa.

🎯 Próximas Oportunidades (Backlog)
⚡ Performance (Bolt)

    Revisar uso de `toSorted` em outras views.
    Analisar overhead de logs em produção (`lib/middleware/logger.ts`).

🎨 UX/Acessibilidade (Palette)

    Verificar outros botões que podem ser <a> inválidos.
    Adicionar `aria-label` em links de paginação.

🛡️ Segurança (Sentinel)

    Revisar outros usos de `eval` ou `new Function` no projeto.
    Implementar Rate Limiting mais granular por IP.

📋 Outros

    Investigar falhas de teste (503 Service Unavailable) no sandbox.
