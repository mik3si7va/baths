import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    IconButton,
    InputBase,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import {
    arrancarProcesso,
    completarTarefa,
    cancelarProcesso,
    aguardarTarefa,
    getVariaveis,
} from '../../utils/camundaWizard';
import { fmtHoraUTC } from '../../utils/agendamentosCalendar';
import { filtrarClientes, filtrarAnimais } from '../../utils/filtroClientes';
import { ClienteCard, AnimalCard, ClienteForm, AnimalForm } from '../../components';

// US - BET-34: BP242 completa-se uma única vez por agendamento - o gateway BP248 ("Operação bem sucedida?") encaminha directamente para
// sub_preparar_servicos quando o worker adicionar-servico-lista corre OK.
// A gestão iterativa da lista (adicionar/remover) acontece toda no sub.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PASSOS = [
    { id: 'servicos', label: '1. Serviços' },
    { id: 'horario', label: '2. Horário e Funcionário' },
    { id: 'cliente', label: '3. Dados Cliente' },
    { id: 'confirmacao', label: '4. Confirmação' },
];

// Espelha backend/src/domain/enums/PorteEnum.js.
const PORTES = [
    { value: 'EXTRA_PEQUENO', label: 'Extra Pequeno (0.5 - 4.5 kg)' },
    { value: 'PEQUENO', label: 'Pequeno (5 - 9 kg)' },
    { value: 'MEDIO', label: 'Médio (9.5 - 13.5 kg)' },
    { value: 'GRANDE', label: 'Grande (14 - 18 kg)' },
    { value: 'EXTRA_GRANDE', label: 'Extra Grande (18.5+ kg)' },
];

const hojeISO = () => new Date().toISOString().slice(0, 10);

const parseListaServicos = (raw) => {
    if (!raw) return [];
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? raw : [];
};

// Step indicator
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

