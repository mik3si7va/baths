const { log } = require('../utils/logger');
const {
    enviarEmailConfirmacao,
    enviarEmailCancelamento,
    enviarEmailReagendamento,
    enviarEmailNaoCompareceu,
    enviarEmail,
} = require('../services/notificacoes');

/**
 * Função auxiliar para obter variável do Camunda com fallback
 */
function getVariable(task, variableName, defaultValue = null) {
    const value = task.variables.get(variableName);
    return value !== undefined && value !== null ? value : defaultValue;
}

/**
 * Função auxiliar para fazer parse seguro de JSON (opcaoSelecionada, resumo, etc.)
 */
function parseJsonSafe(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        log('emailWorkers', `Falha ao fazer parse de JSON para variável`, 'warn');
        return {};
    }
}

// ====================== TEMPLATES ======================

function templateConfirmacao(nomeCliente, dataHora, servicos = []) {
    const servicosStr = servicos.length
        ? servicos.map(s => `• ${s}`).join('<br>')
        : 'Serviços agendados';

    return `
        <h2>Olá ${nomeCliente}!</h2>
        <p>O seu agendamento foi <strong>confirmado</strong> com sucesso.</p>
        <p><strong>Data e hora:</strong> ${new Date(dataHora).toLocaleString('pt-PT')}</p>
        <p><strong>Serviços:</strong></p>
        <div style="margin-left: 20px;">${servicosStr}</div>
        <p>Obrigado por confiar na <strong>B&T</strong>!</p>
        <hr>
        <small>Este é um email automático. Não responda a este endereço.</small>
    `;
}

function templateCancelamento(nomeCliente, dataHora) {
    return `
        <h2>Olá ${nomeCliente}!</h2>
        <p>O seu agendamento de <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong> foi <strong>cancelado</strong>.</p>
        <p>Se desejar reagendar, contacte-nos ou utilize o nosso portal.</p>
        <hr>
        <small>Este é um email automático.</small>
    `;
}

function templateReagendamento(nomeCliente, dataHora) {
    return `
        <h2>Olá ${nomeCliente}!</h2>
        <p>O seu agendamento foi <strong>reagendado</strong> com sucesso.</p>
        <p><strong>Nova data e hora:</strong> ${new Date(dataHora).toLocaleString('pt-PT')}</p>
        <p>Obrigado por continuar a escolher a B&T!</p>
        <hr>
        <small>Este é um email automático.</small>
    `;
}

function templateNaoCompareceu(nomeCliente, dataHora) {
    return `
        <h2>Olá ${nomeCliente}!</h2>
        <p>Registámos a sua <strong>falta</strong> ao agendamento de <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong>.</p>
        <p>Se pretender reagendar, entre em contacto connosco.</p>
        <hr>
        <small>Este é um email automático.</small>
    `;
}

function templateFatura(nomeCliente, faturaId, faturaUrl = null) {
    return `
        <h2>Olá ${nomeCliente}!</h2>
        <p>Obrigado pela sua visita à B&T.</p>
        <p>A sua fatura <strong>${faturaId}</strong> foi emitida com sucesso.</p>
        ${faturaUrl ? `<p><a href="${faturaUrl}">Clique aqui para descarregar a fatura em PDF</a></p>` : ''}
        <p>Esperamos ver-vos em breve!</p>
        <hr>
        <small>Este é um email automático.</small>
    `;
}

// ====================== WORKERS ======================

