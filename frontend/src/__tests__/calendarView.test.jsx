import React from "react";
import { render } from "@testing-library/react";
import CalendarView from "../components/calendarView";

const mockFullCalendar = jest.fn(() => <div data-testid="full-calendar" />);

jest.mock("@fullcalendar/react", () => ({
  __esModule: true,
  default: (props) => mockFullCalendar(props),
}));

describe("CalendarView", () => {
  beforeEach(() => {
    mockFullCalendar.mockClear();
  });

  test("renderiza eventos como blocos para manter cor visivel na vista mensal", () => {
    render(<CalendarView events={[]} />);

    expect(mockFullCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        eventDisplay: "block",
      }),
    );
  });
});
