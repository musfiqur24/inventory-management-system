import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
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
    <section className="page">
      <div className="page-title">
        <div>
          <p className="cap">NUTRITION & PRODUCTION</p>
          <h1>Recipe scaling planner</h1>
          <span>
            Enter the recipe per tonne, target production quantity and permitted
            waste.
          </span>
        </div>
      </div>
      <div className="two-col">
        <div className="card editor">
          <Calculator />
          <h2>Production requirement</h2>
          <div className="form-grid">
            <label>
              Target finished goods (tonnes)
              <input
                type="number"
                min="0"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </label>
            <label>
              Expected waste (%)
              <input
                type="number"
                min="0"
                value={waste}
                onChange={(e) => setWaste(Number(e.target.value))}
              />
            </label>
          </div>
          <h3>Recipe per 1 tonne</h3>
          {perTon.map((line, index) => (
            <div className="recipe-line" key={line.material}>
              <input
                value={line.material}
                onChange={(e) =>
                  setPerTon(
                    perTon.map((item, i) =>
                      i === index
                        ? { ...item, material: e.target.value }
                        : item,
                    ),
                  )
                }
              />
              <input
                type="number"
                value={line.qty}
                onChange={(e) =>
                  setPerTon(
                    perTon.map((item, i) =>
                      i === index
                        ? { ...item, qty: Number(e.target.value) }
                        : item,
                    ),
                  )
                }
              />
              <span>kg</span>
            </div>
          ))}
          <button
            onClick={() =>
              setPerTon([...perTon, { material: "", qty: 0 }])
            }
          >
            Add ingredient
          </button>
        </div>
        <div className="card resource-table">
          <p className="cap">AUTO-CALCULATED FM REQUISITION</p>
          <h2>
            {target} tonnes + {waste}% waste
          </h2>
          <table>
            <thead>
              <tr>
                <th>Raw material</th>
                <th>Required quantity</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((line) => (
                <tr key={line.material}>
                  <td>{line.material}</td>
                  <td>
                    <b>
                      {line.required.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      kg
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="notice">
            Save the approved recipe as a version in Recipes, then create a
            Production Order from this plan.
          </p>
        </div>
      </div>
    </section>
  );
}
