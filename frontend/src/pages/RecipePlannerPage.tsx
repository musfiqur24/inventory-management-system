import { useMemo, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { PageContainer } from "../components/ui/PageContainer";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";

export function RecipePlannerPage() {
  const [perTon, setPerTon] = useState<{ material: string; qty: number }[]>([]);
  const [target, setTarget] = useState(0);
  const [waste, setWaste] = useState(0);

  const plan = useMemo(
    () =>
      perTon.map((line) => ({
        ...line,
        required: line.qty * target * (1 + waste / 100),
      })),
    [perTon, target, waste],
  );

  return (
    <PageContainer
      cap="NUTRITION & PRODUCTION"
      title="Recipe Scaling Planner"
      description="Enter the recipe per tonne, target production quantity and permitted waste. Requirements are auto-calculated."
    >
      <div className="two-col">
        {/* Editor Panel */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Production Requirement</h2>
              <p>Set target tonnage and acceptable waste percentage</p>
            </div>
            <Calculator size={22} style={{ color: "var(--brand-primary)" }} />
          </div>

          <div className="ui-form-grid" style={{ marginBottom: 20 }}>
            <FormField label="Target Finished Goods (Tonnes)">
              <Input
                type="number"
                min="0"
                value={target || ""}
                placeholder="e.g. 5"
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </FormField>
            <FormField label="Expected Waste (%)">
              <Input
                type="number"
                min="0"
                value={waste || ""}
                placeholder="e.g. 2.5"
                onChange={(e) => setWaste(Number(e.target.value))}
              />
            </FormField>
          </div>

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>Recipe per 1 Tonne</strong>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPerTon([...perTon, { material: "", qty: 0 }])}
              >
                <Plus size={14} /> Add Ingredient
              </Button>
            </div>

            {perTon.length === 0 && (
              <div style={{ padding: "20px 0", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
                No ingredients yet. Add one above.
              </div>
            )}

            {perTon.map((line, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 36px",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "flex-end",
                }}
              >
                <FormField label={index === 0 ? "Raw Material" : ""}>
                  <Input
                    placeholder="e.g. Yellow Corn"
                    value={line.material}
                    onChange={(e) =>
                      setPerTon(perTon.map((item, i) => i === index ? { ...item, material: e.target.value } : item))
                    }
                  />
                </FormField>
                <FormField label={index === 0 ? "Qty (kg/ton)" : ""}>
                  <Input
                    type="number"
                    placeholder="e.g. 650"
                    value={line.qty || ""}
                    onChange={(e) =>
                      setPerTon(perTon.map((item, i) => i === index ? { ...item, qty: Number(e.target.value) } : item))
                    }
                  />
                </FormField>
                <button
                  onClick={() => setPerTon(perTon.filter((_, i) => i !== index))}
                  style={{
                    height: 40,
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    background: "var(--bg-card-alt)",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--error)",
                    marginBottom: index === 0 ? 0 : undefined,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-calculated FM Requisition */}
        <div className="card" style={{ padding: 0 }}>
          <div className="table-header">
            <h2>Auto-Calculated FM Requisition</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {target}T + {waste}% waste
            </span>
          </div>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Raw Material</th>
                  <th>Per Tonne (kg)</th>
                  <th>Required Quantity</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((line, i) => (
                  <tr key={i}>
                    <td><strong>{line.material || "—"}</strong></td>
                    <td>{line.qty.toLocaleString()} kg</td>
                    <td>
                      <strong style={{ color: "var(--brand-primary)", fontSize: 15 }}>
                        {line.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.length === 0 && (
              <div className="empty-state">
                <div className="empty-state__icon"><Calculator size={28} /></div>
                <b>No ingredients added</b>
                <p>Add raw material ingredients and set a target tonnage to see calculations.</p>
              </div>
            )}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
            Save the approved recipe as a version in Recipes, then create a Production Order from this plan.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
