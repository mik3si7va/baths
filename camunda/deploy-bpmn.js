// camunda/deploy-bpmn.js
// Deploy BPMN and Form files to Camunda 7 (Docker)

const fs = require("fs");
const path = require("path");

async function main() {
  const CAMUNDA_URL = process.env.CAMUNDA_URL || "http://localhost:8080/engine-rest";

  console.log("Waiting for Camunda...");
  await waitForCamunda(CAMUNDA_URL);

  const workflowsDir = path.join(__dirname, "workflows");
  const formsDir = path.join(__dirname, "forms");

  if (!fs.existsSync(workflowsDir)) {
    console.error("camunda/workflows/ folder not found:", workflowsDir);
    process.exit(1);
  }

  const bpmnFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".bpmn"));
  const formFiles = fs.existsSync(formsDir)
    ? fs.readdirSync(formsDir).filter((f) => f.endsWith(".form"))
    : [];

  const deployableFiles = [
    ...bpmnFiles.map((file) => ({ dir: workflowsDir, file })),
    ...formFiles.map((file) => ({ dir: formsDir, file })),
  ];

  if (deployableFiles.length === 0) {
    console.log("No .bpmn or .form files found. Nothing to deploy.");
    return;
  }

  // Node 18+ has fetch and FormData built-in
  const form = new FormData();
  for (const item of deployableFiles) {
    const filePath = path.join(item.dir, item.file);
    const blob = new Blob([fs.readFileSync(filePath)], { type: "text/xml" });
    // Use a unique multipart field per resource so Camunda stores all files in one deployment.
    form.append(item.file, blob, item.file);
  }
  form.append("deployment-name", `baths-workflows-${Date.now()}`);

  console.log(
    `Deploying ${bpmnFiles.length} BPMN and ${formFiles.length} form file(s) to: http://localhost:8080`
  );

  const res = await fetch(`${CAMUNDA_URL}/deployment/create`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Deployment failed: ${res.status} ${res.statusText}\n${txt}`);
  }

  const json = await res.json();
  console.log("Deployed! Deployment id:", json.id);
}

async function waitForCamunda(url, tries = 30) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(`${url}/engine`);
      if (r.ok) return true;
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Camunda not reachable yet. Try again in a few seconds.");
}

main().catch((err) => {
  console.error("ERROR DETAILS:");
  console.error(err);
  process.exit(1);
});
