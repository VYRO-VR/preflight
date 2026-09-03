// Partial Portuguese translation — falls back to English for missing keys.
export const pt: Record<string, string> = {
  'app.title': 'VYRO VR Preflight',
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
  // Calibração de sensibilidade do giroscópio
  'home.senscal.title': 'Sensibilidade do Giroscópio',
  'home.senscal.body':
    'Meça a escala do giroscópio de cada rastreador para reduzir a deriva de guinada.',

  'senscal.title': 'Calibração de Sensibilidade do Giroscópio',
  'senscal.subtitle':
    'Mede com que precisão o giroscópio do rastreador informa a rotação. Cada 0,5% de erro de escala equivale a cerca de 1,8° de deriva de guinada por volta completa do corpo, então este é o maior ganho possível contra a deriva.',

  'senscal.connect.searching': 'Procurando o receptor…',
  'senscal.connect.choose': 'Escolha o receptor a usar na calibração.',
  'senscal.connect.use': 'Usar este',
  'senscal.connect.none.title': 'Nenhum receptor encontrado',
  'senscal.connect.none.body':
    'Conecte o receptor e verifique se nenhum outro programa está usando a porta serial dele.',
  'senscal.connect.retry': 'Procurar novamente',
  'senscal.connect.busy':
    'O receptor está em modo de emparelhamento. Desligue o emparelhamento primeiro — os dois não podem dividir a porta.',

  'senscal.error.title': 'Algo deu errado',
  'senscal.error.retry': 'Começar de novo',

  'senscal.pick.title': 'Escolha um rastreador',
  'senscal.pick.body':
    'Calibre um rastreador de cada vez. Só é possível usar rastreadores conectados.',
  'senscal.pick.none':
    'Nenhum rastreador no feed ao vivo. Inicie o SlimeVR Server, acorde seus rastreadores e tente de novo.',
  'senscal.pick.slots': 'Emparelhados no receptor: {count}',
  'senscal.pick.suggested': 'Provável slot {slot}',
  'senscal.pick.unmatched': 'Slot desconhecido — você confirma a seguir',
  'senscal.pick.select': 'Calibrar este',

  'senscal.confirm.title': 'Confirme que é o rastreador certo',
  'senscal.confirm.body':
    'Nada liga um slot do receptor a um rastreador no SlimeVR, então isso precisa ser confirmado à mão. Pegue o {name} e balance — a prévia abaixo deve se mexer junto.',
  'senscal.confirm.slot': 'Enviando para o slot {slot} do receptor.',
  'senscal.confirm.yes': 'Sim, é esse',
  'senscal.confirm.no': 'Não, escolher outro',

  'senscal.axis.progress': 'Eixo {index} de {total}',
  'senscal.axis.z.title': 'Eixo Z — deitado na mesa',
  'senscal.axis.z.body':
    'Deite o rastreador numa superfície dura e nivelada, com a face voltada para cima.',
  'senscal.axis.x.title': 'Eixo X — em pé sobre a borda longa',
  'senscal.axis.x.body': 'Coloque o rastreador em pé sobre a borda longa, na mesma superfície.',
  'senscal.axis.y.title': 'Eixo Y — em pé sobre a borda curta',
  'senscal.axis.y.body': 'Coloque o rastreador em pé sobre a borda curta, na mesma superfície.',

  'senscal.place.title': 'Prepare o giro',
  'senscal.place.edge':
    'Encoste uma borda reta do rastreador na borda de algo pesado — um livro de capa dura ou uma caixa. Comece e termine o giro com o rastreador encostado nela.',
  'senscal.place.why':
    'Essa borda repetível é a precisão: ±1° em 10 voltas é um piso de erro de 0,03%. Fazer no olho dá ±10°, tão grande quanto o erro que se quer remover.',
  'senscal.place.flat':
    'Deslize sempre encostado na superfície. Não levante nem incline — movimento fora do eixo demais faz o rastreador descartar a medição.',
  'senscal.place.practice': 'Fazer uma volta de treino',
  'senscal.place.start': 'Iniciar calibração',

  'senscal.practice.title': 'Volta de treino',
  'senscal.practice.body':
    'Gire o rastreador uma volta completa no ritmo que vai usar. Dez voltas precisam caber em {budget} segundos, incluindo a parada cuidadosa.',
  'senscal.practice.target': 'Mire em {seconds}s por volta',
  'senscal.practice.measured': 'Sua última volta: {seconds}s',
  'senscal.practice.good': 'Bom ritmo — termina com folga.',
  'senscal.practice.slow': 'Lento demais. Dez voltas nesse ritmo não cabem no tempo.',
  'senscal.practice.waiting': 'Aguardando uma volta completa…',
  'senscal.practice.done': 'Treino concluído',

  'senscal.run.turns': '{turns} / {target} voltas',
  'senscal.run.pace': 'Ritmo alvo: {pace}',
  'senscal.run.behind': 'Atrás do ritmo — gire um pouco mais rápido',
  'senscal.run.timeleft': '{seconds}s restantes',
  'senscal.run.offaxis.warn': 'Mantenha na horizontal — está inclinando',
  'senscal.run.offaxis.reject': 'Inclinação demais. Deslize encostado na superfície.',
  'senscal.run.cancel': 'Cancelar',

  'senscal.phase.sending': 'Enviando o comando ao receptor…',
  'senscal.phase.bias': 'Fique parado — o rastreador está medindo o desvio do giroscópio.',
  'senscal.phase.ready': 'Gire agora — voltas constantes, encostado na superfície.',
  'senscal.phase.spinning': 'Gravando. Continue girando.',
  'senscal.phase.stopping': 'Pare encostado na borda e fique imóvel.',
  'senscal.phase.complete': 'Giro aceito.',

  'senscal.fail.title': 'Essa tentativa não valeu',
  'senscal.fail.rejected': 'O receptor rejeitou o comando.',
  'senscal.fail.noack':
    'O receptor não respondeu. Verifique se continua conectado e fora do modo de emparelhamento.',
  'senscal.fail.nospin': 'O rastreador nunca detectou o início do giro.',
  'senscal.fail.timeout': 'O giro não terminou a tempo.',
  'senscal.fail.aborted': 'Calibração cancelada.',
  'senscal.fail.cause.offaxis':
    'Causa mais provável: o rastreador inclinou ou foi levantado. Deslize encostado na superfície o tempo todo.',
  'senscal.fail.cause.tooslow':
    'Causa mais provável: o giro foi lento demais. Gire um pouco mais rápido — dez voltas precisam caber em {budget} segundos.',
  'senscal.fail.cause.underspun':
    'Causa mais provável: o rastreador nunca parou de forma limpa. Traga de volta à borda e segure imóvel.',
  'senscal.fail.cause.unknown': 'Tente a medição de novo.',
  'senscal.fail.retry': 'Tentar este eixo de novo',
  'senscal.fail.skip': 'Pular este eixo',

  'senscal.verify.title': 'Confira o resultado',
  'senscal.verify.body':
    'O rastreador guarda o veredito para si, então meça aqui: gire exatamente mais {turns} voltas, do mesmo jeito, e pare encostado na borda.',
  'senscal.verify.start': 'Iniciar a conferência',
  'senscal.verify.finish': 'Terminei as voltas',
  'senscal.verify.turns': '{turns} voltas medidas',
  'senscal.verify.pass': 'Aprovado — {deg}° de deriva por volta restantes.',
  'senscal.verify.fail': 'Ainda erra {deg}° por volta.',
  'senscal.verify.miscount':
    'Isso deu {turns} voltas, não {target}. Provavelmente a contagem escapou — refaça a conferência.',
  'senscal.verify.skip': 'Pular a conferência',

  'senscal.result.next': 'Próximo eixo',
  'senscal.result.rerun': 'Refazer este eixo',
  'senscal.result.finish': 'Concluir',

  'senscal.done.title': 'Calibração concluída',
  'senscal.done.body': 'Resultados por eixo:',
  'senscal.done.axis': 'Eixo {axis}',
  'senscal.done.passed': 'Aprovado',
  'senscal.done.failed': 'Não calibrado',
  'senscal.done.skipped': 'Pulado',
  'senscal.done.close': 'Pronto',

  'senscal.preview.nowebgl': 'Prévia 3D indisponível neste monitor.',

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
  'home.receiver.title': 'Atualizar Firmware',
  'home.receiver.body': 'Instale o firmware mais recente no receptor e nos rastreadores.',
  'home.wizard.title': 'Guia de Configuração Completo',
  'home.wizard.body': 'Percorra toda a configuração, passo a passo.',
  'home.more': 'Mais tarefas',
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
  'pair.stopped.title': 'O modo de pareamento está desligado',
  'pair.stopped.body':
    'Seu receptor não está mais aceitando novos rastreadores. Ative o modo de pareamento para continuar.',
  'pair.stopped.resume': 'Ativar o modo de pareamento novamente',

  // Indicador global de modo de pareamento
  'pairing.indicator.on': 'Modo de pareamento ativo',
  'pairing.indicator.off': 'Modo de pareamento desligado',
  'pairing.indicator.working': 'Processando…',
  'pairing.indicator.start': 'Ativar modo de pareamento',
  'pairing.indicator.stop': 'Cancelar modo de pareamento',
  'pairing.indicator.dismiss': 'Dispensar',

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
  'fwupdate.title': 'Atualização de Firmware',
  'fwupdate.latest': 'Firmware mais recente',
  'fwupdate.latest.loading': 'Verificando a versão de firmware mais recente…',
  'fwupdate.latest.error':
    'Não foi possível acessar as versões de firmware — verifique sua conexão com a internet.',
  'fwupdate.latest.receiver': 'Build do receptor',
  'fwupdate.latest.tracker': 'Build dos rastreadores',
  'fwupdate.latest.view': 'Ver notas da versão',
  'fwupdate.receiver.section': 'Receptor',
  'fwupdate.receiver.searching': 'Procurando o seu receptor…',
  'fwupdate.receiver.choose': 'Mais de um receptor encontrado — escolha um:',
  'fwupdate.receiver.use': 'Usar este receptor',
  'fwupdate.receiver.reading': 'Lendo o firmware do receptor…',
  'fwupdate.receiver.version': 'Versão',
  'fwupdate.receiver.commit': 'Commit',
  'fwupdate.receiver.builddate': 'Compilado em',
  'fwupdate.receiver.board': 'Placa',
  'fwupdate.receiver.unknownfw': 'Não foi possível ler os detalhes do firmware',
  'fwupdate.receiver.unknownfw.hint':
    'O receptor não respondeu ao comando de informações. Desconecte-o, reconecte e procure novamente. Firmware muito antigo não informa a versão — atualizar abaixo também resolve isso.',
  'fwupdate.receiver.showconsole': 'Saída do console',
  'fwupdate.status': 'Status',
  'fwupdate.uptodate': 'Atualizado',
  'fwupdate.outdated': 'Atualização disponível',
  'fwupdate.outdated.detail': 'Instalado {current}, mais recente {latest}.',
  'fwupdate.unknown': 'Não foi possível verificar — você ainda pode atualizar abaixo.',
  'fwupdate.rescan': 'Procurar novamente',
  'fwupdate.reinstall': 'Reinstalar ou trocar o firmware',
  'fwupdate.trackers.section': 'Rastreadores',
  'fwupdate.trackers.none':
    'Nenhum rastreador online. Ligue um e confirme que o SlimeVR Server está em execução para ver o firmware aqui.',
  'fwupdate.trackers.unknownfw': 'desconhecido',
  'fwupdate.trackers.update': 'Atualizar um rastreador',
  'fwupdate.trackers.step.connect': 'Conecte o rastreador ao PC com um cabo USB de dados.',
  'fwupdate.trackers.step.dfu':
    'Pressione o botão {presses} vezes — ele aparecerá como uma unidade removível.',
  'fwupdate.trackers.step.flash': 'Grave o arquivo de firmware selecionado acima nessa unidade.',
  'fwupdate.trackers.nodrive':
    'Nenhum rastreador em modo de atualização detectado ainda — pressione o botão {presses} vezes e ele aparecerá aqui.',
  'fwupdate.trackers.flash': 'Gravar em {drive}',
  'fwupdate.noasset': 'Ainda não há um arquivo de firmware compatível na última versão.',
  'fwupdate.hexonly':
    'Esta versão traz apenas um .hex bruto para este receptor, que não pode ser gravado via USB. É necessária uma versão com pacote DFU (.zip) — ou um gravador SWD.',
  'fwupdate.nonrfutil':
    'A ferramenta de flash hex/DFU (nrfutil) ainda não está incluída nesta build, então este receptor não pode ser atualizado automaticamente.',
  'fwupdate.ack': 'Entendo que atualizar pode danificar o dispositivo e aceito o risco.',
  'fwupdate.update': 'Atualizar receptor',
  'fwupdate.updating': 'Atualizando…',
  'fwupdate.dontunplug': 'Não desconecte o receptor até terminar.',
  'fwupdate.nodrive':
    'O receptor não apareceu como unidade. Verifique se entrou no modo de atualização e tente novamente.',
  'fwupdate.progress.dfu': 'Colocando o receptor em modo de atualização…',
  'fwupdate.progress.drive': 'Aguardando o receptor aparecer como unidade…',
  'fwupdate.progress.nrfutil':
    'Atualizando via USB — a espera pelo receptor pode levar até um minuto…',

  'links.slimevrDiscord': 'Discord SlimeVR',

  // Painel de desenvolvedor (botão oculto — ferramentas internas de produção)
  'dev.open': 'Ferramentas de desenvolvedor',
  'dev.title': 'Ferramentas de Desenvolvedor',
  'dev.subtitle':
    'Utilitários internos de produção — não são necessários para a configuração normal.',
  'dev.bulkflash.title': 'Gravação em Massa de Mochis',
  'dev.bulkflash.body':
    'Grava o bootloader incluído nas placas Mochi pela fixação de pinos com J-Link. Pressione os pinos na placa, aguarde o OK, levante e repita — o ciclo se rearma automaticamente para a próxima placa.',
  'dev.bulkflash.count': 'placas gravadas',
  'dev.bulkflash.start': 'Iniciar gravação em massa',
  'dev.bulkflash.stop': 'Parar',
  'dev.bulkflash.log': 'Registro de saída',
  'dev.bulkflash.log.empty': 'A saída aparecerá aqui quando o ciclo iniciar.',
  'dev.phase.idle': 'Parado',
  'dev.phase.setup': 'Preparando…',
  'dev.phase.waiting': 'Aguardando uma placa nos pinos…',
  'dev.phase.flashing': 'Gravando…',
  'dev.phase.recovering': 'Recuperando chip protegido…',
  'dev.phase.cooldown': 'Gravado — estabilizando…',
  'dev.phase.remove': 'Pronto — remova a placa',
  'dev.msg.ready': 'Pronto. Pressione a fixação de pinos numa placa para programá-la.',
  'dev.msg.protected': 'Chip protegido detectado — recuperando (desbloqueio + apagamento total)…',
  'dev.msg.recovered': 'Recuperado e programado com verificação.',
  'dev.msg.recoverfailed':
    'Falha na recuperação — verifique o contato dos pinos e tente novamente.',
  'dev.msg.removed': 'Placa removida. Pronto para a próxima…',
  'dev.msg.stuckhint':
    'Ainda aguardando — verifique se o J-Link está conectado e com os drivers instalados.',
  'dev.msg.nonrfutil': 'nrfutil não foi encontrado (não incluído nesta build, nem no PATH).',
  'dev.msg.nodeviceplugin':
    'Não foi possível instalar o comando device do nrfutil — é preciso internet uma vez.',
  'dev.msg.nohex': 'O hex do bootloader incluído está ausente nesta build.',
  'dev.msg.ok': 'OK ✅ placa nº {count} gravada em {seconds}s',
  'dev.msg.stopped': 'Parado — {count} placa(s) gravada(s) nesta sessão.'
}
