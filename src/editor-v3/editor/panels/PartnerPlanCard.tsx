import { useState } from "react";
import * as s from "./PartnerMode.styles";
import type { PartnerMessage } from "@/state/partnerStore";

/** Day 45 — structured plan card.
 *
 * Renders the assistant's planning-stage `plan` object as a checklist
 * of steps. User can:
 *   - Approve  → fires the steps in one history stroke
 *   - Edit     → reveals a textarea, user types changes, AI re-plans
 *   - Reject   → AI revises with no notes
 *
 * Once executed, the card swaps to a cream border + "Built" tag. Once
 * rejected, it dims to ghost-border. */

export function PartnerPlanCard(props: {
  message: PartnerMessage;
  onApprove: (id: string) => void;
  onEdit: (id: string, notes: string) => void;
  onReject: (id: string) => void;
}) {
  const { message } = props;
  const plan = message.plan;
  const [editOpen, setEditOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  if (!plan) return null;

  const status = message.planStatus ?? "pending";
  const cardStyle =
    status === "executed" ? s.planCardExecuted :
    status === "rejected" ? s.planCardRejected :
                            s.planCard;

  function submitEdit() {
    const trimmed = editNotes.trim();
    if (!trimmed) return;
    props.onEdit(message.id, trimmed);
    setEditOpen(false);
    setEditNotes("");
  }

  return (
    <div style={cardStyle} data-testid="partner-plan-card">
      <p style={s.planTitle}>{plan.title}</p>
      <ul style={s.planStepsList}>
        {plan.steps.map((step, i) => (
          <li key={i} style={s.planStep}>
            <span style={s.planStepGlyph}>•</span>
            <span style={s.planStepDescription}>
              {step.description}
              <span style={s.planStepTool}>{step.tool}</span>
            </span>
          </li>
        ))}
      </ul>

      {status === "pending" && !editOpen && (
        <div style={s.planActions}>
          <button
            type="button"
            style={s.approveBtn}
            onClick={() => props.onApprove(message.id)}
            data-testid="partner-plan-approve"
          >
            Approve
          </button>
          <button
            type="button"
            style={s.editBtn}
            onClick={() => setEditOpen(true)}
            data-testid="partner-plan-edit"
          >
            Edit
          </button>
          <button
            type="button"
            style={s.rejectBtn}
            onClick={() => props.onReject(message.id)}
            data-testid="partner-plan-reject"
          >
            Reject
          </button>
        </div>
      )}

      {status === "pending" && editOpen && (
        <div style={s.editForm} data-testid="partner-plan-edit-form">
          <textarea
            style={s.editTextarea}
            placeholder="What would you change about this plan?"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            data-testid="partner-plan-edit-textarea"
          />
          <div style={s.planActions}>
            <button
              type="button"
              style={s.approveBtn}
              onClick={submitEdit}
              data-testid="partner-plan-edit-submit"
            >
              Send revisions
            </button>
            <button
              type="button"
              style={s.rejectBtn}
              onClick={() => { setEditOpen(false); setEditNotes(""); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status !== "pending" && (
        <span style={s.planStatusTag} data-testid={`partner-plan-status-${status}`}>
          {status === "executed" ? "Built" :
           status === "rejected" ? "Rejected — Partner revising" :
           status === "approved" ? "Building…" : ""}
        </span>
      )}
    </div>
  );
}
