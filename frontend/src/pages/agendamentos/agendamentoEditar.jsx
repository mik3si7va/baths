import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import { arrancarGestao, completarTarefa, completarCadeia, aguardarTarefa, getVariaveis, cancelarProcesso, aguardarFimGestao } from '../../utils/camundaWizard';
import { PassoServicos, PassoHorario, PassoConfirmacao } from './agendamentoNovo';

// US - BET-35: Como funcionário, quero reagendar (alterar serviços, data, hora, funcionário ou sala) um agendamento existente.
//
// Caminho BPMN (gestao_agendamento.bpmn, ramo REAGENDAR):
//   1. POST /agendamentos/:id/processos/gestao -> arranca instância
//   2. Completar BP161 com { accaoFuncionario: 'REAGENDAR' }
//   3. Completar Activity_17fe0it ("Registar reagendamento") com {}
//   4. Worker BP206 (carregar-dados-agendamento) hidrata variáveis: servicosActualizados, porteAnimal, qtdServicos
//   5. Entra em sub_preparar_servicos -> user task BP56
//   6. (Wizard) alterar serviços -> completar BP56 -> entrar em sub_gerar_selecionar_opcao -> BP86
//   7. (Wizard) data/hora preferida -> completar BP86 -> aguardar BP93
//   8. (Wizard) escolher opção -> ecrã de confirmação (resumo construído localmente)
//   9. (Wizard) confirmar -> completar BP93
//  10. Workers correm sozinhos: atualizar-agendamento-completo, libertar-reservas-temporarias, email
//  11. Processo termina -> ecrã finalizado
//
// Diferenças vs criar:
//   - Não há passo "porte do animal" (o porte já está fixado, vem de carregar-dados)
//   - Não há passo "cliente" (cliente é o original)
//   - Não há user task de confirmação final no BPMN (BP138 não existe no caminho REAGENDAR)
//     - o ecrã de confirmação é UI-only, gatekeeper antes de completar BP93.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PASSOS = [
    { id: 'servicos', label: '1. Serviços' },
    { id: 'horario', label: '2. Horário' },
    { id: 'confirmacao', label: '3. Confirmação' },
];

const parseListaServicos = (raw) => {
    if (!raw) return [];
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? raw : [];
};

function StepIndicator({ passoActual }) {
    // 'finalizado' não está em PASSOS - trata-se como "tudo concluído" para os chips ficarem verdes.
    const idxActual = passoActual === 'finalizado'
        ? PASSOS.length
        : PASSOS.findIndex((p) => p.id === passoActual);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            {PASSOS.map((passo, i) => {
                const isActivo = passo.id === passoActual;
                const isConcluido = i < idxActual;

                return (
                    <React.Fragment key={passo.id}>
                        <Chip
                            label={passo.label}
                            size="small"
                            color={isActivo ? 'primary' : isConcluido ? 'success' : 'default'}
                            variant={isActivo ? 'filled' : 'outlined'}
                            sx={{ fontWeight: isActivo ? 700 : 400 }}
                        />
                        {i < PASSOS.length - 1 && (
                            <Box sx={{ width: 24, height: 1, backgroundColor: '#aaa', opacity: 0.4 }} />
                        )}
                    </React.Fragment>
                );
            })}
        </Box>
    );
}

