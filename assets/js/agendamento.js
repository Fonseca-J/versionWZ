/**
 * Script de Agendamento - Shalom Adonai
 * Versão: 2.0
 * Data: 15/06/2023
 */

document.addEventListener('DOMContentLoaded', function() {
    // Verifica se o localStorage está disponível
    if (!testarLocalStorage()) {
        mostrarAlerta('Seu navegador não suporta armazenamento local ou está desativado. Algumas funcionalidades podem não estar disponíveis.', 'danger');
        return;
    }

    // Elementos do DOM
    const formAgendamento = document.getElementById('agendamentoForm');
    const inputNome = document.getElementById('nome');
    const inputTelefone = document.getElementById('telefone');
    const inputData = document.getElementById('data');
    const selectHora = document.getElementById('hora');
    const inputProfissional = document.getElementById('profissionalSelecionado');
    const checkboxesServicos = document.querySelectorAll('input[name="servicos[]"]');
    
    // Modais
    const modalConfirmacao = new bootstrap.Modal('#confirmacaoModal');
    const modalCancelamento = new bootstrap.Modal('#cancelamentoModal');
    const textoConfirmacao = document.getElementById('confirmacaoTexto');
    const linkWhatsapp = document.getElementById('whatsappLink');
    const textoCancelamento = document.getElementById('cancelamentoTexto');
    const btnCancelarAgendamento = document.getElementById('cancelarAgendamentoBtn');
    const btnConfirmarCancelamento = document.getElementById('confirmarCancelamentoBtn');

    // Variáveis de estado
    let ultimoAgendamentoId = null;
    let agendamentos = JSON.parse(localStorage.getItem('agendamentos')) || [];
    const DURACAO_PADRAO_MINUTOS = 180; // 3 horas

    // Configuração inicial
    configurarDataMinima();
    desabilitarHorario();

    // Event Listeners
    formAgendamento.addEventListener('submit', submeterFormulario);
    inputData.addEventListener('change', atualizarHorariosDisponiveis);
    checkboxesServicos.forEach(cb => cb.addEventListener('change', handleSelecaoProfissional));
    btnCancelarAgendamento.addEventListener('click', prepararCancelamento);
    btnConfirmarCancelamento.addEventListener('click', confirmarCancelamento);

    // Funções principais
    function testarLocalStorage() {
        try {
            const teste = 'testeLocalStorage';
            localStorage.setItem(teste, teste);
            localStorage.removeItem(teste);
            return true;
        } catch (e) {
            console.error('Erro no localStorage:', e);
            return false;
        }
    }

    function configurarDataMinima() {
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        inputData.min = `${ano}-${mes}-${dia}`;
    }

    function desabilitarHorario() {
        selectHora.innerHTML = '<option value="" selected disabled>Selecione primeiro a data e o profissional</option>';
        selectHora.disabled = true;
    }

    function handleSelecaoProfissional(event) {
        const checkbox = event.target;
        
        if (checkbox.checked) {
            // Desmarca outros checkboxes
            checkboxesServicos.forEach(cb => {
                if (cb !== checkbox) cb.checked = false;
            });
            
            // Atualiza profissional selecionado
            inputProfissional.value = checkbox.value;
            
            // Se já tiver data selecionada, atualiza horários
            if (inputData.value) {
                atualizarHorariosDisponiveis();
            }
        } else {
            // Se desmarcou, limpa seleção
            inputProfissional.value = '';
            desabilitarHorario();
        }
    }

    function formatarTelefone(numero) {
        // Remove tudo que não é dígito
        const numeros = numero.replace(/\D/g, '');
        
        // Aplica máscara: (00) 00000-0000
        if (numeros.length <= 2) {
            return `(${numeros}`;
        }
        if (numeros.length <= 6) {
            return `(${numeros.substring(0, 2)}) ${numeros.substring(2)}`;
        }
        if (numeros.length <= 10) {
            return `(${numeros.substring(0, 2)}) ${numeros.substring(2, 6)}-${numeros.substring(6)}`;
        }
        return `(${numeros.substring(0, 2)}) ${numeros.substring(2, 7)}-${numeros.substring(7, 11)}`;
    }

    function validarTelefone(numero) {
        // Remove formatação
        const numeros = numero.replace(/\D/g, '');
        
        // Verifica se tem 10 ou 11 dígitos (com DDD)
        if (numeros.length < 10 || numeros.length > 11) return false;
        
        // Verifica DDD válido (exemplos)
        const dddsValidos = ['11', '12', '13', '19', '21', '24', '27', '31', '32'];
        const ddd = numeros.substring(0, 2);
        
        return dddsValidos.includes(ddd);
    }

    function atualizarHorariosDisponiveis() {
        if (!inputProfissional.value) {
            desabilitarHorario();
            return;
        }

        const dataSelecionada = new Date(inputData.value + 'T00:00:00');
        const diaSemana = dataSelecionada.getDay();
        const hoje = new Date();
        
        // Verifica se é domingo (0) ou segunda (1)
        if (diaSemana === 0 || diaSemana === 1) {
            selectHora.innerHTML = '<option value="" disabled>Fechado aos domingos e segundas</option>';
            selectHora.disabled = true;
            return;
        }

        selectHora.innerHTML = '<option value="" disabled selected>Carregando horários...</option>';
        selectHora.disabled = false;

        // Filtra agendamentos para o dia e profissional selecionados
        const agendamentosDia = agendamentos.filter(ag => {
            const agDate = new Date(ag.inicio);
            return agDate.toDateString() === dataSelecionada.toDateString() && 
                   ag.profissional === inputProfissional.value;
        });

        // Gera horários disponíveis (8h às 19h)
        const horariosDisponiveis = [];
        const HORA_INICIO = 8;
        const HORA_FIM = 19;

        for (let hora = HORA_INICIO; hora < HORA_FIM; hora++) {
            const horario = new Date(dataSelecionada);
            horario.setHours(hora, 0, 0, 0);
            
            // Formata para exibição (00:00)
            const horaFormatada = `${String(hora).padStart(2, '0')}:00`;
            
            // Verifica se horário já passou (para o dia atual)
            if (dataSelecionada.toDateString() === hoje.toDateString() && horario <= hoje) {
                horariosDisponiveis.push(`<option value="${horaFormatada}" disabled>${horaFormatada} (passado)</option>`);
                continue;
            }
            
            // Verifica se horário está disponível
            const horarioDisponivel = verificarDisponibilidadeHorario(
                horario, 
                DURACAO_PADRAO_MINUTOS, 
                agendamentosDia
            );
            
            if (horarioDisponivel) {
                horariosDisponiveis.push(`<option value="${horaFormatada}">${horaFormatada}</option>`);
            } else {
                horariosDisponiveis.push(`<option value="${horaFormatada}" disabled>${horaFormatada} (indisponível)</option>`);
            }
        }

        selectHora.innerHTML = horariosDisponiveis.length > 0 
            ? '<option value="" disabled selected>Selecione um horário</option>' + horariosDisponiveis.join('')
            : '<option value="" disabled>Nenhum horário disponível</option>';
    }

    function verificarDisponibilidadeHorario(horarioInicio, duracaoMinutos, agendamentosDia) {
        const horarioFim = new Date(horarioInicio.getTime() + duracaoMinutos * 60000);
        
        for (const agendamento of agendamentosDia) {
            const inicioExistente = new Date(agendamento.inicio);
            const fimExistente = new Date(agendamento.fim);
            
            // Verifica sobreposição de horários
            if (
                (horarioInicio >= inicioExistente && horarioInicio < fimExistente) ||
                (horarioFim > inicioExistente && horarioFim <= fimExistente) ||
                (horarioInicio <= inicioExistente && horarioFim >= fimExistente)
            ) {
                return false; // Conflito de horário
            }
        }
        
        return true; // Horário disponível
    }

    function submeterFormulario(event) {
        event.preventDefault();
        
        // Validações
        if (!validarFormulario()) return;
        
        // Cria objeto de agendamento
        const agendamento = criarObjetoAgendamento();
        
        // Salva no localStorage
        if (!salvarAgendamento(agendamento)) {
            mostrarAlerta('Erro ao salvar agendamento. Tente novamente.', 'danger');
            return;
        }
        
        // Envia notificações
        enviarNotificacoes(agendamento);
        
        // Mostra confirmação
        exibirConfirmacao(agendamento);
    }

    function validarFormulario() {
        // Valida nome
        if (inputNome.value.trim().length < 3) {
            mostrarAlerta('Por favor, insira seu nome completo', 'warning');
            inputNome.focus();
            return false;
        }
        
        // Valida telefone
        if (!validarTelefone(inputTelefone.value)) {
            mostrarAlerta('Por favor, insira um telefone válido com DDD', 'warning');
            inputTelefone.focus();
            return false;
        }
        
        // Valida profissional selecionado
        if (!inputProfissional.value) {
            mostrarAlerta('Selecione um profissional', 'warning');
            return false;
        }
        
        // Valida data e hora
        if (!inputData.value || !selectHora.value) {
            mostrarAlerta('Selecione uma data e horário válidos', 'warning');
            return false;
        }
        
        return true;
    }

    function criarObjetoAgendamento() {
        const [ano, mes, dia] = inputData.value.split('-');
        const [hora, minuto] = selectHora.value.split(':');
        
        // Cria data/hora de início (UTC)
        const inicio = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
        
        // Calcula fim (UTC)
        const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60000);
        
        // Serviços selecionados
        const servicos = Array.from(document.querySelectorAll('input[name="servicos[]"]:checked'))
                            .map(cb => cb.value);
        
        return {
            id: 'ag-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            nome: inputNome.value.trim(),
            telefone: inputTelefone.value,
            profissional: inputProfissional.value,
            servicos: servicos.join(', '),
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            dataCriacao: new Date().toISOString()
        };
    }

    function salvarAgendamento(agendamento) {
        try {
            agendamentos.push(agendamento);
            localStorage.setItem('agendamentos', JSON.stringify(agendamentos));
            ultimoAgendamentoId = agendamento.id;
            return true;
        } catch (e) {
            console.error('Erro ao salvar agendamento:', e);
            return false;
        }
    }

    function enviarNotificacoes(agendamento) {
        // Formata data para exibição
        const dataFormatada = new Date(agendamento.inicio).toLocaleDateString('pt-BR');
        const horaFormatada = new Date(agendamento.inicio).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Mensagem para o cliente
        const msgCliente = `✅ *Agendamento Confirmado - Shalom Adonai* ✅\n\n` +
                          `Olá ${agendamento.nome},\n\n` +
                          `Seu agendamento foi confirmado com sucesso!\n\n` +
                          `📅 *Data:* ${dataFormatada}\n` +
                          `⏰ *Horário:* ${horaFormatada}\n` +
                          `💇 *Profissional:* ${agendamento.profissional}\n` +
                          `💅 *Serviço(s):* ${agendamento.servicos}\n\n` +
                          `📍 *Local:* R. Nhatumani, 496 - Vila Ré\n\n` +
                          `ID do agendamento: ${agendamento.id}\n\n` +
                          `Para cancelar ou alterar, responda esta mensagem.`;
        
        // Mensagem para o salão
        const msgSalao = `📋 *NOVO AGENDAMENTO* 📋\n\n` +
                         `👤 *Cliente:* ${agendamento.nome}\n` +
                         `📞 *Telefone:* ${agendamento.telefone}\n` +
                         `📅 *Data:* ${dataFormatada}\n` +
                         `⏰ *Horário:* ${horaFormatada}\n` +
                         `👩‍⚕️ *Profissional:* ${agendamento.profissional}\n` +
                         `💅 *Serviço(s):* ${agendamento.servicos}\n\n` +
                         `ID: ${agendamento.id}`;
        
        // Envia para o WhatsApp do cliente
        enviarWhatsApp(agendamento.telefone, msgCliente);
        
        // Envia para o WhatsApp do salão (número fixo)
        enviarWhatsApp('11967036990', msgSalao);
    }

    function enviarWhatsApp(numero, mensagem) {
        const numeroLimpo = numero.replace(/\D/g, '');
        const mensagemCodificada = encodeURIComponent(mensagem);
        const urlWhatsapp = `https://wa.me/55${numeroLimpo}?text=${mensagemCodificada}`;
        
        // Abre em nova aba (não bloqueia a execução)
        window.open(urlWhatsapp, '_blank');
    }

    function exibirConfirmacao(agendamento) {
        const dataFormatada = new Date(agendamento.inicio).toLocaleDateString('pt-BR');
        const horaFormatada = new Date(agendamento.inicio).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        textoConfirmacao.innerHTML = `
            <p><strong>${agendamento.nome}</strong>, seu agendamento foi confirmado!</p>
            <div class="agendamento-detalhes p-3 bg-light rounded mt-3">
                <p class="mb-1"><strong>Serviço:</strong> ${agendamento.servicos}</p>
                <p class="mb-1"><strong>Profissional:</strong> ${agendamento.profissional}</p>
                <p class="mb-1"><strong>Data:</strong> ${dataFormatada}</p>
                <p class="mb-0"><strong>Horário:</strong> ${horaFormatada}</p>
                <p class="mt-2 mb-0 small"><strong>ID:</strong> ${agendamento.id}</p>
            </div>
        `;
        
        // Configura link do WhatsApp
        linkWhatsapp.href = `https://wa.me/55${agendamento.telefone.replace(/\D/g, '')}`;
        
        // Mostra modal
        modalConfirmacao.show();
        
        // Reseta formulário quando o modal é fechado
        modalConfirmacao._element.addEventListener('hidden.bs.modal', function() {
            formAgendamento.reset();
            desabilitarHorario();
            inputProfissional.value = '';
            checkboxesServicos.forEach(cb => cb.checked = false);
        }, { once: true });
    }

    function prepararCancelamento() {
        if (!ultimoAgendamentoId) return;
        
        const agendamento = agendamentos.find(ag => ag.id === ultimoAgendamentoId);
        if (!agendamento) return;
        
        const dataFormatada = new Date(agendamento.inicio).toLocaleDateString('pt-BR');
        const horaFormatada = new Date(agendamento.inicio).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        textoCancelamento.innerHTML = `
            <p>Você está prestes a cancelar o seguinte agendamento:</p>
            <div class="agendamento-detalhes p-3 bg-light rounded mt-3">
                <p class="mb-1"><strong>Serviço:</strong> ${agendamento.servicos}</p>
                <p class="mb-1"><strong>Profissional:</strong> ${agendamento.profissional}</p>
                <p class="mb-1"><strong>Data:</strong> ${dataFormatada}</p>
                <p class="mb-0"><strong>Horário:</strong> ${horaFormatada}</p>
                <p class="mt-2 mb-0 small"><strong>ID:</strong> ${agendamento.id}</p>
            </div>
            <p class="mt-3">Tem certeza que deseja cancelar?</p>
        `;
        
        modalConfirmacao.hide();
        modalCancelamento.show();
    }

    function confirmarCancelamento() {
        if (!ultimoAgendamentoId) return;
        
        // Remove do array de agendamentos
        agendamentos = agendamentos.filter(ag => ag.id !== ultimoAgendamentoId);
        
        try {
            // Atualiza localStorage
            localStorage.setItem('agendamentos', JSON.stringify(agendamentos));
            
            // Envia confirmação
            const agendamentoCancelado = agendamentos.find(ag => ag.id === ultimoAgendamentoId);
            if (agendamentoCancelado) {
                enviarWhatsApp(agendamentoCancelado.telefone, 
                    `❌ *Agendamento Cancelado* ❌\n\nSeu agendamento para ${agendamentoCancelado.servicos} foi cancelado com sucesso.`);
                
                enviarWhatsApp('11967036990', 
                    `⚠️ *CANCELAMENTO* ⚠️\n\nAgendamento ${ultimoAgendamentoId} foi cancelado pelo cliente.`);
            }
            
            // Feedback visual
            mostrarAlerta('Agendamento cancelado com sucesso!', 'success');
            
            // Fecha modal
            modalCancelamento.hide();
            
            // Reseta estado
            ultimoAgendamentoId = null;
            
        } catch (e) {
            console.error('Erro ao cancelar agendamento:', e);
            mostrarAlerta('Erro ao cancelar agendamento. Por favor, entre em contato diretamente.', 'danger');
        }
    }

    function mostrarAlerta(mensagem, tipo) {
        // Remove alertas existentes
        const alertasExistentes = document.querySelectorAll('.alert-flutuante');
        alertasExistentes.forEach(alerta => alerta.remove());
        
        // Cria elemento do alerta
        const alerta = document.createElement('div');
        alerta.className = `alert alert-${tipo} alert-flutuante alert-dismissible fade show`;
        alerta.role = 'alert';
        alerta.innerHTML = `
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Posiciona antes do formulário
        formAgendamento.parentNode.insertBefore(alerta, formAgendamento);
        
        // Remove automaticamente após 5 segundos
        setTimeout(() => {
            alerta.classList.remove('show');
            setTimeout(() => alerta.remove(), 150);
        }, 5000);
    }
});