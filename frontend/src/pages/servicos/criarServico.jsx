import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './criarServico.css';

// ── Metadados dos tipos de serviço ──────────────────────
const TIPO_META = {
  BANHO:               { icon: '🛁', label: 'Banho',                  sub: 'Requer porte',    requiresSize: true  },
  TOSQUIA_COMPLETA:    { icon: '✂️', label: 'Tosquia Completa',        sub: 'Requer porte',    requiresSize: true  },
  TOSQUIA_HIGIENICA:   { icon: '🪮', label: 'Tosquia Higiénica',       sub: 'Requer porte',    requiresSize: true  },
  CORTE_UNHAS:         { icon: '💅', label: 'Corte de Unhas',          sub: 'Preço único',     requiresSize: false },
  LIMPEZA_OUVIDOS:     { icon: '👂', label: 'Limpeza de Ouvidos',      sub: 'Preço único',     requiresSize: false },
  EXPRESSAO_GLANDULAS: { icon: '💉', label: 'Expressão de Glândulas',  sub: 'Preço único',     requiresSize: false },
  LIMPEZA_DENTES:      { icon: '🦷', label: 'Limpeza de Dentes',       sub: 'Preço único',     requiresSize: false },
  APARAR_PELO_CARA:    { icon: '🐾', label: 'Aparar Pelo da Cara',     sub: 'Preço único',     requiresSize: false },
  ANTI_PULGAS:         { icon: '🦟', label: 'Tratamento Anti-Pulgas',  sub: 'Preço único',     requiresSize: false },
  ANTI_QUEDA:          { icon: '🧴', label: 'Tratamento Anti-Queda',   sub: 'Preço único',     requiresSize: false },
  REMOCAO_NOS:         { icon: '🪢', label: 'Remoção de Nós',          sub: 'Preço único',     requiresSize: false },
};

// ── Portes disponíveis (ordem crescente) ────────────────
const PORTES = [
  { value: 'EXTRA_PEQUENO', label: 'Extra Pequeno', range: '0.5 – 4.5 kg' },
  { value: 'PEQUENO',       label: 'Pequeno',       range: '5 – 9 kg'     },
  { value: 'MEDIO',         label: 'Médio',         range: '9.5 – 13.5 kg'},
  { value: 'GRANDE',        label: 'Grande',        range: '14 – 18 kg'   },
  { value: 'EXTRA_GRANDE',  label: 'Extra Grande',  range: '18.5+ kg'     },
];

// Estado inicial das regras por porte
function initRegrasPorPorte() {
  return PORTES.reduce((acc, p) => {
    acc[p.value] = { precoBase: '', duracaoMinutos: '' };
    return acc;
  }, {});
}

