# Instruções do projeto

## Sempre informar passos de deploy/servidor após cada modificação

Este repositório é código que roda num servidor Debian real (produção),
separado do ambiente onde o Claude Code edita/commita. Depois de qualquer
mudança que exija ação no servidor para ter efeito — puxar o branch,
rodar `update.sh`, `build-embed.sh`, reiniciar serviço systemd, mexer em
config de Nginx/Apache, etc. — sempre informar explicitamente ao usuário,
ao final da resposta, exatamente quais comandos rodar no servidor e em
que ordem. Não assumir que dar `git push` já é suficiente ou que o
usuário vai lembrar de perguntar.

Se a mudança for só de código/documentação sem nenhum efeito prático até
ser implantada (ex.: só editar um arquivo que ainda não foi mesclado),
dizer isso também — "não precisa rodar nada agora, mas quando for
implantar: ...".

## Toda mudança de UI vale pra desktop, celular E tablet

Este painel é usado nos três — qualquer mudança de interface (novo campo,
reordenar formulário, corrigir um comportamento, layout novo) precisa
funcionar igual de bem nos três tamanhos de tela, não só no que foi usado
pra testar/pedir a mudança. Antes de considerar uma mudança de UI
terminada, testar (ou pelo menos raciocinar explicitamente sobre) os três:
desktop largo, tablet (~768-880px, onde o menu lateral vira gaveta) e
celular (~375-430px).

Exceção explícita: quando a própria natureza do pedido é específica de um
tamanho (ex.: "esse alinhamento só faz sentido no desktop", um ajuste de
espaçamento que só existe numa media query já pensada pra um breakpoint
só). Nesse caso, é esperado mexer só naquele breakpoint — mas isso deve
ser a exceção clara, não o padrão.
