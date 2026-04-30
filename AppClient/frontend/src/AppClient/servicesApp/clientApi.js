const API_BASE_URL =
  process.env.REACT_APP_CLIENT_API_URL || "http://localhost:5001";

async function requestJson(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch {
    throw new Error("Nao foi possivel ligar ao servidor.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Nao foi possivel concluir o pedido.");
  }

  return data;
}

export function createClientRegistration(data) {
  return requestJson("/clientes", {
    method: "POST",
    body: JSON.stringify({
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      password: data.password,
      nif: data.nif,
      morada: data.morada,
    }),
  });
}
