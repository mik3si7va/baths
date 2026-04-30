import React, { createContext, useContext } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const value = {
    colors: {
      primary: "#475C51",
      background: "#F5F0E8",
      text: "#102622",
      textSecondary: "#666666",
      white: "#FFFFFF",
      black: "#000000",
      headerOverlay: "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent)",
    },
    cardStyles: {
      borderRadius: 3,
    },
    sizes: {
      headerHeight: { xs: 180, sm: 210, md: 240 },
      logoFont: { xs: "30px", sm: "50px" },
      buttonFont: { xs: "13px", sm: "16px" },
    },
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext deve ser usado dentro de ThemeProvider");
  }
  return context;
};
