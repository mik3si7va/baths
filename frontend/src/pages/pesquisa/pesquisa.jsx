import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  InputBase,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
  Button,
  ButtonGroup,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import PetsIcon from "@mui/icons-material/Pets";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ClearIcon from "@mui/icons-material/Clear";
import { useThemeContext } from "../../contexts/ThemeContext";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function ResultCard({
  label,
  icon: Icon,
  subtitle,
  onClick,
  active,
  chipColor,
  detail,
}) {
  return (
    <Paper
      onMouseDown={onClick}
      sx={{
        p: 2,
        mb: 1,
        borderRadius: 3,
        cursor: "pointer",
        border: "1px solid",
        borderColor: active ? "primary.main" : "divider",
        backgroundColor: active
          ? "rgba(25, 118, 210, 0.06)"
          : "background.paper",
        transition: "background-color 0.2s ease",
        overflow: "hidden",
      }}
      elevation={active ? 3 : 1}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1.25,
          minWidth: 0,
        }}
      >
        <Icon sx={{ color: chipColor, fontSize: 18, flexShrink: 0 }} />
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            flex: 1,
            minWidth: 0,
          }}
        >
          {label}
        </Typography>
        <Chip
          label={detail}
          size="small"
          sx={{ ml: "auto", fontSize: 11, fontWeight: 700 }}
          color={chipColor === "primary" ? "primary" : "default"}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          whiteSpace: "normal",
        }}
      >
        {subtitle}
      </Typography>
    </Paper>
  );
}

