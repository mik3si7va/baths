import { Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <Stack spacing={2}>
      <Typography variant="h1">Ola, {user?.name}</Typography>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1}>
          <Typography variant="h2">Home privada</Typography>
          <Typography color="text.secondary">
            Esta e a base limpa da AppClient. Daqui podes acrescentar perfil, animais e
            marcacoes sem carregar a confusao antiga.
          </Typography>
          <Typography color="text.secondary">
            Bora Kitty!!.. time to code hehe! ... I believe in YOU! 🥳🥳👌
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
