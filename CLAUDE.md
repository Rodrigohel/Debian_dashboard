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
