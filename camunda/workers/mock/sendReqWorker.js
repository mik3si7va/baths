const { Client, logger, Variables } = require("camunda-external-task-client-js");
const REFUSE_HELP = "REFUSE_HELP";

// configuration for the Client:
// - 'baseUrl': url to the Process Engine
// - 'use': logger utility to automatically log important events
const config = { baseUrl: "http://localhost:8080/engine-rest", use: logger };

// create a Client instance with custom configuration
const client = new Client(config);

// subscribe to the topic: "sendReq"
client.subscribe("sendReq", async function ({ task, taskService }) {
  const helpChoice = task.variables.get("help");
  console.log("Mock sendReq worker received help =", helpChoice);

  const bookChoice = task.variables.get("book");
  console.log("Mock sendReq worker received book =", bookChoice);

  const mockResponse = "Mock request sent successfully. Help: " + helpChoice + ", Book: " + bookChoice;
  const processVariables = new Variables();
  processVariables.set("sendReqResponse", mockResponse);
  processVariables.set("sendReqOk", true);

  if (typeof bookChoice === "string" && bookChoice.includes("ALICE")) {
    await taskService.complete(task, processVariables);
  } else {
    await taskService.handleBpmnError(
      task,
      REFUSE_HELP,
      "Sorry! We're super busy, you are not getting help right now."
    );
  }
});
