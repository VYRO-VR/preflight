// Partial Portuguese translation — falls back to English for missing keys.
export const pt: Record<string, string> = {
  'app.title': 'Configurador VYRO VR',
  'app.subtitle': 'Configure seus rastreadores IBIS em minutos.',

  'nav.back': 'Voltar',
  'nav.next': 'Próximo',
  'nav.recheck': 'Verificar novamente',
  'nav.finish': 'Concluir',
  'nav.skip': 'Pular por agora',

  'status.pass': 'Pronto',
  'status.warn': 'Atenção',
  'status.fail': 'Ação necessária',
  'status.running': 'Verificando…',
  'status.pending': 'Não verificado',

  'step.welcome.title': 'Bem-vindo',
  'step.welcome.body': 'Selecione seu conjunto de rastreadores para personalizar a configuração.',
  'step.welcome.trackers': '{count} rastreadores',

  'step.system.title': 'Requisitos do Sistema',
  'step.software.title': 'Software Necessário',
  'step.software.running': 'Em execução',
  'step.software.notrunning': 'Não encontrado ou não está em execução',
  'step.software.slimevr.hint':
    'Instale e abra o SlimeVR Server (Steam ou standalone) antes de continuar.',
  'step.software.getslimevr': 'Obter SlimeVR',
  'step.receiver.title': 'Conecte o Receptor',
  'step.receiver.cable.title': 'Conectei o receptor ao cabo de extensão.',
  'step.receiver.cable.body':
    'Conecte o receptor ao cabo de extensão incluído e depois ao PC — nunca diretamente. Isso é necessário para um rastreamento confiável e para continuar.',
  'step.trackers.title': 'Ligue os Rastreadores',
  'step.mounting.title': 'Montagem e Atribuição',
  'step.calibration.title': 'Calibração',
  'step.firmware.title': 'Firmware',
  'step.firmware.warning':
    'Atualizações de firmware podem danificar um rastreador. Atualize apenas se instruído e nunca desconecte durante o processo.',
  'step.steamvr.title': 'Integração SteamVR',
  'step.finish.title': 'Tudo Pronto!',

  'links.docs': 'Documentação',
  'links.firmware': 'Repositório de firmware',
  'links.discord': 'Comunidade Discord',
  'links.store': 'Loja',

  'home.title': 'O que você gostaria de fazer?',
  'home.subtitle': 'Escolha uma tarefa — vamos guiá-lo passo a passo.',
  'home.pair.title': 'Parear Novos Rastreadores',
  'home.pair.body': 'Conecte um rastreador ao receptor em poucos cliques.',
  'home.calibrate.title': 'Calibrar Rastreadores',
  'home.calibrate.body': 'Tenha um rastreamento preciso com uma calibração rápida.',
  'home.troubleshoot.title': 'Resolver Problemas de Conexão',
  'home.troubleshoot.body': 'Verifique sua configuração e resolva problemas comuns.',
  'home.receiver.title': 'Atualizar Firmware do Receptor',
  'home.receiver.body': 'Verifique o receptor e atualize-o para combinar com os rastreadores.',
  'home.wizard.title': 'Guia de Configuração Completo',
  'home.wizard.body': 'Percorra toda a configuração, passo a passo.',
  'nav.home': 'Início',

  'pair.title': 'Parear Novos Rastreadores',
  'pair.connect.title': 'Conectando ao seu receptor',
  'pair.connect.searching': 'Procurando o seu receptor…',
  'pair.connect.found': 'Receptor encontrado',
  'pair.connect.choose': 'Mais de um receptor encontrado — escolha qual usar:',
  'pair.connect.none.title': 'Nenhum receptor encontrado',
  'pair.connect.none.body':
    'Conecte o receptor ao PC usando o cabo de extensão USB incluído e tente novamente.',
  'pair.connect.retry': 'Procurar novamente',
  'pair.connect.use': 'Usar este receptor',
  'pair.firmware.note':
    'Dica: os rastreadores e o receptor devem ter a mesma versão de firmware, senão não pareiam.',
  'pair.listen.title': 'Coloque o rastreador em modo de pareamento',
  'pair.listen.instruction':
    'Pressione o botão do rastreador {presses} vezes. O LED piscará azul uma vez por segundo.',
  'pair.listen.waiting': 'Aguardando um rastreador…',
  'pair.listen.timeout':
    'Ainda nada. Confirme que o LED pisca azul uma vez por segundo e pressione o botão {presses} vezes novamente.',
  'pair.paired.title': 'Novo rastreador pareado! 🎉',
  'pair.paired.count': '{count} pareados nesta sessão',
  'pair.paired.another': 'Parear outro',
  'pair.done': 'Concluir',
  'pair.error.title': 'Algo deu errado',

  'calibrate.title': 'Calibrar Rastreadores',
  'calibrate.intro':
    'Deixe cada rastreador deitado e parado, depois pressione o botão duas vezes — o LED passa pelas cores do arco-íris até terminar. Em seguida, em pé numa I-pose, faça um reset completo no SlimeVR Server.',
  'calibrate.buttons': 'Referência de botões',

  'troubleshoot.title': 'Resolver Problemas de Conexão',
  'troubleshoot.intro': 'Uma verificação rápida dos suspeitos de sempre.',
  'troubleshoot.receiver': 'Receptor conectado',
  'troubleshoot.receiver.fail': 'Nenhum receptor detectado — conecte-o pelo cabo de extensão USB.',
  'troubleshoot.server': 'SlimeVR Server',
  'troubleshoot.server.fail': 'Não conectado — abra o SlimeVR Server e verifique novamente.',
  'troubleshoot.trackers': 'Rastreadores online',
  'troubleshoot.trackers.fail':
    'Nenhum rastreador visto ainda — ligue-os ou pareie com “Parear Novos Rastreadores”.',
  'troubleshoot.recheck': 'Verificar novamente',
  'receiver.update.title': 'Atualizar Firmware do Receptor',
  'receiver.update.searching': 'Procurando o seu receptor…',
  'receiver.update.choose': 'Mais de um receptor encontrado — escolha um:',
  'receiver.update.use': 'Usar este receptor',
  'receiver.update.reading': 'Lendo o firmware do receptor…',
  'receiver.update.receiverfw': 'Firmware do receptor',
  'receiver.update.unknownfw': 'Desconhecido',
  'receiver.update.status': 'Compatibilidade de firmware',
  'receiver.update.uptodate': 'Atualizado com os seus rastreadores',
  'receiver.update.mismatch': 'Incompatível — o receptor deve ser atualizado',
  'receiver.update.cantcompare':
    'Não foi possível comparar — ligue um rastreador para ver o firmware e tente novamente.',
  'receiver.update.mismatch.detail': 'Build do receptor {receiver}, build dos rastreadores {trackers}.',
  'receiver.update.method': 'Método de atualização:',
  'receiver.update.method.uf2': 'Unidade UF2 (maioria dos dongles)',
  'receiver.update.method.dfu': 'Hex / DFU (HolyIOT)',
  'receiver.update.noasset': 'Ainda não há um arquivo de firmware compatível na última versão.',
  'receiver.update.nonrfutil':
    'A ferramenta de flash hex/DFU (nrfutil) ainda não está incluída nesta build, então este receptor não pode ser atualizado automaticamente.',
  'receiver.update.ack': 'Entendo que atualizar pode danificar o receptor e aceito o risco.',
  'receiver.update.flash': 'Atualizar receptor',
  'receiver.update.flashing': 'Atualizando…',
  'receiver.update.dontunplug': 'Não desconecte o receptor até terminar.',
  'receiver.update.nodrive':
    'O receptor não apareceu como unidade. Verifique se entrou no modo de atualização e tente novamente.',

  'links.slimevrDiscord': 'Discord SlimeVR'
}
