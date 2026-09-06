import { twMerge } from 'tailwind-merge';
import { useEffect, useState } from "react";
import { Building2, Check } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { Notice } from "../../../components/ui/Notice";
import { organizationApi, type Organization } from "./organization.api";
export function OrganizationPage() {
  const [items, setItems] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      setItems((await organizationApi.list()).data);
      setMessage("");
    } catch (e: any) {
      setMessage(`API is not reachable (${e.message}). Ensure backend is running on port 4000.`);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await organizationApi.create({ name, code });
      organizationApi.select(result.data);
      setName("");
      setCode("");
      setMessage("Organisation selected.");
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create organisation",
      );
    }
  };
  return (
    <PageContainer
      title="Organisations"
      description="Create an organisation once, then select it as the workspace for all inventory records."
      notice={message ? <Notice variant={message.includes("not reachable") ? "error" : "success"}>{message}</Notice> : undefined}
   >
      <Card padding="none">
        <div className="grid grid-cols-[minmax(320px,_1fr)_minmax(360px,_1.2fr)] min-h-110 max-[860px]:grid-cols-[1fr]">
          {/* Left Column: Create Organisation Form */}
          <div className="p-7 [border-right:1px_solid_#e0e5dd] bg-[#ffffff] max-[860px]:[border-right:none] max-[860px]:[border-bottom:1px_solid_#e0e5dd]">
            <div className="flex items-center gap-3 mb-6 min-h-10.5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[2px_0_0]">
              <div className="w-9.5 h-9.5 rounded-[8px] bg-[rgba(168,213,72,0.18)] text-[#0d3b2e] grid place-items-center shrink-0">
                <Building2 size={18} />
              </div>
              <div>
                <h2>Create organisation</h2>
                <p>Register a new company workspace</p>
              </div>
            </div>

            <form onSubmit={create}>
              <FormField label="Organisation name">
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nourish Feeds Ltd."
                />
              </FormField>
              <FormField label="Unique code">
                <Input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="NOURISH"
                />
              </FormField>
              <Button type="submit" variant="primary">
                Create and select
              </Button>
            </form>
          </div>

          {/* Right Column: Available Organisations List */}
          <div className="p-7 bg-[#ffffff] flex flex-col">
            <div className="flex items-center gap-3 mb-6 min-h-10.5 [:where(&_h2)]:text-[16px] [:where(&_h2)]:font-bold [:where(&_h2)]:text-[#0f1c16] [:where(&_h2)]:m-0 [:where(&_p)]:text-[12.5px] [:where(&_p)]:text-[#7a9185] [:where(&_p)]:m-[2px_0_0] justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9.5 h-9.5 rounded-[8px] bg-[rgba(27,_143,_90,_0.1)] text-[#1b8f5a] grid place-items-center shrink-0">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2>Available organisations</h2>
                  <p>Select an active workspace</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.25 p-[3px_10px] rounded-[20px] text-[11.5px] font-semibold whitespace-nowrap bg-[#e8f2ff] text-[#1864ab]">{items.length} total</span>
            </div>

            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="p-[32px_16px] text-center text-[#7a9185]">
                  No organisations found. Create one using the form on the left.
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = organizationApi.selectedId() === item.id;
                  return (
                    <button
                      type="button"
                      className={twMerge(`flex items-center justify-between w-full p-[12px_16px] [border:1px_solid_#e0e5dd] rounded-[8px] bg-[#ffffff] cursor-pointer text-left text-[#0f1c16] [transition:all_0.15s_ease] gap-3 [&:hover]:bg-[#f8faf7] [&:hover]:[border-color:#c5cec1] [&.selected]:bg-[rgba(13,_59,_46,_0.04)] [&.selected]:[border-color:#0d3b2e] [&.selected]:text-[#0d3b2e] [:where(&_b)]:block [:where(&_b)]:font-semibold [:where(&_b)]:text-[13.5px] [:where(&_small)]:block [:where(&_small)]:text-[11.5px] [:where(&_small)]:text-[#7a9185] [:where(&_small)]:mt-0.5 [:where(&_small)]:tracking-[0.04em] ${(isSelected ? "selected" : "")}`)}
                      key={item.id}
                      onClick={() => {
                        organizationApi.select(item);
                        setMessage(`"${item.name}" selected.`);
                      }}
                   >
                      <span className="flex-1 min-w-0">
                        <b>{item.name}</b>
                        <small>{item.code}</small>
                      </span>
                      {isSelected && (
                        <span className="flex items-center justify-center w-5.5 h-5.5 rounded-full bg-[#eaf8f0] text-[#1b8f5a] shrink-0">
                          <Check size={16} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}

