# ADR-0003: Adiar isolamento forte no MVP controlado

## Status

Aceito — registro retrospectivo da aceitação humana de risco em 16/11/2026, restrita ao MVP experimental; não é aprovação para produção.

## Contexto

No E14, a extensão `pi-file-permissions` estava carregada, mas uma chamada RPC `bash` do controlador leu arquivo classificado como proibido. Isso comprova uma rota de acesso fora da proteção geral suposta, não uma falha demonstrada do hook `read` nem evasão espontânea pelo modelo.

Fonte: [prova de integração](../../reference/01-registro-integracao-openclaw-pi-e-decisoes.md), seção 6; [contrato MVP](../contrato-orquestracao-mvp.md), seções 7 e 9.

## Decisão

Adiar isolamento forte para depois do MVP e experimentar somente sobre repositórios descartáveis e dados fictícios, sem segredos ou credenciais Git amplas. Manter instruções, entradas filtradas e permissões como mitigação de exposição acidental, não sandbox.

Na revisão independente, exposição efetiva detectada contamina a tentativa: interromper, preservar diagnóstico e pausar para tratar/reconciliar. Não prosseguir silenciosamente nem declarar isolamento validado.

## Consequências

- Positivo: permite experimentar o workflow sem antecipar infraestrutura de isolamento forte.
- Negativo: arquivos acessíveis à mesma conta Windows podem continuar expostos por rotas indiretas; sessão nova não isola o filesystem.
- Restrição: não usar em produção ou projetos com dados importantes sob essa aceitação de risco.
- Reavaliação: leituras indevidas ou contaminação real exigem reconsiderar medidas como workspace filtrado, contas/permissões segregadas ou ambiente isolado verificável. A alternativa concreta não foi escolhida por este ADR.
