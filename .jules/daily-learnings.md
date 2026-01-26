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

🎯 Próximas Oportunidades (Backlog)
⚡ Performance (Bolt)

    [Oportunidade 1] Revisar uso de `toSorted` em outras views.

🎨 UX/Acessibilidade (Palette)

    [Oportunidade 1] Verificar outros botões que podem ser <a> inválidos.

🛡️ Segurança (Sentinel)

    [Oportunidade 1] Revisar outros usos de `eval` ou `new Function` no projeto.
