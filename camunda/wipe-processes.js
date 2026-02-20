// camunda/wipe-processes.js
// Delete all Camunda deployments (and related process instances/definitions) without touching users.

async function main() {
  const camundaUrl = process.env.CAMUNDA_URL || "http://localhost:8080/engine-rest";

  console.log(`Loading deployments from: ${camundaUrl}`);
  const res = await fetch(`${camundaUrl}/deployment`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to list deployments: ${res.status} ${res.statusText}\n${txt}`);
  }

  const deployments = await res.json();
  if (!Array.isArray(deployments) || deployments.length === 0) {
    console.log("No deployments found. Nothing to wipe.");
    return;
  }

  console.log(`Found ${deployments.length} deployment(s). Deleting...`);

  for (const dep of deployments) {
    const id = dep.id;
    const name = dep.name || "(no-name)";
    const del = await fetch(
      `${camundaUrl}/deployment/${id}?cascade=true&skipCustomListeners=true&skipIoMappings=true`,
      { method: "DELETE" }
    );

    if (!del.ok) {
      const txt = await del.text();
      throw new Error(`Failed deleting deployment '${name}' (${id}): ${del.status} ${del.statusText}\n${txt}`);
    }

    console.log(`Deleted deployment '${name}' (${id})`);
  }

  console.log("Process data cleanup complete. Users remain in the identity tables.");
}

main().catch((err) => {
  console.error("ERROR DETAILS:");
  console.error(err);
  process.exit(1);
});
