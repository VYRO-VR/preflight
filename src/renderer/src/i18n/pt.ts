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

  'senscal.reference.title': 'Deite-o com o botão para cima',
  'senscal.reference.body':
    'Coloque o rastreador deitado numa superfície dura e nivelada, com o botão voltado para cima, e deixe-o parado por um instante. Isso diz ao Preflight para que lado a carcaça está virada — a orientação do SlimeVR sozinha não diz, e por isso a prévia nunca batia com o rastreador.',
  'senscal.reference.waiting': 'Aguardando o rastreador ficar parado…',
  'senscal.reference.captured':
    'Pronto — a prévia agora acompanha o rastreador. Pegue-o e vire-o para conferir.',
  'senscal.reference.retake': 'Capturar de novo',
  'senscal.reference.continue': 'Continuar',

  'senscal.axis.progress': 'Posição {index} de {total} · eixo {axis} do giroscópio',
  'senscal.placement.flat.title': 'Deitado, botão para cima',
  'senscal.placement.flat.body': 'Deite o rastreador na superfície com o botão voltado para cima.',
  'senscal.placement.long-edge.title': 'Em pé sobre a borda longa',
  'senscal.placement.long-edge.body':
    'Coloque o rastreador em pé sobre a borda longa, na mesma superfície.',
  'senscal.placement.short-edge.title': 'Em pé sobre a borda curta',
  'senscal.placement.short-edge.body':
    'Coloque o rastreador em pé sobre a borda curta, na mesma superfície.',

  'senscal.place.title': 'Prepare o giro',
  'senscal.place.edge':
    'Encoste um lado reto do rastreador na borda de algo pesado — um livro de capa dura ou uma caixa. Comece com o rastreador encostado nela e termine encostado no mesmo ponto.',
  'senscal.place.why':
    'Essa borda repetível é a precisão: ±1° em {turns} voltas é um piso de erro de 0,03%. Fazer no olho dá ±10°, tão grande quanto o erro que se quer remover.',
  'senscal.place.flat':
    'Deslize sempre encostado na superfície, no ritmo que for confortável. Não há limite de tempo.',
  'senscal.place.start': 'Iniciar o giro',

  'senscal.reading.flat': 'Deitado, botão para cima',
  'senscal.reading.flat-inverted': 'Deitado, mas com o botão para baixo — vire-o',
  'senscal.reading.long-edge': 'Em pé sobre a borda longa',
  'senscal.reading.short-edge': 'Em pé sobre a borda curta',
  'senscal.reading.edge': 'Em pé sobre uma borda',
  'senscal.reading.tilted': 'Inclinado — apoie-o totalmente na superfície',
  'senscal.reading.none': 'Ainda sem orientação do rastreador',
  'senscal.reading.ok': 'Posição correta',
  'senscal.reading.wrong': 'Não é a posição que esta etapa pede',

  'senscal.send.zeroing': 'Limpando a correção antiga deste eixo…',
  'senscal.send.applying': 'Gravando a correção no rastreador…',
  'senscal.send.fail.title': 'O rastreador não recebeu o comando',
  'senscal.send.fail.noack':
    'O receptor não respondeu. Verifique se continua conectado e fora do modo de emparelhamento.',
  'senscal.send.fail.rejected': 'O receptor rejeitou o comando.',
  'senscal.send.retry': 'Tentar de novo',
  'senscal.send.back': 'Voltar',

  'senscal.spin.title': 'Gire {turns} voltas',
  'senscal.spin.body':
    'Gire o rastreador {turns} voltas completas, deslizando encostado na superfície, e traga-o de volta à borda exatamente onde começou.',
  'senscal.spin.turns': '{turns} / {target} voltas',
  'senscal.spin.remaining': 'faltam {turns}',
  'senscal.spin.ready': 'De volta à borda? Pressione Concluído.',
  'senscal.spin.offaxis.warn': 'Mantenha na horizontal — está inclinando',
  'senscal.spin.offaxis.reject': 'Inclinação demais. Deslize encostado na superfície.',
  'senscal.spin.gap': 'O feed do rastreador caiu durante o giro. Reinicie o giro.',
  'senscal.spin.done': 'Concluído',
  'senscal.spin.restart': 'Reiniciar o giro',
  'senscal.spin.cancel': 'Cancelar',

  'senscal.measured.title': 'Medido',
  'senscal.measured.body':
    'Em {target} voltas o giroscópio contou {turns} — {pct}% a {direction}, ou {deg}° por volta.',
  'senscal.measured.low': 'menos',
  'senscal.measured.high': 'mais',
  'senscal.measured.correction':
    'Correção a gravar: {value} no eixo {axis} (escala de {scale}× no giroscópio).',
  'senscal.measured.apply': 'Gravar no rastreador',
  'senscal.measured.again': 'Girar de novo',
  'senscal.measured.skip': 'Pular este eixo',
  'senscal.measured.gaps':
    'O feed do rastreador perdeu amostras durante o giro, então parte da rotação não foi contada. Gire de novo — mantenha o rastreador acordado e perto do receptor.',
  'senscal.measured.miscount':
    'Isso deu {turns} voltas, não {target}. Nenhum giroscópio erra tanto, então provavelmente a contagem escapou ou ele não voltou ao mesmo ponto. Gire de novo.',
  'senscal.measured.offaxis':
    'Houve bastante inclinação nesse giro. A medição vale, mas mantenha mais na horizontal para uma medição mais limpa.',

  'senscal.verify.title': 'Confira se pegou',
  'senscal.verify.body':
    'A correção já está no rastreador. Para conferir, gire exatamente mais {turns} voltas do mesmo jeito e traga-o de volta à borda — deve contar {turns} exatas.',
  'senscal.verify.start': 'Iniciar a conferência',
  'senscal.verify.finish': 'Estou de volta à borda',
  'senscal.verify.turns': '{turns} voltas medidas',
  'senscal.verify.pass': 'Aprovado — {deg}° de deriva por volta restantes.',
  'senscal.verify.fail': 'Ainda erra {deg}° por volta. Refaça este eixo se continuar assim.',
  'senscal.verify.miscount':
    'Isso deu {turns} voltas, não {target}. Provavelmente a contagem escapou — refaça a conferência.',
  'senscal.verify.gap': 'O feed caiu durante a conferência — refaça.',
  'senscal.verify.skip': 'Pular a conferência',

  'senscal.result.next': 'Próxima posição',
  'senscal.result.rerun': 'Refazer este eixo',
  'senscal.result.finish': 'Concluir',

  'senscal.done.title': 'Calibração concluída',
  'senscal.done.body': 'O que ficou gravado no rastreador, por eixo do giroscópio:',
  'senscal.done.axis': 'Eixo {axis}',
  'senscal.done.applied': 'Correção {value}',
  'senscal.done.verified': 'Correção {value} · conferência aprovada',
  'senscal.done.unverified': 'Correção {value} · conferência reprovada',
  'senscal.done.skipped': 'Pulado — sem correção',
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
