// camunda/deploy-bpmn.js
// Deploy all BPMN files in /workflows to Camunda 7 (Docker)

const fs = require("fs");
const path = require("path");

async function main() {
  const CAMUNDA_URL = process.env.CAMUNDA_URL || "http://localhost:8080/engine-rest";

  console.log("Waiting for Camunda...");
  await waitForCamunda(CAMUNDA_URL);

  console.log("Camunda ready. Deploying BPMN...");

  const workflowsDir = path.join(__dirname, "..", "workflows");

  if (!fs.existsSync(workflowsDir)) {
    console.error("workflows/ folder not found:", workflowsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith(".bpmn"));
  if (files.length === 0) {
    console.log("No .bpmn files found in workflows/. Nothing to deploy.");
    return;
  }

  // Node 18+ has fetch and FormData built-in
  const form = new FormData();
  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    const blob = new Blob([fs.readFileSync(filePath)], { type: "text/xml" });
    form.append("data", blob, file);
  }
  form.append("deployment-name", `baths-workflows-${Date.now()}`);

  console.log(`Deploying ${files.length} BPMN file(s) to: http://localhost:8080`);

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
