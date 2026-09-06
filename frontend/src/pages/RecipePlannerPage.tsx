import { DataTable } from "../components/ui/DataTable";
import { Card } from '../components/ui/Card';
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
      <div className="grid grid-cols-[1fr_1.2fr] gap-5 max-[900px]:grid-cols-[1fr]">
        {/* Editor Panel */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-0">
            <div>
              <h2>Production Requirement</h2>
              <p>Set target tonnage and acceptable waste percentage</p>
            </div>
            <Calculator size={22} className="text-[#0d3b2e]" />
          </div>

          <div className="grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3.5 max-[900px]:grid-cols-[1fr] mb-5">
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

          <div className="[border-top:1px_solid_#e0e5dd] pt-4">
            <div className="flex justify-between items-center mb-3">
              <strong className="text-[14px]">Recipe per 1 Tonne</strong>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPerTon([...perTon, { material: "", qty: 0 }])}
             >
                <Plus size={14} /> Add Ingredient
              </Button>
            </div>

            {perTon.length === 0 && (
              <div className="p-[20px_0] text-[#7a9185] text-[13px] text-center">
                No ingredients yet. Add one above.
              </div>
            )}

            {perTon.map((line, index) => (
              <div
                key={index}
                 className="grid grid-cols-[1fr_120px_36px] gap-2 mb-2 items-end"
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
                  className="h-10 [border:1px_solid_#e0e5dd] rounded-[8px] bg-[#f8faf7] cursor-pointer grid place-items-center text-[#c03030]"
               >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Auto-calculated FM Requisition */}
        <Card className="p-0">
          <div className="flex items-center justify-between gap-3 p-[18px_24px] [border-bottom:1px_solid_#e0e5dd] [:where(&_h2)]:text-[15px] [:where(&_h2)]:font-bold [:where(&_h2)]:m-0">
            <h2>Auto-Calculated FM Requisition</h2>
            <span className="text-[12px] text-[#7a9185]">
              {target}T + {waste}% waste
            </span>
          </div>
          <div className="overflow-x-auto">
            <DataTable columns={["Raw Material","Per Tonne (kg)","Required Quantity"]}>
                {plan.map((line, i) => (
                  <tr key={i}>
                    <td><strong>{line.material || "—"}</strong></td>
                    <td>{line.qty.toLocaleString()} kg</td>
                    <td>
                      <strong className="text-[#0d3b2e] text-[15px]">
                        {line.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                      </strong>
                    </td>
                  </tr>
                ))}
              </DataTable>
            {plan.length === 0 && (
              <div className="flex flex-col items-center justify-center p-[48px_24px] text-center [:where(&_b)]:text-[15px] [:where(&_b)]:font-semibold [:where(&_b)]:text-[#0f1c16] [:where(&_p)]:text-[13px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[6px_0_0] [:where(&_p)]:max-w-70">
                <div className="w-14 h-14 rounded-[12px] bg-[#f8faf7] grid place-items-center mb-4 text-[#7a9185] [:where(&_svg)]:w-7 [:where(&_svg)]:h-7"><Calculator size={28} /></div>
                <b>No ingredients added</b>
                <p>Add raw material ingredients and set a target tonnage to see calculations.</p>
              </div>
            )}
          </div>
          <div className="p-[12px_16px] [border-top:1px_solid_#e0e5dd] text-[12px] text-[#7a9185]">
            Save the approved recipe as a version in Recipes, then create a Production Order from this plan.
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
