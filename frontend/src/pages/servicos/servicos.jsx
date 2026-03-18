import React, { useEffect, useState } from 'react';
import './servicos.css';

// Mapeamento de ícones e labels amigáveis para cada tipo de serviço
const TIPO_META = {
  BANHO:               { icon: '🛁', label: 'Banho' },
  TOSQUIA_COMPLETA:    { icon: '✂️', label: 'Tosquia Completa' },
  TOSQUIA_HIGIENICA:   { icon: '🪮', label: 'Tosquia Higiénica' },
  CORTE_UNHAS:         { icon: '💅', label: 'Corte de Unhas' },
  LIMPEZA_OUVIDOS:     { icon: '👂', label: 'Limpeza de Ouvidos' },
  EXPRESSAO_GLANDULAS: { icon: '💉', label: 'Expressão de Glândulas' },
  LIMPEZA_DENTES:      { icon: '🦷', label: 'Limpeza de Dentes' },
  APARAR_PELO_CARA:    { icon: '🐾', label: 'Aparar Pelo da Cara' },
  ANTI_PULGAS:         { icon: '🦟', label: 'Tratamento Anti-Pulgas' },
  ANTI_QUEDA:          { icon: '🧴', label: 'Tratamento Anti-Queda' },
  REMOCAO_NOS:         { icon: '🪢', label: 'Remoção de Nós' },
};

// Tipos que requerem porte do animal (preço variável por tamanho)
const REQUIRES_SIZE = new Set([
  'BANHO',
  'TOSQUIA_COMPLETA',
  'TOSQUIA_HIGIENICA',
]);

export default function ServicosPage() {
  const [servicos, setServicos] = useState([]);
  const [regras, setRegras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const [resServicos, resRegras] = await Promise.all([
          fetch(`${API_BASE_URL}/servicos`),
          fetch(`${API_BASE_URL}/regras-preco`),
        ]);

        if (!resServicos.ok) throw new Error(`Erro ao carregar serviços (${resServicos.status})`);
        if (!resRegras.ok) throw new Error(`Erro ao carregar regras de preço (${resRegras.status})`);

        const dataServicos = await resServicos.json();
        const dataRegras = await resRegras.json();

        setServicos(Array.isArray(dataServicos) ? dataServicos : []);
        setRegras(Array.isArray(dataRegras) ? dataRegras : []);
      } catch (err) {
        setError(err.message || 'Não foi possível carregar os serviços.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [API_BASE_URL]);

  // Conta quantas regras de preço existem por serviço
  const regrasCountByServico = regras.reduce((acc, r) => {
    acc[r.tipoServicoId] = (acc[r.tipoServicoId] || 0) + 1;
    return acc;
  }, {});

  const totalAtivos = servicos.filter((s) => s.ativo).length;
  const totalInativos = servicos.length - totalAtivos;

  return (
    <div className="servicos-container">
      {/* ── Navbar ── */}
      <header className="header">
        <nav className="navbar">
          <h1>BATHS &amp; TRIMS</h1>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/calendar">Calendário</a></li>
            <li><a href="/servicos" aria-current="page">Serviços</a></li>
          </ul>
        </nav>
      </header>

      <main className="servicos-main">
        {/* ── Page header ── */}
        <div className="servicos-page-header">
          <h2>Serviços da Clínica</h2>
          <button
            className="btn-primary"
            onClick={() => window.location.href = '/servicos/novo'}
          >
            <span>＋</span> Novo Serviço
          </button>
        </div>

        {/* ── Summary chips ── */}
        {!loading && !error && (
          <div className="servicos-summary">
            <div className="summary-chip">
              <span className="chip-value">{servicos.length}</span>
              <span className="chip-label">Total</span>
            </div>
            <div className="summary-chip">
              <span className="chip-value">{totalAtivos}</span>
              <span className="chip-label">Ativos</span>
            </div>
            <div className="summary-chip">
              <span className="chip-value">{totalInativos}</span>
              <span className="chip-label">Inativos</span>
            </div>
            <div className="summary-chip">
              <span className="chip-value">{regras.length}</span>
              <span className="chip-label">Regras Preço</span>
            </div>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="servicos-card">
          {loading && (
            <p className="state-message">A carregar serviços…</p>
          )}

          {!loading && error && (
            <p className="state-message error">⚠️ {error}</p>
          )}

          {!loading && !error && servicos.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🐾</span>
              <p>Ainda não existem serviços registados.</p>
              <button
                className="btn-primary"
                onClick={() => alert('Formulário de criação (em breve)')}
              >
                ＋ Criar primeiro serviço
              </button>
            </div>
          )}

          {!loading && !error && servicos.length > 0 && (
            <table className="servicos-table">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Requer Porte</th>
                  <th>Regras de Preço</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((servico) => {
                  const meta = TIPO_META[servico.tipo] || { icon: '🐾', label: servico.tipo };
                  const requiresSize = REQUIRES_SIZE.has(servico.tipo);
                  const nRegras = regrasCountByServico[servico.id] || 0;

                  return (
                    <tr key={servico.id}>
                      {/* Nome */}
                      <td>
                        <span className="tipo-label">
                          <span className="tipo-icon">{meta.icon}</span>
                          {meta.label}
                        </span>
                      </td>

                      {/* Requer porte */}
                      <td>
                        {requiresSize ? (
                          <span className="badge badge-yes">Sim</span>
                        ) : (
                          <span className="badge badge-no">Não</span>
                        )}
                      </td>

                      {/* Regras de preço */}
                      <td>
                        <span className="regras-count">
                          {nRegras > 0 ? `${nRegras} regra${nRegras !== 1 ? 's' : ''}` : '—'}
                        </span>
                      </td>

                      {/* Estado */}
                      <td>
                        <span className={`status-badge ${servico.ativo ? 'status-active' : 'status-inactive'}`}>
                          <span className="status-dot" />
                          {servico.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2024 BATHS &amp; TRIMS. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}