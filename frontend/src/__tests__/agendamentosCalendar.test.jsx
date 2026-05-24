import { COR_POR_ESTADO, mapAgendamentosToEvents } from "../utils/agendamentosCalendar";

describe("agendamentosCalendar utils", () => {
  test("mapeia eventos com a paleta verde B&T e texto legivel", () => {
    const events = mapAgendamentosToEvents([
      {
        id: "ag-1",
        estado: "CONFIRMADO",
        animal: { nome: "Rex", cliente: { utilizador: { nome: "Joao" } } },
        servicos: [
          {
            id: "svc-1",
            dataHoraInicio: "2026-05-25T10:00:00.000Z",
            dataHoraFim: "2026-05-25T10:40:00.000Z",
            tipoServico: { tipo: "BANHO" },
            funcionario: { utilizador: { nome: "Miguel Torres" } },
            sala: { nome: "Sala de Banho 1" },
          },
        ],
      },
    ]);

    expect(COR_POR_ESTADO.CONFIRMADO.bg).toBe("#475C51");
    expect(events[0]).toMatchObject({
      backgroundColor: "#475C51",
      borderColor: "#32433b",
      textColor: "#ffffff",
    });
  });
});
