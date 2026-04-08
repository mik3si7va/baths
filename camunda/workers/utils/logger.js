const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};

const levelColors = {
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
    info: colors.cyan,
    debug: colors.gray,
};

function log(topic, message, type = 'info') {
    const timestamp = new Date().toISOString();
    const color = levelColors[type] || colors.cyan;

    if (process.env.NODE_ENV !== 'production' && !levelColors[type]) {
        console.warn(`[Logger] Tipo inválido "${type}" no topic "${topic}". Usando "info".`);
    }

    console.log(`${color}[${timestamp}] [${topic.toUpperCase()}] ${message}${colors.reset}`);
}

function debug(topic, message) {
    if (process.env.NODE_ENV !== 'production') {
        log(topic, message, 'debug');
    }
}

module.exports = { log, debug };