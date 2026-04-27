const nodemailer = require('nodemailer');
const { log } = require('../utils/logger');

let transporter;
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

const fmt = (d) => new Date(d).toLocaleString('pt-PT');

function layout(nomeCliente, corpo) {
    return `
    <h2>Olá ${nomeCliente}!</h2>
    ${corpo}
    <hr>
    <small>Este é um email automático. Não responda a este endereço.</small>
  `;
}

const TEMPLATES = {
    confirmacao: {
        subject: () => 'Confirmação de Agendamento',
        html: ({ nomeCliente, dataHoraInicio, servicos = [] }) => layout(nomeCliente, `
            <p>O seu agendamento foi <strong>confirmado</strong> para <strong>${fmt(dataHoraInicio)}</strong>.</p>
            <p><strong>Serviços:</strong> ${servicos.join(', ') || '—'}</p>
            <p>Obrigado por escolher a B&T!</p>
        `),
    },
    cancelamento: {
        subject: () => 'Cancelamento de Agendamento',
        html: ({ nomeCliente, dataHoraInicio }) => layout(nomeCliente, `
            <p>O seu agendamento de <strong>${fmt(dataHoraInicio)}</strong> foi cancelado.</p>
            <p>Se pretender reagendar, contacte-nos.</p>
        `),
    },
    reagendamento: {
        subject: () => 'Reagendamento Confirmado',
        html: ({ nomeCliente, dataHoraInicio }) => layout(nomeCliente, `
            <p>O seu agendamento foi reagendado para <strong>${fmt(dataHoraInicio)}</strong>.</p>
            <p>Obrigado por continuar a confiar na B&T!</p>
        `),
    },
    naoCompareceu: {
        subject: () => 'Falta ao Agendamento',
        html: ({ nomeCliente, dataHoraInicio }) => layout(nomeCliente, `
            <p>Registámos a sua falta ao agendamento de <strong>${fmt(dataHoraInicio)}</strong>.</p>
            <p>Se pretender reagendar, contacte-nos.</p>
        `),
    },
    fatura: {
        subject: ({ faturaId }) => `Fatura ${faturaId}`,
        html: ({ nomeCliente, faturaId, faturaUrl }) => layout(nomeCliente, `
            <p>Obrigado pela sua visita à B&T.</p>
            <p>A sua fatura <strong>${faturaId}</strong> foi emitida com sucesso.</p>
            ${faturaUrl ? `<p><a href="${faturaUrl}">Descarregar PDF</a></p>` : ''}
        `),
    },
};

/**
 * Envia um email via SMTP. Se DISABLE_EMAILS=true (default), apenas loga e devolve true.
 * Best-effort: erros são logados e devolvem false, nunca propagam.
 */
async function enviarEmail({ to, subject, html }) {
    if (!to) {
        log('notificacoes', 'sem destinatário — ignorado', 'warn');
        return false;
    }

    const disabled = String(process.env.DISABLE_EMAILS ?? 'true').toLowerCase() !== 'false';
    if (disabled) {
        log('notificacoes', `[SIMULACAO] ${to} | ${subject}`, 'info');
        return true;
    }

    try {
        await getTransporter().sendMail({
            from: process.env.MAIL_FROM || 'noreply@bet.pt',
            to,
            subject: `[B&T] ${subject}`,
            html,
        });
        return true;
    } catch (error) {
        log('notificacoes', `falha para ${to}: ${error.message}`, 'error');
        return false;
    }
}

function enviarTipo(tipo, dados) {
    const t = TEMPLATES[tipo];
    if (!t) throw new Error(`Tipo de email desconhecido: ${tipo}`);
    return enviarEmail({
        to: dados.emailCliente,
        subject: t.subject(dados),
        html: t.html(dados),
    });
}

const enviarEmailConfirmacao = (d) => enviarTipo('confirmacao', d);
const enviarEmailCancelamento = (d) => enviarTipo('cancelamento', d);
const enviarEmailReagendamento = (d) => enviarTipo('reagendamento', d);
const enviarEmailNaoCompareceu = (d) => enviarTipo('naoCompareceu', d);
const enviarEmailFatura = (d) => enviarTipo('fatura', d);

module.exports = {
    enviarEmail,
    enviarEmailConfirmacao,
    enviarEmailCancelamento,
    enviarEmailReagendamento,
    enviarEmailNaoCompareceu,
    enviarEmailFatura,
};