export default function AgendamentoEditar() {
    const { agendamentoId } = useParams();
    const navigate = useNavigate();

    // Wizard
    const [passoActual, setPassoActual] = useState('inicializar');

    // Estado local - apenas o que NÃO vive no Camunda.
    // - porte: input local até completar BP116; necessário para replays.
    // - regraPrecoNova: selecção em curso no dropdown (antes de clicar Adicionar).
    // - listaCamunda: cache da lista lida de servicosActualizados.
    // - snapshotServicos: cópia da lista no momento de Confirmar e avançar; usado pelo replay se utilizador cancelar opções no passo 2.
    const [porte, setPorte] = useState('');
    const [regraPrecoNova, setRegraPrecoNova] = useState('');
    const [listaCamunda, setListaCamunda] = useState([]);
    const [snapshotServicos, setSnapshotServicos] = useState([]);

    // Passo 2
    const [dataPreferida, setDataPreferida] = useState('');
    const [horaPreferida, setHoraPreferida] = useState('09:00');
    const [funcionarioPreferidoId, setFuncionarioPreferidoId] = useState('');
    const [indiceOpcao, setIndiceOpcao] = useState(null);
    const [funcionariosElegiveis, setFuncionariosElegiveis] = useState([]);

    // Catálogos
    const [tiposServico, setTiposServico] = useState([]);
    const [regrasPreco, setRegrasPreco] = useState([]);
    const [funcionarios, setFuncionarios] = useState([]);
    const [salas, setSalas] = useState([]);
    const [catalogoLoading, setCatalogoLoading] = useState(true);
    const [catalogoErro, setCatalogoErro] = useState('');

    // Camunda
    const [processInstanceId, setProcessInstanceId] = useState(null);
    const [solucoes, setSolucoes] = useState(null);
    const [camundaLoading, setCamundaLoading] = useState(false);
    const [camundaErro, setCamundaErro] = useState('');

    // Confirmação: nome do cliente vem das vars Camunda (seedadas pelo backend em arrancarGestao). 
    // resumoFinal é construído localmente a partir da opção escolhida quando o user passa para o passo 'confirmacao'.
    const [nomeCliente, setNomeCliente] = useState('');
    const [resumoFinal, setResumoFinal] = useState(null);

    // Guarda contra duplo arranque (React Strict Mode).
    const initRef = useRef(false);

    // Effects

    useEffect(() => {
        const carregar = async () => {
            try {
                // cache: 'no-store' evita 304 Not Modified - o fetch nativo trata 304 como response.ok=false e descarta o body,
                // o que fazia o dropdown de funcionários ficar vazio em re-loads.
                const opts = { cache: 'no-store' };
                const [resTipos, resRegras, resFuncs, resSalas] = await Promise.all([
                    fetch(`${API_BASE_URL}/servicos`, opts),
                    fetch(`${API_BASE_URL}/regras-preco`, opts),
                    fetch(`${API_BASE_URL}/funcionarios`, opts).catch(() => null),
                    fetch(`${API_BASE_URL}/salas`, opts).catch(() => null),
                ]);
                if (!resTipos.ok || !resRegras.ok) throw new Error('Falha ao carregar catálogos.');
                setTiposServico(await resTipos.json());
                setRegrasPreco(await resRegras.json());
                if (resFuncs?.ok) setFuncionarios(await resFuncs.json());
                if (resSalas?.ok) setSalas(await resSalas.json());
            } catch (e) {
                setCatalogoErro(e.message);
            } finally {
                setCatalogoLoading(false);
            }
        };
        carregar();
    }, []);

    // Arrancar processo gestao_agendamento + completar cadeia inicial + hidratar estado
    useEffect(() => {
        if (initRef.current || !agendamentoId) return;
        initRef.current = true;

        (async () => {
            setCamundaLoading(true);
            try {
                const procId = await arrancarGestao(agendamentoId);
                setProcessInstanceId(procId);

                await completarCadeia(procId, [
                    { chaveTarefa: 'BP161', variaveis: { accaoFuncionario: 'REAGENDAR' } },
                    { chaveTarefa: 'Activity_17fe0it', variaveis: {} },
                ]);

                // Worker BP206 corre e set servicosActualizados, porteAnimal, qtdServicos.
                // BP56 (Funcionário confirma ou altera serviços) é a próxima user task.
                await aguardarTarefa(procId, 'BP56');

                const vars = await getVariaveis(procId);
                const lista = parseListaServicos(vars.servicosActualizados);
                setListaCamunda(lista);
                if (vars.porteAnimal) setPorte(vars.porteAnimal);
                if (vars.nomeCliente) setNomeCliente(vars.nomeCliente);

                setPassoActual('servicos');
            } catch (e) {
                setCamundaErro(e.message);
            } finally {
                setCamundaLoading(false);
            }
        })();
    }, [agendamentoId]);

    // Derivados

    const opcoesServico = useMemo(() => {
        if (!porte || tiposServico.length === 0 || regrasPreco.length === 0) return [];
        return regrasPreco
            .filter((r) => r.porteAnimal === porte)
            .map((r) => {
                const tipo = tiposServico.find((t) => t.id === r.tipoServicoId);
                return tipo
                    ? {
                        regraId: r.id,
                        tipoServicoId: r.tipoServicoId,
                        nome: tipo.tipo,
                        precoBase: Number(r.precoBase),
                        duracaoMinutos: r.duracaoMinutos,
                    }
                    : null;
            })
            .filter(Boolean)
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [regrasPreco, tiposServico, porte]);

    const solucoesArr = useMemo(() => {
        if (!solucoes) return [];
        if (typeof solucoes === 'string') {
            try { return JSON.parse(solucoes); } catch { return []; }
        }
        return Array.isArray(solucoes) ? solucoes : [];
    }, [solucoes]);

    // Enriquece cada solução com nomes de funcionário/sala via lookup nos catálogos.
    // O scheduler passa apenas IDs no formato compacto por causa do limite de 4000 chars das variáveis Camunda - resolução de nomes acontece no frontend.
    const opcoesComNomes = useMemo(() => {
        return solucoesArr.map((sol, idx) => {
            const servicosComNomes = (sol.servicos || []).map((sv) => {
                const func = funcionarios.find((f) => f.id === sv.funcionarioId);
                const sala = salas.find((s) => s.id === sv.salaId);
                const outros = (sv.outrosFuncionariosIds || [])
                    .map((id) => funcionarios.find((f) => f.id === id)?.nomeCompleto)
                    .filter(Boolean);
                return {
                    ...sv,
                    nomeFuncionario: func?.nomeCompleto || (sv.funcionarioId || '').slice(0, 8),
                    nomeSala: sala?.nome || (sv.salaId || '').slice(0, 8),
                    nomeServico: sv.nomeServico || '-',
                    outrosFuncionariosNomes: outros,
                };
            });
            const valorTotal = servicosComNomes.reduce(
                (acc, s) => acc + Number(s.precoBase || 0),
                0
            );
            return {
                idx,
                dataHoraInicio: sol.dataHoraInicio,
                dataHoraFim: sol.dataHoraFim,
                duracaoTotal: sol.duracaoTotal,
                valorTotal,
                servicos: servicosComNomes,
            };
        });
    }, [solucoesArr, funcionarios, salas]);

    const totaisLocais = useMemo(() => {
        const duracao = listaCamunda.reduce((s, x) => s + (x.duracaoMinutos || 0), 0);
        const valor = listaCamunda.reduce((s, x) => s + Number(x.precoBase || 0), 0);
        return { duracao, valor };
    }, [listaCamunda]);

    // Helpers Camunda

    async function recarregarLista(procId) {
        const vars = await getVariaveis(procId);
        setListaCamunda(parseListaServicos(vars.servicosActualizados));
    }

    // Em editar, BP56 já está pendente desde o arranque. Não há "1ª adição via BP242".
    // Sempre cadeia BP56 (adicionar) -> BP58 (selecionar serviço).
    const adicionarServico = async () => {
        const opcao = opcoesServico.find((o) => o.regraId === regraPrecoNova);
        if (!opcao) return;
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t56 = await aguardarTarefa(processInstanceId, 'BP56');
            await completarTarefa(processInstanceId, t56.id, {
                adicionarServico: true,
                removerServico: false,
            });
            const t58 = await aguardarTarefa(processInstanceId, 'BP58');
            await completarTarefa(processInstanceId, t58.id, {
                tipoServicoId: opcao.tipoServicoId,
                servicoTemp: { tipoServicoId: opcao.tipoServicoId, nomeServico: opcao.nome },
            });
            await aguardarTarefa(processInstanceId, 'BP56');
            await recarregarLista(processInstanceId);
            setRegraPrecoNova('');
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const removerServico = async (tipoServicoId) => {
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t56 = await aguardarTarefa(processInstanceId, 'BP56');
            await completarTarefa(processInstanceId, t56.id, {
                adicionarServico: false,
                removerServico: true,
            });
            const tRemover = await aguardarTarefa(processInstanceId, 'Activity_1fxujz7');
            await completarTarefa(processInstanceId, tRemover.id, { servicoARemover: tipoServicoId });
            await aguardarTarefa(processInstanceId, 'BP56');
            await recarregarLista(processInstanceId);
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const avancarParaHorario = async () => {
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            setSnapshotServicos(listaCamunda);
            const t56 = await aguardarTarefa(processInstanceId, 'BP56');
            // `qtdServicos` é mantido em sync pelos workers adicionar-servico-lista e remover-servico-lista;
            // o gateway BP61 ("Lista tem pelo menos um serviço?") lê esse valor directamente.
            // Aqui só sinalizamos a intenção de avançar (ambos os flags a false) - sem precisar de passar tamanho.
            await completarTarefa(processInstanceId, t56.id, {
                adicionarServico: false,
                removerServico: false,
            });
            await aguardarTarefa(processInstanceId, 'BP86');

            try {
                const tiposIds = listaCamunda.map((s) => s.tipoServicoId).join(',');
                const url = `${API_BASE_URL}/funcionarios/elegiveis?porte=${porte}&tiposIds=${tiposIds}`;
                const resp = await fetch(url, { cache: 'no-store' });
                if (resp.ok) setFuncionariosElegiveis(await resp.json());
            } catch { }

            setPassoActual('horario');
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const gerarOpcoes = async () => {
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const dataISO = new Date(`${dataPreferida}T${horaPreferida || '09:00'}:00Z`).toISOString();
            const t86 = await aguardarTarefa(processInstanceId, 'BP86');
            await completarTarefa(processInstanceId, t86.id, {
                dataPreferida: dataISO,
                horaPreferida: horaPreferida || '09:00',
                funcionarioPreferido: funcionarioPreferidoId || null,
                operacaoBemSucedida: true,
            });

            await aguardarTarefa(processInstanceId, 'BP93');
            const vars = await getVariaveis(processInstanceId);
            if (vars.operacaoBemSucedida === false || !vars.solucoes) {
                throw new Error(vars.mensagemErro || 'Sem disponibilidade nos 7 dias seguintes.');
            }
            setSolucoes(vars.solucoes);
            setListaCamunda(parseListaServicos(vars.servicosActualizados));
            setIndiceOpcao(null);
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    // Replay: cancela proc actual, arranca novo, recria lista, sai do sub, fica em BP86.
    const cancelarOpcoes = async () => {
        if (snapshotServicos.length === 0) return;
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            if (processInstanceId) await cancelarProcesso(processInstanceId);
            const procId = await arrancarGestao(agendamentoId);
            setProcessInstanceId(procId);

            await completarCadeia(procId, [
                { chaveTarefa: 'BP161', variaveis: { accaoFuncionario: 'REAGENDAR' } },
                { chaveTarefa: 'Activity_17fe0it', variaveis: {} },
            ]);
            await aguardarTarefa(procId, 'BP56');

            // BP206 hidrata com lista original do agendamento; aplicamos diff contra o snapshot para repor exactamente o que tinhamos antes.
            // Sair logo do sub com a lista actual da BD (que é o snapshot original do agendamento, igual ao que entrámos da 1ª vez).
            const t56final = await aguardarTarefa(procId, 'BP56');
            // Sai do sub: `qtdServicos` é mantido pelos workers de add/remove (ver avancarParaHorario), por isso aqui basta sinalizar avançar.
            await completarTarefa(procId, t56final.id, {
                adicionarServico: false,
                removerServico: false,
            });
            await aguardarTarefa(procId, 'BP86');

            setSolucoes(null);
            setIndiceOpcao(null);
            setPassoActual('horario');
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    // Não completa BP93 - só monta o resumo da opção escolhida e abre o ecrã de confirmação. A user task BP93 fica pendente até confirmarReagendamento().
    // Diferente do agendamentoNovo: lá o resumo vem do worker montar-resumo (BP135); aqui não existe esse worker no ramo REAGENDAR, então construímos localmente.
    const confirmarOpcao = async () => {
        if (indiceOpcao === null) return;
        const op = opcoesComNomes[indiceOpcao];
        if (!op) return;
        setResumoFinal({
            clienteNome: nomeCliente,
            opcaoSelecionada: {
                dataHoraInicio: op.dataHoraInicio,
                dataHoraFim: op.dataHoraFim,
            },
            servicos: (op.servicos || []).map((s, i) => ({
                ordem: i + 1,
                nome: s.nomeServico,
                duracao: s.duracaoMinutos,
                preco: s.precoBase,
            })),
            duracaoTotalMinutos: op.duracaoTotal,
            valorEstimado: op.valorTotal,
        });
        setPassoActual('confirmacao');
    };

    // Confirmação final: completa BP93 e espera o BPMN terminar antes de mostrar 'finalizado' - só então atualizar-agendamento-completo,
    // libertar-reservas-temporarias e o email correram, e a agenda mostra os dados novos no re-fetch.
    // O botão Cancelar no ecrã de confirmação chama cancelarTudo directamente (não há ramo "user confirmou=false" no BPMN do REAGENDAR; cancelar = abandonar).
    const confirmarReagendamento = async () => {
        if (indiceOpcao === null) return;
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t93 = await aguardarTarefa(processInstanceId, 'BP93');
            await completarTarefa(processInstanceId, t93.id, {
                opcaoSelecionada: indiceOpcao,
                todosRecursosDisponiveis: true,
            });
            await aguardarFimGestao(agendamentoId);
            setPassoActual('finalizado');
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const cancelarTudo = async () => {
        if (processInstanceId) await cancelarProcesso(processInstanceId);
        navigate(-1);
    };

    // Render

    if (catalogoLoading) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>A carregar catálogos…</Typography>
            </Box>
        );
    }

    if (catalogoErro) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error">Erro: {catalogoErro}</Alert>
                <Button sx={{ mt: 2 }} onClick={() => navigate(-1)}>Voltar</Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Reagendar Agendamento</Typography>

            <StepIndicator passoActual={passoActual} />

            {camundaErro && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCamundaErro('')}>
                    {camundaErro}
                </Alert>
            )}

            {passoActual === 'inicializar' && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>A carregar dados do agendamento…</Typography>
                </Paper>
            )}

            {passoActual === 'servicos' && (
                <PassoServicos
                    clienteRegistado={true}
                    porte={porte}
                    setPorte={setPorte}
                    portePodeMudar={false}
                    opcoesServico={opcoesServico}
                    regraPrecoNova={regraPrecoNova}
                    setRegraPrecoNova={setRegraPrecoNova}
                    adicionarServico={adicionarServico}
                    listaCamunda={listaCamunda}
                    removerServico={removerServico}
                    totaisLocais={totaisLocais}
                    onCancelar={cancelarTudo}
                    onConfirmar={avancarParaHorario}
                    camundaLoading={camundaLoading}
                />
            )}

            {passoActual === 'horario' && (
                <PassoHorario
                    listaCamunda={listaCamunda}
                    totaisLocais={totaisLocais}
                    dataPreferida={dataPreferida}
                    setDataPreferida={setDataPreferida}
                    horaPreferida={horaPreferida}
                    setHoraPreferida={setHoraPreferida}
                    funcionariosElegiveis={funcionariosElegiveis}
                    funcionarioPreferidoId={funcionarioPreferidoId}
                    setFuncionarioPreferidoId={setFuncionarioPreferidoId}
                    gerarOpcoes={gerarOpcoes}
                    opcoesComNomes={opcoesComNomes}
                    indiceOpcao={indiceOpcao}
                    setIndiceOpcao={setIndiceOpcao}
                    onCancelarOpcoes={cancelarOpcoes}
                    onConfirmarOpcao={confirmarOpcao}
                    onCancelarTudo={cancelarTudo}
                    camundaLoading={camundaLoading}
                />
            )}

            {passoActual === 'confirmacao' && (
                <PassoConfirmacao
                    resumoFinal={resumoFinal}
                    onCancelar={cancelarTudo}
                    onConfirmar={confirmarReagendamento}
                    camundaLoading={camundaLoading}
                    labelCancelar="Cancelar reagendamento"
                    labelConfirmar="Confirmar reagendamento"
                    textoIntro="Confirme os dados do reagendamento. Ao confirmar, o agendamento vai ser actualizado na Agenda."
                />
            )}

            {passoActual === 'finalizado' && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ color: 'success.main', mb: 1 }}>
                        ✓ Reagendamento confirmado!
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        O agendamento foi actualizado com sucesso. Se o cliente tem email,
                        foi enviada uma notificação de reagendamento automaticamente.
                    </Typography>
                    <Button variant="contained" onClick={() => navigate('/calendar')}>
                        Ver agenda
                    </Button>
                </Paper>
            )}
        </Box>
    );
}
