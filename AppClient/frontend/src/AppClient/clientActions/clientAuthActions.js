import { createClientRegistration } from "../servicesApp/clientApi";

const CLIENT_SESSION_KEY = "clientB&T";
const CLIENT_PROFILE_KEY = "clientProfileB&T";

export function getClientSession() 
{
  const session = localStorage.getItem(CLIENT_SESSION_KEY);

  try 
  {
    return session ? JSON.parse(session) : null;
  } catch 
  {
    return null;
  }
}

export async function loginClient(credentials) 
{
  const email = credentials?.email?.trim();
  const password = credentials?.password;

  if (!email || !password) 
    {
    throw new Error("Preenche o email e a palavra-passe.");
  }

  const profile = 
  {
    email,
    nome: email.split("@")[0],
    estadoConta: "ATIVA",
  };

  localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export async function registerClient(data) 
{
  const nome = data?.nome?.trim();
  const email = data?.email?.trim();
  const telefone = data?.telefone?.trim();
  const password = data?.password;
  const confirmPassword = data?.confirmPassword;

  if (!nome || !email || !telefone || !password || !confirmPassword) 
    {
    throw new Error("Preenche todos os campos obrigatorios.");
  }

  if (password.trim().length < 8) 
    {
    throw new Error("A palavra-passe deve ter pelo menos 8 caracteres.");
  }

  if (password !== confirmPassword) 
    {
    throw new Error("As palavras-passe nao coincidem.");
  }

  const profile = await createClientRegistration({
    nome,
    email,
    telefone,
    password,
    nif: data?.nif?.trim() || "",
    morada: data?.morada?.trim() || "",
  });

  localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(profile));
  return profile;
}

export function logoutClient()
{
  localStorage.removeItem(CLIENT_SESSION_KEY);
  localStorage.removeItem(CLIENT_PROFILE_KEY);
}
