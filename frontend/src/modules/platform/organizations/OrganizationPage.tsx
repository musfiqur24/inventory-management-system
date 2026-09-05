import { useEffect, useState } from "react";
import { Building2, Check } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PageContainer } from "../../../components/ui/PageContainer";
import { Card } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
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
    >
      <div className="two-col">
        <Card>
          <form className="ui-form" onSubmit={create}>
            <Building2 />
            <h2>Create organisation</h2>
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
        </Card>

        <Card padding="none">
          <div className="table-title">
            <h2>Available organisations</h2>
          </div>
          {message && <p className="notice">{message}</p>}
          {items.map((item) => (
            <button
              type="button"
              className={`org-row ${organizationApi.selectedId() === item.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => {
                organizationApi.select(item);
                setMessage(`"${item.name}" selected.`);
              }}
            >
              <span>
                <b>{item.name}</b>
                <small>{item.code}</small>
              </span>
              {organizationApi.selectedId() === item.id && <Check />}
            </button>
          ))}
        </Card>
      </div>
    </PageContainer>
  );
}