export default function CriarServicoPage() {
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ── Estado do formulário ──────────────────────────────
  const [step, setStep]                   = useState(1); // 1 = tipo, 2 = preços
  const [tipoSelecionado, setTipo]         = useState(null);
  const [tiposExistentes, setTiposExistentes] = useState(new Set());

  // Regras por porte (para serviços que requerem tamanho)
  const [regrasPorPorte, setRegrasPorPorte] = useState(initRegrasPorPorte());

  // Regra única (para serviços sem porte)
  const [precoUnico, setPrecoUnico]         = useState('');
  const [duracaoUnica, setDuracaoUnica]     = useState('');

  // UI state
  const [submitting, setSubmitting]         = useState(false);
  const [toast, setToast]                   = useState(null); // { type, msg }
  const [errors, setErrors]                 = useState({});

  // ── Carrega tipos já existentes para desabilitar ──────
  useEffect(() => {
    fetch(`${API_BASE_URL}/servicos`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setTiposExistentes(new Set(data.map((s) => s.tipo)));
      })
      .catch(() => {});
  }, [API_BASE_URL]);

  // ── Toast auto-dismiss ────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Helpers ───────────────────────────────────────────
  const meta = tipoSelecionado ? TIPO_META[tipoSelecionado] : null;

  function updateRegraPorte(porte, field, value) {
    setRegrasPorPorte((prev) => ({
      ...prev,
      [porte]: { ...prev[porte], [field]: value },
    }));
    setErrors((prev) => ({ ...prev, [`${porte}_${field}`]: null }));
  }

  // ── Validação ─────────────────────────────────────────
  function validateStep2() {
    const errs = {};

    if (meta.requiresSize) {
      PORTES.forEach(({ value }) => {
        const r = regrasPorPorte[value];
        if (!r.precoBase || isNaN(Number(r.precoBase)) || Number(r.precoBase) <= 0) {
          errs[`${value}_precoBase`] = 'Obrigatório';
        }
        if (!r.duracaoMinutos || isNaN(Number(r.duracaoMinutos)) || Number(r.duracaoMinutos) <= 0) {
          errs[`${value}_duracaoMinutos`] = 'Obrigatório';
        }
      });
    } else {
      if (!precoUnico || isNaN(Number(precoUnico)) || Number(precoUnico) <= 0) {
        errs['precoUnico'] = 'Preço base obrigatório e deve ser positivo';
      }
      if (!duracaoUnica || isNaN(Number(duracaoUnica)) || Number(duracaoUnica) <= 0) {
        errs['duracaoUnica'] = 'Duração obrigatória e deve ser positiva';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ────────────────────────────────────────────
  async function handleSubmit() {
    if (!validateStep2()) return;

    setSubmitting(true);
    try {
      // 1) Cria o TipoServico
      const resServico = await fetch(`${API_BASE_URL}/servicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoSelecionado }),
      });

      if (!resServico.ok) {
        const err = await resServico.json();
        throw new Error(err.error || 'Erro ao criar serviço');
      }

      const novoServico = await resServico.json();
      const tipoServicoId = novoServico.id;

      // 2) Cria as regras de preço
      const regrasPayload = meta.requiresSize
        ? PORTES.map(({ value }) => ({
            tipoServicoId,
            porteAnimal:     value,
            precoBase:       Number(regrasPorPorte[value].precoBase),
            duracaoMinutos:  Number(regrasPorPorte[value].duracaoMinutos),
          }))
        : [{
            tipoServicoId,
            porteAnimal:     'MEDIO', // valor placeholder para serviços sem porte
            precoBase:       Number(precoUnico),
            duracaoMinutos:  Number(duracaoUnica),
          }];

      // Envio em paralelo
      const resRegras = await Promise.all(
        regrasPayload.map((regra) =>
          fetch(`${API_BASE_URL}/regras-preco`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(regra),
          })
        )
      );

      const falhou = resRegras.find((r) => !r.ok);
      if (falhou) {
        const err = await falhou.json();
        throw new Error(err.error || 'Erro ao criar regras de preço');
      }

      setToast({ type: 'success', msg: `✅ Serviço "${meta.label}" criado com sucesso!` });
      setTimeout(() => navigate('/servicos'), 1800);

    } catch (err) {
      setToast({ type: 'error', msg: `❌ ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="criar-servico-container">

      {/* Navbar */}
      <header className="header">
        <nav className="navbar">
          <h1>BATHS &amp; TRIMS</h1>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/calendar">Calendário</a></li>
            <li><a href="/servicos">Serviços</a></li>
          </ul>
        </nav>
      </header>

      <main className="criar-servico-main">

        {/* Breadcrumb */}
        <div className="page-back">
          <button className="btn-back" onClick={() => navigate('/servicos')}>
            ← Voltar
          </button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Novo Serviço</span>
        </div>

        {/* Page title */}
        <div className="form-page-header">
          <h2>Criar Novo Serviço</h2>
          <p>Define o tipo de serviço e as regras de preço por porte de animal.</p>
        </div>

        {/* Steps */}
        <div className="steps-bar">
          <div className={`step-item ${step === 1 ? 'active' : 'done'}`}>
            <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
            <span className="step-label">Tipo de Serviço</span>
          </div>
          <div className={`step-line ${step > 1 ? 'done' : ''}`} />
          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
            <div className="step-circle">2</div>
            <span className="step-label">Preços &amp; Duração</span>
          </div>
        </div>

        {/* ── STEP 1: Escolha do tipo ── */}
        {step === 1 && (
          <div className="form-card">
            <div className="form-card-body">
              <p className="section-title">Escolhe o tipo de serviço</p>

              <div className="tipo-grid">
                {Object.entries(TIPO_META).map(([value, info]) => {
                  const jaExiste = tiposExistentes.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={[
                        'tipo-option',
                        tipoSelecionado === value ? 'selected' : '',
                        jaExiste ? 'disabled' : '',
                      ].join(' ')}
                      onClick={() => !jaExiste && setTipo(value)}
                      title={jaExiste ? 'Este serviço já está registado' : info.label}
                    >
                      <span className="tipo-option-icon">{info.icon}</span>
                      <span className="tipo-option-info">
                        <span className="tipo-option-label">{info.label}</span>
                        <span className="tipo-option-sub">
                          {jaExiste ? '⚠️ Já existe' : info.sub}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-card-footer">
              <button
                className="btn-secondary"
                onClick={() => navigate('/servicos')}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={!tipoSelecionado}
                onClick={() => setStep(2)}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preços e duração ── */}
        {step === 2 && meta && (
          <div className="form-card">
            <div className="form-card-body">
              <p className="section-title">
                {meta.icon} {meta.label}
              </p>

              {meta.requiresSize ? (
                /* Tabela de preços por porte */
                <div className="regras-section">
                  <div className="regras-info-box">
                    <span>ℹ️</span>
                    <span>
                      Este serviço varia consoante o porte do animal.
                      Preenche o preço base e a duração estimada para cada porte.
                    </span>
                  </div>

                  <div className="regras-table-wrap">
                    <table className="regras-table">
                      <thead>
                        <tr>
                          <th>Porte</th>
                          <th>Intervalo de peso</th>
                          <th>Preço base (€)</th>
                          <th>Duração (min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PORTES.map(({ value, label, range }) => (
                          <tr key={value}>
                            <td><span className="porte-badge">{label}</span></td>
                            <td style={{ color: 'var(--tq-600)', fontSize: '0.82rem' }}>{range}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="ex: 25.00"
                                value={regrasPorPorte[value].precoBase}
                                onChange={(e) => updateRegraPorte(value, 'precoBase', e.target.value)}
                                className={`input-inline ${errors[`${value}_precoBase`] ? 'error' : ''}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="ex: 60"
                                value={regrasPorPorte[value].duracaoMinutos}
                                onChange={(e) => updateRegraPorte(value, 'duracaoMinutos', e.target.value)}
                                className={`input-inline ${errors[`${value}_duracaoMinutos`] ? 'error' : ''}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Preço único */
                <div className="regras-section">
                  <div className="regras-info-box">
                    <span>ℹ️</span>
                    <span>
                      Este serviço tem um preço único independente do porte do animal.
                    </span>
                  </div>

                  <div className="sem-porte-row">
                    <div className="field-group">
                      <label className="field-label">Preço base (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="ex: 15.00"
                        value={precoUnico}
                        onChange={(e) => {
                          setPrecoUnico(e.target.value);
                          setErrors((p) => ({ ...p, precoUnico: null }));
                        }}
                        className={`input-field ${errors.precoUnico ? 'error' : ''}`}
                      />
                      {errors.precoUnico && <span className="field-error">{errors.precoUnico}</span>}
                    </div>

                    <div className="field-group">
                      <label className="field-label">Duração estimada (min)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="ex: 30"
                        value={duracaoUnica}
                        onChange={(e) => {
                          setDuracaoUnica(e.target.value);
                          setErrors((p) => ({ ...p, duracaoUnica: null }));
                        }}
                        className={`input-field ${errors.duracaoUnica ? 'error' : ''}`}
                      />
                      {errors.duracaoUnica && <span className="field-error">{errors.duracaoUnica}</span>}
                      <span className="field-hint">Usado para bloquear o calendário</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-card-footer">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                ← Voltar
              </button>
              <button
                className="btn-primary"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'A guardar…' : '✓ Criar Serviço'}
              </button>
            </div>
          </div>
        )}

      </main>

      <footer className="footer">
        <p>&copy; 2024 BATHS &amp; TRIMS. Todos os direitos reservados.</p>
      </footer>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}