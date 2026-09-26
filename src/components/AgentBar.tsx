import { useState } from "react";
import type { BrowserAction, Space } from "../../shared/types";
import type { AgentStatus } from "../lib/spaces";
import { agentBarCopy } from "../copy";
import "./AgentBar.css";

export function AgentBar({
  space,
  status,
  attempt,
}: {
  space: Space;
  status: AgentStatus;
  attempt: (action: BrowserAction) => Promise<string>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function run(action: BrowserAction) {
    setConfirming(false);
    setError(await attempt(action));
  }
  return (
    <div className="agent-bar" role="region" aria-label={space.name}>
      <span
        className={`agent-indicator ${status} color-${space.color}`}
        aria-hidden="true"
      />
      <span className="agent-bar-status" role="status">
        {space.name} · {agentBarCopy.status[status]}
      </span>
      {confirming ? (
        <>
          <span className="agent-bar-question">{agentBarCopy.confirmStop}</span>
          <button
            type="button"
            className="agent-bar-danger"
            onClick={() =>
              run({
                type: "settings:update",
                settings: { automationEnabled: false },
              })
            }
          >
            {agentBarCopy.stop}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {agentBarCopy.cancel}
          </button>
        </>
      ) : space.owner === "agent" ? (
        <>
          <button
            type="button"
            onClick={() =>
              run({ type: "space:ownership", id: space.id, owner: "human" })
            }
          >
            {agentBarCopy.takeOver}
          </button>
          {status !== "paused" && (
            <button type="button" onClick={() => setConfirming(true)}>
              {agentBarCopy.stop}
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() =>
            run({ type: "space:ownership", id: space.id, owner: "agent" })
          }
        >
          {agentBarCopy.letContinue}
        </button>
      )}
      {error && (
        <p className="agent-bar-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