export default function AgendamentoNovo() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Pré-preenchimentos via query string. clienteId/animalId passam a state local
    // para podermos set-tá-los via pesquisa inline no passo 'inicio'.
    const clienteIdInicial = searchParams.get('clienteId');
    const animalIdInicial = searchParams.get('animalId');
    const procIdParam = searchParams.get('procId');
    const stepParam = searchParams.get('step');

    const [clienteId, setClienteId] = useState(clienteIdInicial);
    const [animalId, setAnimalId] = useState(animalIdInicial);
    const clienteRegistado = Boolean(clienteId);

    // Wizard. Passo inicial:
    //  - step explícito no URL (ex: retoma em 'confirmacao') -> respeita;
    //  - cliente já vem identificado (deep link da /pesquisa) -> arranca em 'servicos';
    //  - caso contrário -> mostra o gate 'inicio' (cards registado/novo) que mapeia ao
    //    agendamento.bpmn: cliente registado -> BP118/BP119; cliente novo -> BP116.
    const [passoActual, setPassoActual] = useState(
        stepParam || (clienteIdInicial ? 'servicos' : 'inicio')
    );

    // Sub-estado do passo 'inicio': 'cards' mostra a escolha; 'pesquisa' mostra
    // o input + lista para o utilizador escolher um animal de cliente registado.
    const [modoInicio, setModoInicio] = useState('cards');

    // Pesquisa inline de clientes/animais (só carrega quando modo === 'pesquisa').
    const [pesquisaQuery, setPesquisaQuery] = useState('');
    const [clientesPesquisa, setClientesPesquisa] = useState([]);
    const [pesquisaLoading, setPesquisaLoading] = useState(false);

    // Estado local - apenas o que NÃO vive no Camunda.
    // - porte: input local até completar BP116; necessário para replays.
    // - regraPrecoNova: selecção em curso no dropdown (antes de clicar Adicionar).
    // - listaCamunda: cache da lista lida de servicosActualizados.
    // - snapshotServicos: cópia da lista no momento de Confirmar e avançar; usado
    //   pelo replay se utilizador cancelar opções no passo 2.
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
    const [processInstanceId, setProcessInstanceId] = useState(procIdParam || null);
    const [solucoes, setSolucoes] = useState(null);
    const [camundaLoading, setCamundaLoading] = useState(false);
    const [camundaErro, setCamundaErro] = useState('');

    // Confirmação: resumoFinal é populado pelo worker BP135 (montar-resumo) e
    // lido via getVariaveis(resumoAgendamento) quando se entra no passo 'confirmacao'.
    const [resumoFinal, setResumoFinal] = useState(null);

    // Passo 3 'cliente' inline (apenas no fluxo cliente-não-registado).
    // Quando o cliente é criado via ClienteForm, guardamos para depois usar como
    // contexto na criação do animal (clienteId). Animal usa o porte escolhido no passo 1.
    const [clienteRegistadoInline, setClienteRegistadoInline] = useState(null);

    // Effects

    useEffect(() => {
        const carregar = async () => {
            try {
                // cache: 'no-store' evita 304 Not Modified - o fetch nativo
                // trata 304 como response.ok=false e descarta o body, o que
                // fazia o dropdown de funcionários ficar vazio em re-loads.
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

    useEffect(() => {
        if (!animalId) return;
        const carregar = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/animais/${animalId}`);
                if (res.ok) {
                    const a = await res.json();
                    if (a?.porte) setPorte(a.porte);
                }
            } catch {}
        };
        carregar();
    }, [animalId]);

    // Carrega catálogo de clientes só quando o utilizador entra no modo 'pesquisa'
    // no passo 'inicio' - evita um GET /clientes desnecessário no fluxo "cliente novo".
    useEffect(() => {
        if (passoActual !== 'inicio' || modoInicio !== 'pesquisa') return;
        if (clientesPesquisa.length > 0) return; // já carregados
        setPesquisaLoading(true);
        fetch(`${API_BASE_URL}/clientes`)
            .then((r) => r.json())
            .then((d) => setClientesPesquisa(Array.isArray(d) ? d : []))
            .catch(() => setClientesPesquisa([]))
            .finally(() => setPesquisaLoading(false));
    }, [passoActual, modoInicio, clientesPesquisa.length]);

    const totaisLocais = useMemo(() => {
        const duracao = listaCamunda.reduce((s, x) => s + (x.duracaoMinutos || 0), 0);
        const valor = listaCamunda.reduce((s, x) => s + Number(x.precoBase || 0), 0);
        return { duracao, valor };
    }, [listaCamunda]);

    // Re-fetch dos funcionários elegíveis quando a data/hora preferida ou a
    // duração total mudam no passo 'horario'. O backend filtra por dia da semana
    // e por turno (horaInicio/horaFim) - só mostra quem tem horário a cobrir o
    // slot pedido. O scheduler verifica reservas existentes; aqui só turno.
    useEffect(() => {
        if (passoActual !== 'horario' || !dataPreferida || listaCamunda.length === 0 || !porte) return;
        let cancelado = false;
        (async () => {
            try {
                const tiposIds = listaCamunda.map((s) => s.tipoServicoId).join(',');
                const params = new URLSearchParams({ porte, tiposIds, data: dataPreferida });
                if (horaPreferida && totaisLocais.duracao) {
                    params.set('hora', horaPreferida);
                    params.set('duracaoTotal', String(totaisLocais.duracao));
                }
                const resp = await fetch(`${API_BASE_URL}/funcionarios/elegiveis?${params}`, { cache: 'no-store' });
                if (!resp.ok || cancelado) return;
                const novos = await resp.json();
                if (!cancelado) setFuncionariosElegiveis(novos);
            } catch { /* mantém a lista anterior em caso de falha */ }
        })();
        return () => { cancelado = true; };
    }, [passoActual, dataPreferida, horaPreferida, listaCamunda, porte, totaisLocais.duracao]);

    // Desmarca o funcionário preferido se deixar de estar elegível (ex: utilizador
    // muda a data e o funcionário escolhido não trabalha no novo dia).
    useEffect(() => {
        if (funcionarioPreferidoId && funcionariosElegiveis.length > 0
            && !funcionariosElegiveis.find((f) => f.id === funcionarioPreferidoId)) {
            setFuncionarioPreferidoId('');
        }
    }, [funcionariosElegiveis, funcionarioPreferidoId]);

    useEffect(() => {
        if (procIdParam && stepParam === 'confirmacao') {
            (async () => {
                try {
                    const vars = await getVariaveis(procIdParam);
                    // O worker montar-resumo grava em `resumoAgendamento`
                    // (string JSON) - não em `resumo`.
                    if (vars?.resumoAgendamento) {
                        const r = typeof vars.resumoAgendamento === 'string'
                            ? JSON.parse(vars.resumoAgendamento)
                            : vars.resumoAgendamento;
                        setResumoFinal(r);
                    }
                } catch (e) {
                    setCamundaErro(e.message);
                }
            })();
        }
    }, [procIdParam, stepParam]);

    // Derivados

    // Pesquisa inline do passo 'inicio' - reusa o mesmo filtro centralizado das
    // outras páginas (utils/filtroClientes). Animais são "achatados" com referência
    // ao cliente para sabermos quem é o dono ao seleccionar.
    const animaisPesquisa = useMemo(
        () => clientesPesquisa.flatMap((c) => (c.animais ?? []).map((a) => ({ ...a, cliente: c }))),
        [clientesPesquisa],
    );
    // crossMatchAnimais: ao pesquisar pelo nome de um animal, mostramos também
    // o dono. Simétrico ao crossMatchCliente abaixo - torna a selecção rápida
    // (pesquisa "Rex" e clica directamente, sabendo logo que o dono é o João).
    const clientesFiltradosInicio = useMemo(
        () => filtrarClientes(clientesPesquisa, pesquisaQuery, { crossMatchAnimais: true }),
        [clientesPesquisa, pesquisaQuery],
    );
    // crossMatchCliente: ao pesquisar pelo nome/email/telefone/NIF do dono,
    // mostramos também os animais dele. Em /pesquisa o cross-match fica desligado
    // para preservar a separação clara entre lista de clientes e lista de animais.
    const animaisFiltradosInicio = useMemo(
        () => filtrarAnimais(animaisPesquisa, pesquisaQuery, { crossMatchCliente: true }),
        [animaisPesquisa, pesquisaQuery],
    );

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
    // O scheduler passa apenas IDs no formato compacto por causa do limite de 4000
    // chars das variáveis Camunda - resolução de nomes acontece no frontend.
    //
    // US - BET-34: outrosFuncionariosIds é informativo apenas. O utilizador escolhe
    // a opção como um todo; para preferir um funcionário específico, define-o no
    // campo "Funcionário preferido" antes de "Gerar opções" - o scheduler usa-o
    // como critério de desempate. Override pós-scheduler ficaria como evolução
    // futura (modificar BP93 + worker criar-reservas-temporarias-opcao).
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

    // Helpers Camunda

    // Arranca o processo e avança até deixar BP242 pendente (a 1ª user task
    // onde o utilizador escolhe serviço).
    async function arrancarAteBP242() {
        // No ramo cliente-registado o BPMN salta BP116 (porte) e BP130 (email/nome).
        // O backend resolve porteAnimal/clienteEmail/nomeCliente a partir dos IDs
        // antes de iniciar a instância - ver POST /agendamentos/processos.
        const procId = await arrancarProcesso({
            clienteRegistado,
            clienteId,
            animalId,
        });
        setProcessInstanceId(procId);

        if (clienteRegistado) {
            const t118 = await aguardarTarefa(procId, 'BP118');
            await completarTarefa(procId, t118.id, {});
            const t119 = await aguardarTarefa(procId, 'BP119');
            await completarTarefa(procId, t119.id, { animalId });
        } else {
            const t116 = await aguardarTarefa(procId, 'BP116');
            await completarTarefa(procId, t116.id, { porteAnimal: porte });
        }

        await aguardarTarefa(procId, 'BP242');
        return procId;
    }

    async function recarregarLista(procId) {
        const vars = await getVariaveis(procId);
        setListaCamunda(parseListaServicos(vars.servicosActualizados));
    }

    // Handlers do passo 1

    const adicionarServico = async () => {
        const opcao = opcoesServico.find((o) => o.regraId === regraPrecoNova);
        if (!opcao) return;
        setCamundaErro('');
        setCamundaLoading(true);

        try {
            let procId = processInstanceId;

            // 1ª adição: arrancar processo, avançar até BP242, e completar BP242.
            if (!procId) {
                procId = await arrancarAteBP242();
                const t242 = await aguardarTarefa(procId, 'BP242');
                await completarTarefa(procId, t242.id, {
                    tipoServicoId: opcao.tipoServicoId,
                    servicoTemp: {
                        tipoServicoId: opcao.tipoServicoId,
                        nomeServico: opcao.nome,
                    },
                    operacaoBemSucedida: true,
                });
            } else {
                // Adições subsequentes: já estamos em BP56 (sub_preparar_servicos).
                // Cadeia BP56(adicionar) -> BP58(serviço).
                const t56 = await aguardarTarefa(procId, 'BP56');
                await completarTarefa(procId, t56.id, {
                    adicionarServico: true,
                    removerServico: false,
                });
                const t58 = await aguardarTarefa(procId, 'BP58');
                await completarTarefa(procId, t58.id, {
                    tipoServicoId: opcao.tipoServicoId,
                    servicoTemp: {
                        tipoServicoId: opcao.tipoServicoId,
                        nomeServico: opcao.nome,
                    },
                });
            }

            // Após qualquer adição, BPMN regressa a BP56 com lista actualizada.
            await aguardarTarefa(procId, 'BP56');
            await recarregarLista(procId);
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
            await completarTarefa(processInstanceId, tRemover.id, {
                servicoARemover: tipoServicoId,
            });
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
            // Guarda snapshot para o replay (cancelar opções no passo 2).
            setSnapshotServicos(listaCamunda);

            const t56 = await aguardarTarefa(processInstanceId, 'BP56');
            // `qtdServicos` é mantido em sync pelos workers adicionar-servico-lista
            // e remover-servico-lista; o gateway BP61 ("Lista tem pelo menos um
            // serviço?") lê esse valor directamente. Aqui só sinalizamos a intenção
            // de avançar (ambos os flags a false) - sem precisar de passar tamanho.
            await completarTarefa(processInstanceId, t56.id, {
                adicionarServico: false,
                removerServico: false,
            });
            await aguardarTarefa(processInstanceId, 'BP86');

            // Carregar funcionários elegíveis uma só vez, agora que a lista está
            // fechada - evita fetch a cada adição/remoção no passo 1.
            try {
                const tiposIds = listaCamunda.map((s) => s.tipoServicoId).join(',');
                const url = `${API_BASE_URL}/funcionarios/elegiveis?porte=${porte}&tiposIds=${tiposIds}`;
                const resp = await fetch(url, { cache: 'no-store' });
                if (resp.ok) setFuncionariosElegiveis(await resp.json());
            } catch (e) {
                console.warn('Falha a carregar funcionários elegíveis:', e);
            }

            setPassoActual('horario');
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    // Handlers do passo 2

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
            // gerar-solucoes (BP87) reordena servicosActualizados via DMN - refrescar
            // a lista canónica para o cabeçalho passar a mostrar a ordem final.
            setListaCamunda(parseListaServicos(vars.servicosActualizados));
            setIndiceOpcao(null);
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    // Replay: cancela proc actual, arranca novo, recria a lista a partir do
    // snapshot guardado em avancarParaHorario, sai do sub, fica em BP86.
    const cancelarOpcoes = async () => {
        if (snapshotServicos.length === 0) return;
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            if (processInstanceId) await cancelarProcesso(processInstanceId);
            const procId = await arrancarAteBP242();

            // 1º serviço via BP242. Restantes entram via cadeia BP56 -> BP58 no sub.
            const [primeiro, ...resto] = snapshotServicos;
            const t242 = await aguardarTarefa(procId, 'BP242');
            await completarTarefa(procId, t242.id, {
                tipoServicoId: primeiro.tipoServicoId,
                servicoTemp: { tipoServicoId: primeiro.tipoServicoId, nomeServico: primeiro.nome },
                operacaoBemSucedida: true,
            });

            // Restantes via cadeia BP56 -> BP58.
            for (const s of resto) {
                const t56 = await aguardarTarefa(procId, 'BP56');
                await completarTarefa(procId, t56.id, {
                    adicionarServico: true,
                    removerServico: false,
                });
                const t58 = await aguardarTarefa(procId, 'BP58');
                await completarTarefa(procId, t58.id, {
                    tipoServicoId: s.tipoServicoId,
                    servicoTemp: { tipoServicoId: s.tipoServicoId, nomeServico: s.nome },
                });
            }

            // Sai do sub: `qtdServicos` é mantido pelos workers de add/remove
            // (ver avancarParaHorario), por isso aqui basta sinalizar avançar.
            const t56final = await aguardarTarefa(procId, 'BP56');
            await completarTarefa(procId, t56final.id, {
                adicionarServico: false,
                removerServico: false,
            });
            await aguardarTarefa(procId, 'BP86');

            setSolucoes(null);
            setIndiceOpcao(null);
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const confirmarOpcao = async () => {
        if (indiceOpcao === null) return;
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t93 = await aguardarTarefa(processInstanceId, 'BP93');
            await completarTarefa(processInstanceId, t93.id, {
                opcaoSelecionada: indiceOpcao,
                todosRecursosDisponiveis: true,
            });

            if (clienteRegistado) {
                await aguardarTarefa(processInstanceId, 'BP138');
                const vars = await getVariaveis(processInstanceId);
                if (vars?.resumoAgendamento) {
                    const r = typeof vars.resumoAgendamento === 'string'
                        ? JSON.parse(vars.resumoAgendamento)
                        : vars.resumoAgendamento;
                    setResumoFinal(r);
                }
                setPassoActual('confirmacao');
            } else {
                await aguardarTarefa(processInstanceId, 'BP130');
                setPassoActual('cliente');
            }
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    // Handler após cliente criado pelo ClienteForm inline. Apenas guarda em state -
    // a completação de BP130 acontece quando o animal também estiver criado, em
    // continuarParaConfirmacao. Justificação: BPMN espera BP130 -> BP131 em sequência;
    // se completássemos BP130 já e o utilizador cancelasse o animal, ficaríamos com
    // um cliente registado sem animal e o processo Camunda preso.
    const handleClienteRegistadoInline = (cliente) => {
        setClienteRegistadoInline(cliente);
    };

    // Handler após animal criado pelo AnimalForm inline. Completa BP130 (com dados
    // do cliente) e BP131 (com animalId) - replica o que /clientes faz em modo
    // agendamento, mas sem deixar a página. Depois carrega o resumo e avança.
    //
    // /animais/confirmar devolve { cliente, animal } (wrapper) - desempacotar.
    const continuarParaConfirmacao = async (resposta) => {
        const animal = resposta?.animal ?? resposta;
        const cliente = clienteRegistadoInline;
        if (!cliente || !animal?.id) {
            setCamundaErro('Faltam dados do cliente ou animal.');
            return;
        }
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t130 = await aguardarTarefa(processInstanceId, 'BP130');
            await completarTarefa(processInstanceId, t130.id, {
                clienteId: cliente.id,
                clienteEmail: cliente.email || null,
                nomeCliente: cliente.nome || null,
            });
            const t131 = await aguardarTarefa(processInstanceId, 'BP131');
            await completarTarefa(processInstanceId, t131.id, { animalId: animal.id });
            // Workers correm: BP135 montar-resumo grava `resumoAgendamento`. Esperamos
            // pela próxima user task (BP138 confirmação) e depois lemos o resumo.
            await aguardarTarefa(processInstanceId, 'BP138');
            const vars = await getVariaveis(processInstanceId);
            if (vars?.resumoAgendamento) {
                const r = typeof vars.resumoAgendamento === 'string'
                    ? JSON.parse(vars.resumoAgendamento)
                    : vars.resumoAgendamento;
                setResumoFinal(r);
            }
            setPassoActual('confirmacao');
        } catch (e) {
            setCamundaErro(e.message || 'Falha ao avançar para confirmação.');
        } finally {
            setCamundaLoading(false);
        }
    };

    const finalizarAgendamento = async (funcionarioConfirma) => {
        setCamundaErro('');
        setCamundaLoading(true);
        try {
            const t138 = await aguardarTarefa(processInstanceId, 'BP138');
            await completarTarefa(processInstanceId, t138.id, { funcionarioConfirma });
            // Confirma -> ecrã de sucesso (user precisa de feedback explícito);
            // Cancela -> não há mais para mostrar, volta à home.
            if (funcionarioConfirma) {
                setPassoActual('finalizado');
            } else {
                navigate('/home');
            }
        } catch (e) {
            setCamundaErro(e.message);
        } finally {
            setCamundaLoading(false);
        }
    };

    const cancelarTudo = async () => {
        if (processInstanceId) await cancelarProcesso(processInstanceId);
        navigate('/home');
    };

    // Handlers do passo 'inicio'

    // Cliente novo -> BP116 (porte) acontece depois no passo 'servicos'.
    // Registo do cliente em si fica para o passo 'cliente' (criação tardia).
    const escolherClienteNovo = () => {
        setPassoActual('servicos');
    };

    // Cliente registado -> mostra pesquisa inline (não sai da página).
    const escolherClienteRegistado = () => {
        setModoInicio('pesquisa');
    };

    // Selecção de animal na pesquisa -> equivalente a chegar via deep link /pesquisa?clienteId=...
    // Mapeia ao BP118 (abrir ficha) -> BP119 (seleccionar animal) do agendamento.bpmn.
    const selecionarAnimalPesquisa = (animal) => {
        setClienteId(animal.cliente.id);
        setAnimalId(animal.id);
        if (animal.porte) setPorte(animal.porte);
        setPassoActual('servicos');
    };

    const voltarAosCards = () => {
        setModoInicio('cards');
        setPesquisaQuery('');
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
                <Button sx={{ mt: 2 }} onClick={() => navigate('/home')}>Voltar</Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>Novo Agendamento</Typography>

            {passoActual !== 'inicio' && <StepIndicator passoActual={passoActual} />}

            {camundaErro && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCamundaErro('')}>
                    {camundaErro}
                </Alert>
            )}

            {passoActual === 'inicio' && (
                <PassoInicio
                    modo={modoInicio}
                    onClienteNovo={escolherClienteNovo}
                    onClienteRegistado={escolherClienteRegistado}
                    onVoltar={voltarAosCards}
                    pesquisaQuery={pesquisaQuery}
                    setPesquisaQuery={setPesquisaQuery}
                    pesquisaLoading={pesquisaLoading}
                    clientesFiltrados={clientesFiltradosInicio}
                    animaisFiltrados={animaisFiltradosInicio}
                    onSelecionarAnimal={selecionarAnimalPesquisa}
                />
            )}

            {passoActual === 'servicos' && (
                <PassoServicos
                    clienteRegistado={clienteRegistado}
                    porte={porte}
                    setPorte={setPorte}
                    portePodeMudar={listaCamunda.length === 0 && !processInstanceId}
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

            {passoActual === 'cliente' && (
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="h6" gutterBottom>Dados do Cliente e Animal</Typography>
                    <Typography variant="body2" sx={{ mb: 3 }} color="text.secondary">
                        Regista o cliente e o animal aqui. O agendamento só fica
                        confirmado depois do animal estar associado.
                    </Typography>

                    {!clienteRegistadoInline && (
                        <ClienteForm
                            onClienteCriado={handleClienteRegistadoInline}
                            submitLabel="Continuar para o Animal →"
                        />
                    )}

                    {clienteRegistadoInline && (
                        <AnimalForm
                            clienteId={clienteRegistadoInline.id}
                            clienteNome={clienteRegistadoInline.nome}
                            endpoint={`${API_BASE_URL}/clientes/${clienteRegistadoInline.id}/animais/confirmar`}
                            initialPorte={porte}
                            isFirst={true}
                            submitLabel="Confirmar Registo"
                            onAnimalCriado={continuarParaConfirmacao}
                            onCancelar={() => setClienteRegistadoInline(null)}
                        />
                    )}

                    <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                        <Button variant="outlined" color="error" onClick={cancelarTudo} disabled={camundaLoading}>
                            Cancelar agendamento
                        </Button>
                    </Stack>
                </Paper>
            )}

            {passoActual === 'confirmacao' && (
                <PassoConfirmacao
                    resumoFinal={resumoFinal}
                    onCancelar={() => finalizarAgendamento(false)}
                    onConfirmar={() => finalizarAgendamento(true)}
                    camundaLoading={camundaLoading}
                />
            )}

            {passoActual === 'finalizado' && (
                <PassoFinalizado
                    resumoFinal={resumoFinal}
                    onIrParaAgenda={() => navigate('/calendar')}
                />
            )}
        </Box>
    );
}

// Sub-componentes

// Gate inicial - escolha entre cliente novo e cliente registado.
// Mapeia ao agendamento.bpmn: registado -> BP118/BP119; novo -> BP116 (registo tardio).
function PassoInicio({
    modo, onClienteNovo, onClienteRegistado, onVoltar,
    pesquisaQuery, setPesquisaQuery, pesquisaLoading,
    clientesFiltrados, animaisFiltrados, onSelecionarAnimal,
}) {
    if (modo === 'cards') {
        return (
            <Stack spacing={2} sx={{ mt: 2 }}>
                <Typography variant="body1" color="text.secondary">
                    Indique se o cliente já está registado ou é novo.
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <Paper
                        onClick={onClienteRegistado}
                        sx={{
                            p: 3, cursor: 'pointer', textAlign: 'center',
                            borderRadius: 3,
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                        }}
                        elevation={2}
                    >
                        <PersonSearchIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h6" gutterBottom>Cliente Registado</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Procurar por nome, email, telefone, NIF ou animal.
                        </Typography>
                    </Paper>
                    <Paper
                        onClick={onClienteNovo}
                        sx={{
                            p: 3, cursor: 'pointer', textAlign: 'center',
                            borderRadius: 3,
                            transition: 'all 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                        }}
                        elevation={2}
                    >
                        <PersonAddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h6" gutterBottom>Cliente Novo</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Os dados do cliente são pedidos no fim, após confirmação do horário e preço.
                        </Typography>
                    </Paper>
                </Box>
            </Stack>
        );
    }

    // modo === 'pesquisa'
    return (
        <Stack spacing={2} sx={{ mt: 2 }}>
            <Paper
                elevation={1}
                sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderRadius: 3 }}
            >
                <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                <InputBase
                    fullWidth
                    autoFocus
                    placeholder="Pesquisar por nome, email, telefone, NIF ou nome de animal..."
                    value={pesquisaQuery}
                    onChange={(e) => setPesquisaQuery(e.target.value)}
                    inputProps={{ 'data-testid': 'pesquisa-inicio-input' }}
                />
                {pesquisaLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
                {pesquisaQuery && (
                    <IconButton size="small" onClick={() => setPesquisaQuery('')} aria-label="Limpar pesquisa">
                        <ClearIcon fontSize="small" />
                    </IconButton>
                )}
            </Paper>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Clientes ({clientesFiltrados.length})
                    </Typography>
                    {clientesFiltrados.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            Nenhum cliente encontrado.
                        </Typography>
                    ) : (
                        <Stack spacing={0}>
                            {clientesFiltrados.map((c) => (
                                <ClienteCard
                                    key={c.id}
                                    cliente={c}
                                    onAnimalClick={onSelecionarAnimal}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>

                <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Animais ({animaisFiltrados.length})
                    </Typography>
                    {animaisFiltrados.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            Nenhum animal encontrado.
                        </Typography>
                    ) : (
                        <Stack spacing={0}>
                            {animaisFiltrados.map((a) => (
                                <AnimalCard
                                    key={`${a.id}-${a.cliente?.id || ''}`}
                                    animal={a}
                                    onClick={() => onSelecionarAnimal(a)}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>
            </Box>

            <Box>
                <Button onClick={onVoltar} size="small">← Voltar</Button>
            </Box>
        </Stack>
    );
}

export function PassoServicos({
    clienteRegistado, porte, setPorte, portePodeMudar,
    opcoesServico, regraPrecoNova, setRegraPrecoNova,
    adicionarServico, listaCamunda, removerServico,
    totaisLocais, onCancelar, onConfirmar, camundaLoading,
}) {
    const podeConfirmar = listaCamunda.length > 0 && !camundaLoading;

    return (
        <>
            {!clienteRegistado && (
                <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Animal</Typography>
                    <FormControl fullWidth disabled={!portePodeMudar}>
                        <InputLabel id="porte-label">Porte</InputLabel>
                        <Select
                            labelId="porte-label"
                            label="Porte"
                            value={porte}
                            onChange={(e) => setPorte(e.target.value)}
                        >
                            {PORTES.map((p) => (
                                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {!portePodeMudar && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Para alterar o porte do animal, cancele e recomece.
                        </Typography>
                    )}
                </Paper>
            )}

            {porte && (
                <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        {listaCamunda.length === 0 ? 'Adicionar serviço' : 'Adicionar mais um serviço'}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <FormControl fullWidth>
                            <InputLabel id="servico-label">Serviço</InputLabel>
                            <Select
                                labelId="servico-label"
                                label="Serviço"
                                value={regraPrecoNova}
                                onChange={(e) => setRegraPrecoNova(e.target.value)}
                            >
                                {opcoesServico.length === 0 && (
                                    <MenuItem disabled value="">Sem serviços disponíveis para este porte</MenuItem>
                                )}
                                {opcoesServico.map((o) => (
                                    <MenuItem key={o.regraId} value={o.regraId}>
                                        {o.nome} - {o.duracaoMinutos} min - {o.precoBase}€
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="outlined"
                            onClick={adicionarServico}
                            disabled={!regraPrecoNova || camundaLoading}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            {camundaLoading ? <CircularProgress size={20} /> : '+ Adicionar'}
                        </Button>
                    </Stack>
                </Paper>
            )}

            {listaCamunda.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Serviços adicionados</Typography>
                    <Stack spacing={1}>
                        {listaCamunda.map((s, i) => (
                            <Box
                                key={`${s.tipoServicoId}-${i}`}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 2, p: 1,
                                    border: '1px solid #ddd', borderRadius: 1,
                                }}
                            >
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => removerServico(s.tipoServicoId)}
                                    disabled={camundaLoading}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                                <Typography sx={{ flex: 1 }}><b>{s.nome || s.nomeServico}</b></Typography>
                                <Typography variant="body2">{s.duracaoMinutos} min</Typography>
                                <Typography variant="body2">{s.precoBase}€</Typography>
                            </Box>
                        ))}
                    </Stack>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                            <b>Total:</b> {totaisLocais.duracao} min - {totaisLocais.valor}€
                        </Typography>
                    </Box>
                </Paper>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button variant="outlined" color="error" onClick={onCancelar} disabled={camundaLoading}>
                    Cancelar
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" onClick={onConfirmar} disabled={!podeConfirmar}>
                    {camundaLoading ? <CircularProgress size={20} /> : 'Confirmar e avançar'}
                </Button>
            </Stack>
        </>
    );
}

export function PassoHorario({
    listaCamunda, totaisLocais,
    dataPreferida, setDataPreferida, horaPreferida, setHoraPreferida,
    funcionariosElegiveis, funcionarioPreferidoId, setFuncionarioPreferidoId,
    gerarOpcoes, opcoesComNomes,
    indiceOpcao, setIndiceOpcao,
    onCancelarOpcoes, onConfirmarOpcao, onCancelarTudo, camundaLoading,
}) {
    const opcoesGeradas = opcoesComNomes.length > 0;
    const podeGerar = Boolean(dataPreferida) && Boolean(horaPreferida);

    return (
        <>
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, backgroundColor: '#fafafa' }}>
                <Typography variant="body2">
                    <b>{listaCamunda.length}</b> serviço(s) - {totaisLocais.duracao} min - {totaisLocais.valor}€
                </Typography>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Data e hora preferida</Typography>
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <TextField
                        type="date"
                        label="Data"
                        value={dataPreferida}
                        onChange={(e) => setDataPreferida(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ min: hojeISO() }}
                        sx={{ flex: 1 }}
                    />
                    <TextField
                        type="time"
                        label="Hora"
                        value={horaPreferida}
                        onChange={(e) => setHoraPreferida(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                    />
                </Stack>
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="func-pref-label">Funcionário preferido (opcional)</InputLabel>
                    <Select
                        labelId="func-pref-label"
                        label="Funcionário preferido (opcional)"
                        value={funcionarioPreferidoId}
                        onChange={(e) => setFuncionarioPreferidoId(e.target.value)}
                    >
                        <MenuItem value="">Sem preferência</MenuItem>
                        {funcionariosElegiveis.map((f) => (
                            <MenuItem key={f.id} value={f.id}>{f.nomeCompleto}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {/*<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    O sistema procura disponibilidade nesta data e nos 6 dias seguintes.
                </Typography>*/}
                <Button
                    variant="contained"
                    onClick={gerarOpcoes}
                    disabled={!podeGerar || camundaLoading || opcoesGeradas}
                >
                    {camundaLoading ? <CircularProgress size={20} /> : 'Gerar opções'}
                </Button>
            </Paper>

            {opcoesGeradas && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Opções disponíveis</Typography>
                    <Stack spacing={2}>
                        {opcoesComNomes.map((op) => (
                            <CartaoOpcao
                                key={op.idx}
                                opcao={op}
                                selecionada={indiceOpcao === op.idx}
                                onSelecionar={() => setIndiceOpcao(op.idx)}
                                disabled={camundaLoading}
                            />
                        ))}
                    </Stack>
                </Box>
            )}

            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button variant="outlined" color="error" onClick={onCancelarTudo} disabled={camundaLoading}>
                    Cancelar agendamento
                </Button>
                {opcoesGeradas && (
                    <Button variant="outlined" onClick={onCancelarOpcoes} disabled={camundaLoading}>
                        Limpar opções
                    </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Button
                    variant="contained"
                    onClick={onConfirmarOpcao}
                    disabled={indiceOpcao === null || camundaLoading}
                >
                    {camundaLoading ? <CircularProgress size={20} /> : 'Confirmar'}
                </Button>
            </Stack>
        </>
    );
}

function CartaoOpcao({ opcao, selecionada, onSelecionar, disabled }) {
    const data = new Date(opcao.dataHoraInicio);
    const dataLabel = `${String(data.getUTCDate()).padStart(2, '0')}/${String(data.getUTCMonth() + 1).padStart(2, '0')}/${data.getUTCFullYear()}`;
    const inicioHora = fmtHoraUTC(opcao.dataHoraInicio);
    const fimHora = fmtHoraUTC(opcao.dataHoraFim);

    return (
        <Paper
            variant={selecionada ? 'elevation' : 'outlined'}
            elevation={selecionada ? 4 : 0}
            sx={{
                p: 2,
                borderRadius: 3,
                cursor: disabled ? 'default' : 'pointer',
                borderColor: selecionada ? 'primary.main' : undefined,
                borderWidth: selecionada ? 2 : 1,
                borderStyle: 'solid',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.15s',
                '&:hover': disabled ? {} : { borderColor: 'primary.light' },
            }}
            onClick={() => !disabled && onSelecionar()}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Opção {opcao.idx + 1} - {dataLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {inicioHora} → {fimHora} · {opcao.duracaoTotal} min · {opcao.valorTotal}€
                </Typography>
            </Box>

            <Stack spacing={1} sx={{ mt: 1 }}>
                {opcao.servicos.map((s, i) => (
                    <Box key={i} sx={{ pl: 1, borderLeft: '2px solid #e0e0e0' }}>
                        <Typography variant="body2">
                            <b>{fmtHoraUTC(s.dataHoraInicio)}–{fmtHoraUTC(s.dataHoraFim)}</b>{' '}
                            <span style={{ fontWeight: 600 }}>{s.nomeServico}</span>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {s.nomeFuncionario} · {s.nomeSala}
                        </Typography>
                        {s.outrosFuncionariosNomes.length > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Também disponíveis: {s.outrosFuncionariosNomes.join(', ')}
                            </Typography>
                        )}
                    </Box>
                ))}
            </Stack>

            {selecionada && (
                <Box sx={{ mt: 2, textAlign: 'right' }}>
                    <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                        ✓ Opção selecionada
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

function fmtDataPT(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function PassoConfirmacao({
    resumoFinal,
    onCancelar,
    onConfirmar,
    camundaLoading,
    labelCancelar = 'Cancelar agendamento',
    labelConfirmar = 'Confirmar agendamento',
    textoIntro = 'Confirme os dados do agendamento. Ao confirmar, o agendamento vai ser gravado na Agenda.',
}) {
    if (!resumoFinal) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }} color="text.secondary">A carregar resumo…</Typography>
            </Paper>
        );
    }

    const op = resumoFinal.opcaoSelecionada || {};

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Confirmação</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {textoIntro}
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, backgroundColor: '#fafafa' }}>
                <Stack spacing={1.5}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Cliente</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{resumoFinal.clienteNome || '--'}</Typography>
                    </Box>

                    <Box>
                        <Typography variant="caption" color="text.secondary">Animal</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{resumoFinal.animalNome || '--'}</Typography>
                    </Box>

                    <Box>
                        <Typography variant="caption" color="text.secondary">Data e hora</Typography>
                        <Typography variant="body1">
                            <b>{fmtDataPT(op.dataHoraInicio)}</b> · {fmtHoraUTC(op.dataHoraInicio)} → {fmtHoraUTC(op.dataHoraFim)}
                        </Typography>
                    </Box>

                    <Divider />

                    <Typography variant="caption" color="text.secondary">Serviços</Typography>
                    <Stack spacing={0.5}>
                        {(resumoFinal.servicos || []).map((s, i) => (
                            <Box
                                key={i}
                                sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.5 }}
                            >
                                <Chip size="small" label={s.ordem ?? i + 1} />
                                <Typography sx={{ flex: 1 }}><b>{s.nome}</b></Typography>
                                <Typography variant="body2" color="text.secondary">{s.duracao} min</Typography>
                                <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'right' }}>{s.preco}€</Typography>
                            </Box>
                        ))}
                    </Stack>

                    <Divider />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                            Total: <b>{resumoFinal.duracaoTotalMinutos} min</b>
                        </Typography>
                        <Typography variant="body2">
                            Valor: <b>{resumoFinal.valorEstimado}€</b>
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            <Stack direction="row" spacing={2}>
                <Button variant="outlined" color="error" onClick={onCancelar} disabled={camundaLoading}>
                    {labelCancelar}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button variant="contained" color="success" onClick={onConfirmar} disabled={camundaLoading}>
                    {camundaLoading ? <CircularProgress size={20} /> : labelConfirmar}
                </Button>
            </Stack>
        </Paper>
    );
}

export function PassoFinalizado({
    resumoFinal,
    onIrParaAgenda,
    titulo = '✓ Agendamento confirmado!',
    subtitulo = 'O agendamento foi gravado com sucesso. Se o cliente tem email, foi enviada uma confirmação por e-mail.',
}) {
    const op = resumoFinal?.opcaoSelecionada || {};
    return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: 'success.main', mb: 1 }}>
                {titulo}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {subtitulo}
            </Typography>

            {resumoFinal && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3, textAlign: 'left', backgroundColor: '#f6fbf6' }}>
                    <Typography variant="body2">
                        <b>{resumoFinal.clienteNome}</b> · <b>{resumoFinal.animalNome}</b> - {fmtDataPT(op.dataHoraInicio)} às {fmtHoraUTC(op.dataHoraInicio)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {(resumoFinal.servicos || []).map((s) => s.nome).join(' → ')} · {resumoFinal.duracaoTotalMinutos} min · {resumoFinal.valorEstimado}€
                    </Typography>
                </Paper>
            )}

            <Button variant="contained" onClick={onIrParaAgenda}>
                Ver agenda
            </Button>
        </Paper>
    );
}