export default function Pesquisa() {
  const { colors } = useThemeContext();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [filterMode, setFilterMode] = useState("both");
  const [animalAgendamentos, setAnimalAgendamentos] = useState({
    futuros: [],
    historico: [],
  });
  const [animalAgendamentosLoading, setAnimalAgendamentosLoading] =
    useState(false);
  const [animalAgendamentosError, setAnimalAgendamentosError] = useState(null);

  const showClientes = filterMode !== "animals";
  const showAnimais = filterMode !== "clients";

  const carregarClientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes`);
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch {
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedAnimal) {
      setAnimalAgendamentos({ futuros: [], historico: [] });
      setAnimalAgendamentosError(null);
      setAnimalAgendamentosLoading(false);
      return;
    }

    const loadAgendamentos = async () => {
      setAnimalAgendamentosLoading(true);
      setAnimalAgendamentosError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/animais/${selectedAnimal.id}/agendamentos`,
        );
        if (!response.ok) {
          throw new Error("Falha ao carregar agendamentos.");
        }

        const data = await response.json();
        if (cancelled) return;

        setAnimalAgendamentos({
          futuros: Array.isArray(data.agendamentosFuturos)
            ? data.agendamentosFuturos
            : [],
          historico: Array.isArray(data.historico) ? data.historico : [],
        });
      } catch (error) {
        if (!cancelled) {
          setAnimalAgendamentosError(
            "Não foi possível carregar os agendamentos do animal.",
          );
          setAnimalAgendamentos({ futuros: [], historico: [] });
        }
      } finally {
        if (!cancelled) setAnimalAgendamentosLoading(false);
      }
    };

    loadAgendamentos();

    return () => {
      cancelled = true;
    };
  }, [selectedAnimal]);

  const animais = useMemo(
    () =>
      clientes.flatMap((cliente) =>
        (cliente.animais ?? []).map((animal) => ({
          ...animal,
          cliente,
        })),
      ),
    [clientes],
  );

  const termo = query.trim().toLowerCase();

  const clientesFiltrados = useMemo(() => {
    if (!termo) return clientes;
    return clientes.filter((cliente) => {
      return (
        cliente.nome?.toLowerCase().includes(termo) ||
        cliente.email?.toLowerCase().includes(termo) ||
        cliente.telefone?.includes(termo)
      );
    });
  }, [clientes, termo]);

  const animaisFiltrados = useMemo(() => {
    if (!termo) return animais;
    return animais.filter((animal) =>
      animal.nome?.toLowerCase().includes(termo),
    );
  }, [animais, termo]);

  const handleSelectCliente = (cliente) => {
    setSelectedAnimal(null);
    setSelectedCliente(cliente);
  };

  const handleSelectAnimal = (animal) => {
    setSelectedCliente(null);
    setSelectedAnimal(animal);
  };

  const handleFilterMode = (mode) => {
    setFilterMode(mode);
    setSelectedCliente(null);
    setSelectedAnimal(null);
  };

  const clearSelection = () => {
    setSelectedCliente(null);
    setSelectedAnimal(null);
  };

  const formatDateTime = (value) =>
    new Date(value).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const animalServiceHistory = useMemo(
    () =>
      animalAgendamentos.historico.flatMap((agendamento) =>
        (agendamento.servicos || []).map((servico) => ({
          ...servico,
          agendamentoId: agendamento.id,
          dataHoraInicio: agendamento.dataHoraInicio,
        })),
      ),
    [animalAgendamentos.historico],
  );

  const renderClienteDetails = () => {
    if (!selectedCliente) return null;

    return (
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PersonIcon sx={{ color: colors.primary }} />
          <Typography variant="h2">Ficha do Cliente</Typography>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {selectedCliente.nome}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <EmailIcon sx={{ fontSize: 16, mr: 1, verticalAlign: "sub" }} />
          {selectedCliente.email || "--"}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          <PhoneIcon sx={{ fontSize: 16, mr: 1, verticalAlign: "sub" }} />
          {selectedCliente.telefone || "--"}
        </Typography>
        {selectedCliente.morada && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <LocationOnIcon
              sx={{ fontSize: 16, mr: 1, verticalAlign: "sub" }}
            />
            {selectedCliente.morada}
          </Typography>
        )}
        {selectedCliente.nif && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            NIF: {selectedCliente.nif}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Animais associados ({selectedCliente.animais?.length ?? 0})
        </Typography>
        {(selectedCliente.animais ?? []).length === 0 ? (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Este cliente ainda não tem animais registados.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 1 }}>
            {(selectedCliente.animais ?? []).map((animal) => (
              <Paper
                key={animal.id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  cursor: "pointer",
                  border: "1px solid transparent",
                  transition:
                    "background-color 0.2s ease, border-color 0.2s ease",
                  "&:hover": {
                    backgroundColor: "action.hover",
                    borderColor: "divider",
                  },
                }}
                elevation={0}
                onMouseDown={() =>
                  handleSelectAnimal({ ...animal, cliente: selectedCliente })
                }
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {animal.nome}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: colors.textSecondary }}
                >
                  {animal.especie}
                  {animal.raca ? ` · ${animal.raca}` : ""}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
        <Button sx={{ mt: 2 }} onClick={clearSelection}>
          Limpar seleção
        </Button>
      </Paper>
    );
  };

  const renderAnimalDetails = () => {
    if (!selectedAnimal) return null;

    return (
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PetsIcon sx={{ color: colors.primary }} />
            <Typography variant="h2">Ficha do Animal</Typography>
          </Box>
          <Button variant="contained" sx={{ whiteSpace: "nowrap" }}>
            Novo Agendamento
          </Button>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {selectedAnimal.nome}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Espécie: {selectedAnimal.especie || "--"}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Raça: {selectedAnimal.raca || "--"}
        </Typography>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Porte: {selectedAnimal.porte || "--"}
        </Typography>
        {selectedAnimal.dataNascimento && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Nascimento:{" "}
            {new Date(
              `${selectedAnimal.dataNascimento}T00:00:00`,
            ).toLocaleDateString("pt-PT")}
          </Typography>
        )}
        {selectedAnimal.alergias && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Alergias: {selectedAnimal.alergias}
          </Typography>
        )}
        {selectedAnimal.observacoes && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            Observações: {selectedAnimal.observacoes}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Cliente proprietário
        </Typography>
        {selectedAnimal.cliente ? (
          <Box sx={{ mt: 1, mb: 3 }}>
            <ResultCard
              label={selectedAnimal.cliente.nome}
              icon={PersonIcon}
              subtitle={`${selectedAnimal.cliente.email || "--"} · ${selectedAnimal.cliente.telefone || "--"}`}
              onClick={() => handleSelectCliente(selectedAnimal.cliente)}
              active={selectedCliente?.id === selectedAnimal.cliente.id}
              chipColor="primary"
              detail={`${selectedAnimal.cliente.animais?.length ?? 0} ${selectedAnimal.cliente.animais?.length === 1 ? "animal" : "animais"}`}
            />
          </Box>
        ) : (
          <Typography
            variant="body2"
            sx={{ color: colors.textSecondary, mb: 3 }}
          >
            Cliente não disponível.
          </Typography>
        )}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Agendamentos Futuros
          </Typography>
          {animalAgendamentosLoading ? (
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              A carregar agendamentos...
            </Typography>
          ) : animalAgendamentosError ? (
            <Typography variant="body2" sx={{ color: colors.error }}>
              {animalAgendamentosError}
            </Typography>
          ) : animalAgendamentos.futuros.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Não existem agendamentos futuros para este animal.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1 }}>
              {animalAgendamentos.futuros.map((agendamento) => (
                <Paper
                  key={agendamento.id}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: "action.hover",
                  }}
                  elevation={0}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatDateTime(agendamento.dataHoraInicio)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: colors.textSecondary }}
                  >
                    {agendamento.servicos
                      .map((servico) => servico.tipoServico)
                      .join(", ")}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Histórico de Serviços
          </Typography>
          {animalServiceHistory.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Ainda não há serviços registados para este animal.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1 }}>
              {animalServiceHistory.map((servico) => (
                <Paper
                  key={`${servico.id}-${servico.agendamentoId}`}
                  sx={{ p: 2, borderRadius: 2 }}
                  elevation={0}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {servico.tipoServico}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: colors.textSecondary, display: "block" }}
                  >
                    {formatDateTime(servico.dataHoraInicio)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: colors.textSecondary }}
                  >
                    {servico.precoNoMomento.toFixed(2)}€ ·{" "}
                    {servico.duracaoNoMomento} min
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Box>

        <Button sx={{ mt: 2 }} onClick={clearSelection}>
          Limpar seleção
        </Button>
      </Paper>
    );
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1, color: colors.text }}>
        Pesquisa de Clientes e Animais
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: colors.textSecondary }}>
        Pesquise por nome, email, telefone ou nome de animal para ver a ficha
        completa de clientes e os seus animais asociados.
      </Typography>

      <Paper
        elevation={1}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1,
          borderRadius: 3,
          mb: 4,
          borderColor: termo ? colors.primary : "divider",
        }}
      >
        <SearchIcon sx={{ color: colors.textSecondary, mr: 1 }} />
        <InputBase
          fullWidth
          placeholder="Pesquisar por nome, email, telefone ou nome de animal..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ fontSize: 14 }}
          inputProps={{ "data-testid": "pesquisa-input" }}
        />
        {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        {query && (
          <IconButton
            size="small"
            onClick={() => setQuery("")}
            aria-label="Limpar pesquisa"
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "420px 1fr" },
          gap: 3,
        }}
      >
        <Box>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <SearchIcon sx={{ color: colors.primary }} />
              <Typography variant="h2">Resultados</Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: colors.textSecondary, mb: 2 }}
            >
              {termo
                ? `Resultados para "${query}"`
                : "Abaixo estão todos os clientes e animais registados."}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
              <ButtonGroup
                size="small"
                variant="outlined"
                sx={{ flexWrap: "wrap" }}
              >
                <Button
                  variant={filterMode === "both" ? "contained" : "outlined"}
                  onClick={() => handleFilterMode("both")}
                >
                  Ambos {clientesFiltrados.length + animaisFiltrados.length}
                </Button>
                <Button
                  variant={filterMode === "clients" ? "contained" : "outlined"}
                  onClick={() => handleFilterMode("clients")}
                >
                  Clientes {clientesFiltrados.length}
                </Button>
                <Button
                  variant={filterMode === "animals" ? "contained" : "outlined"}
                  onClick={() => handleFilterMode("animals")}
                >
                  Animais {animaisFiltrados.length}
                </Button>
              </ButtonGroup>
            </Box>

            {!showClientes ||
            clientesFiltrados.length > 0 ||
            !showAnimais ||
            animaisFiltrados.length > 0 ? (
              <>
                {showClientes && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Clientes
                    </Typography>
                    {clientesFiltrados.length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{ color: colors.textSecondary }}
                      >
                        Nenhum cliente encontrado.
                      </Typography>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <ResultCard
                          key={cliente.id}
                          label={cliente.nome}
                          icon={PersonIcon}
                          subtitle={`${cliente.email || "--"} · ${cliente.telefone || "--"}`}
                          onClick={() => handleSelectCliente(cliente)}
                          active={selectedCliente?.id === cliente.id}
                          chipColor="primary"
                          detail={`${cliente.animais?.length ?? 0} ${cliente.animais?.length === 1 ? "animal" : "animais"}`}
                        />
                      ))
                    )}
                  </Box>
                )}

                {showAnimais && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Animais
                    </Typography>
                    {animaisFiltrados.length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{ color: colors.textSecondary }}
                      >
                        Nenhum animal encontrado.
                      </Typography>
                    ) : (
                      animaisFiltrados.map((animal) => (
                        <ResultCard
                          key={`${animal.id}-${animal.cliente?.id || ""}`}
                          label={animal.nome}
                          icon={PetsIcon}
                          subtitle={`${animal.especie || "--"} · ${animal.cliente?.nome || "--"}`}
                          onClick={() => handleSelectAnimal(animal)}
                          active={selectedAnimal?.id === animal.id}
                          chipColor="default"
                          detail={
                            animal.cliente?.nome
                              ? `Cliente: ${animal.cliente.nome}`
                              : "Animal"
                          }
                        />
                      ))
                    )}
                  </Box>
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Nenhum resultado encontrado.
              </Typography>
            )}
          </Paper>
        </Box>

        <Box>
          {selectedCliente ? (
            renderClienteDetails()
          ) : selectedAnimal ? (
            renderAnimalDetails()
          ) : (
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h2" sx={{ mb: 2 }}>
                Selecione um cliente ou animal
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Clique num resultado à esquerda para ver a ficha completa.
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}
