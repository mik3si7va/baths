const nodemailer = require('nodemailer');
const { log } = require('../utils/logger');

let transporter; // Singleton

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT),
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },

            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development',
        });
    }
    return transporter;
}

/**
 * Função base para enviar email
 */
async function enviarEmail({ to, subject, html, text }) {
    if (!to) {
        log('notificacoes', 'Email sem destinatário — ignorado', 'warn');
        return false;
    }

    try {
        const mailOptions = {
            from: process.env.MAIL_FROM || 'noreply@bet.pt',
            to,
            subject: `[B&T] ${subject}`,
            html,
            ...(text && { text }),
        };

        await getTransporter().sendMail(mailOptions);
        log('notificacoes', `✓ Email enviado para ${to} | ${subject}`, 'success');
        return true;

    } catch (error) {
        log('notificacoes', `✗ Falha ao enviar email para ${to}: ${error.message}`, 'error');
        // emails são best-effort
        return false;
    }
}

/**
 * Templates de email
 */
function templateConfirmacao(nomeCliente, dataHora, servicos) {
    return `
    <h2>Olá ${nomeCliente}!</h2>
    <p>O seu agendamento foi confirmado para <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong>.</p>
    <p><strong>Serviços:</strong> ${servicos.join(', ')}</p>
    <p>Obrigado por escolher a B&T!</p>
    <hr>
    <small>Este é um email automático. Não responda a este endereço.</small>
  `;
}

function templateCancelamento(nomeCliente, dataHora) {
    return `
    <h2>Olá ${nomeCliente}!</h2>
    <p>O seu agendamento de <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong> foi cancelado.</p>
    <p>Se pretender reagendar, contacte-nos ou aceda ao nosso portal.</p>
    <hr>
    <small>Este é um email automático.</small>
  `;
}

function templateNaoCompareceu(nomeCliente, dataHora) {
    return `
    <h2>Olá ${nomeCliente}!</h2>
    <p>Registámos a sua falta ao agendamento de <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong>.</p>
    <p>Se pretender reagendar, contacte-nos.</p>
    <hr>
    <small>Este é um email automático.</small>
  `;
}

function templateReagendamento(nomeCliente, dataHora) {
    return `
    <h2>Olá ${nomeCliente}!</h2>
    <p>O seu agendamento foi reagendado para <strong>${new Date(dataHora).toLocaleString('pt-PT')}</strong>.</p>
    <p>Obrigado por continuar a confiar na B&T!</p>
    <hr>
    <small>Este é um email automático.</small>
  `;
}

/* ====================== Funções Públicas ====================== */

async function enviarEmailConfirmacao({ emailCliente, nomeCliente, dataHoraInicio, servicos = [] }) {
    const html = templateConfirmacao(nomeCliente, dataHoraInicio, servicos);
    return enviarEmail({
        to: emailCliente,
        subject: 'Confirmação de Agendamento',
        html
    });
}

async function enviarEmailCancelamento({ emailCliente, nomeCliente, dataHoraInicio }) {
    const html = templateCancelamento(nomeCliente, dataHoraInicio);
    return enviarEmail({
        to: emailCliente,
        subject: 'Cancelamento de Agendamento',
        html
    });
}

async function enviarEmailNaoCompareceu({ emailCliente, nomeCliente, dataHoraInicio }) {
    const html = templateNaoCompareceu(nomeCliente, dataHoraInicio);
    return enviarEmail({
        to: emailCliente,
        subject: 'Falta ao Agendamento',
        html
    });
}

async function enviarEmailReagendamento({ emailCliente, nomeCliente, dataHoraInicio }) {
    const html = templateReagendamento(nomeCliente, dataHoraInicio);
    return enviarEmail({
        to: emailCliente,
        subject: 'Reagendamento Confirmado',
        html
    });
}

module.exports = {
    enviarEmail,
    enviarEmailConfirmacao,
    enviarEmailCancelamento,
    enviarEmailNaoCompareceu,
    enviarEmailReagendamento,
};