module.exports = (client) => {

    // ─── ENVIAR EMAIL DE CONFIRMAÇÃO ─────────────────────────────────────
    client.subscribe('enviar-email-confirmacao', async ({ task, taskService }) => {
        const clienteEmail = getVariable(task, 'clienteEmail');
        const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');
        const resumoRaw = getVariable(task, 'resumoAgendamento');

        log('enviar-email-confirmacao', `Tentativa de envio para ${clienteEmail || 'sem email'}`, 'info');

        try {
            if (!clienteEmail) {
                log('enviar-email-confirmacao', 'Cliente sem email — ignorado', 'warn');
                return await taskService.complete(task);
            }

            const resumo = parseJsonSafe(resumoRaw);
            const dataHora = resumo.dataHoraInicio || resumo.opcao?.dataHoraInicio || new Date();
            const servicos = (resumo.servicos || []).map(s => s.nome || s.nomeServico || 'Serviço');

            await enviarEmailConfirmacao({
                emailCliente: clienteEmail,
                nomeCliente,
                dataHoraInicio: dataHora,
                servicos,
            });

            await taskService.complete(task);
            log('enviar-email-confirmacao', `✓ Email de confirmação enviado para ${clienteEmail}`, 'success');

        } catch (err) {
            log('enviar-email-confirmacao', `Erro: ${err.message} — processo continua`, 'warn');
            await taskService.complete(task); // emails são best-effort
        }
    });

    // ─── ENVIAR EMAIL DE CANCELAMENTO ────────────────────────────────────
    client.subscribe('enviar-email-cancelamento', async ({ task, taskService }) => {
        const clienteEmail = getVariable(task, 'clienteEmail');
        const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');
        const dataHora = getVariable(task, 'dataHoraInicio', new Date());

        log('enviar-email-cancelamento', `Tentativa para ${clienteEmail || 'sem email'}`, 'info');

        try {
            if (!clienteEmail) {
                return await taskService.complete(task);
            }

            await enviarEmailCancelamento({
                emailCliente: clienteEmail,
                nomeCliente,
                dataHoraInicio: dataHora,
            });

            await taskService.complete(task);
            log('enviar-email-cancelamento', `✓ Email de cancelamento enviado`, 'success');

        } catch (err) {
            log('enviar-email-cancelamento', `Erro: ${err.message} — processo continua`, 'warn');
            await taskService.complete(task);
        }
    });

    // ─── ENVIAR EMAIL DE REAGENDAMENTO ───────────────────────────────────
    client.subscribe('enviar-email-reagendamento', async ({ task, taskService }) => {
        const clienteEmail = getVariable(task, 'clienteEmail');
        const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');
        const opcaoRaw = getVariable(task, 'opcaoSelecionada');

        log('enviar-email-reagendamento', `Tentativa para ${clienteEmail || 'sem email'}`, 'info');

        try {
            if (!clienteEmail) {
                return await taskService.complete(task);
            }

            const opcao = parseJsonSafe(opcaoRaw);
            const dataHora = opcao.dataHoraInicio || new Date();

            await enviarEmailReagendamento({
                emailCliente: clienteEmail,
                nomeCliente,
                dataHoraInicio: dataHora,
            });

            await taskService.complete(task);
            log('enviar-email-reagendamento', `✓ Email de reagendamento enviado`, 'success');

        } catch (err) {
            log('enviar-email-reagendamento', `Erro: ${err.message} — processo continua`, 'warn');
            await taskService.complete(task);
        }
    });

    // ─── ENVIAR EMAIL DE NÃO COMPARECEU ──────────────────────────────────
    client.subscribe('enviar-email-nao-compareceu', async ({ task, taskService }) => {
        const clienteEmail = getVariable(task, 'clienteEmail');
        const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');
        const dataHora = getVariable(task, 'dataHoraInicio', new Date());

        log('enviar-email-nao-compareceu', `Tentativa para ${clienteEmail || 'sem email'}`, 'info');

        try {
            if (!clienteEmail) {
                return await taskService.complete(task);
            }

            await enviarEmailNaoCompareceu({
                emailCliente: clienteEmail,
                nomeCliente,
                dataHoraInicio: dataHora,
            });

            await taskService.complete(task);
            log('enviar-email-nao-compareceu', `✓ Email de não comparecimento enviado`, 'success');

        } catch (err) {
            log('enviar-email-nao-compareceu', `Erro: ${err.message} — processo continua`, 'warn');
            await taskService.complete(task);
        }
    });

    // ─── ENVIAR EMAIL DA FATURA ──────────────────────────────────────────
    client.subscribe('enviar-email-fatura', async ({ task, taskService }) => {
        const clienteEmail = getVariable(task, 'clienteEmail');
        const nomeCliente = getVariable(task, 'nomeCliente', 'Cliente');
        const faturaId = getVariable(task, 'faturaId');
        const faturaUrl = getVariable(task, 'faturaUrl');

        log('enviar-email-fatura', `Tentativa para ${clienteEmail || 'sem email'} | fatura=${faturaId}`, 'info');

        try {
            if (!clienteEmail || !faturaId) {
                log('enviar-email-fatura', 'Faltam dados obrigatórios (email ou faturaId)', 'warn');
                return await taskService.complete(task);
            }

            await enviarEmail({
                to: clienteEmail,
                subject: `Fatura ${faturaId} - B&T`,
                html: templateFatura(nomeCliente, faturaId, faturaUrl),
            });

            await taskService.complete(task);
            log('enviar-email-fatura', `✓ Email com fatura enviado para ${clienteEmail}`, 'success');

        } catch (err) {
            log('enviar-email-fatura', `Erro: ${err.message} — processo continua`, 'warn');
            await taskService.complete(task);
        }
    });
};