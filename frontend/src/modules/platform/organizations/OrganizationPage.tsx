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
        <div className="org-layout">
          {/* Left Column: Create Organisation Form */}
          <div className="org-layout__form-col">
            <div className="org-section-header">
              <div className="org-section-header__icon">
                <Building2 size={18} />
              </div>
              <div>
                <h2>Create organisation</h2>
                <p>Register a new company workspace</p>
              </div>
            </div>

            <form className="ui-form" onSubmit={create}>
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
          <div className="org-layout__list-col">
            <div className="org-section-header" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="org-section-header__icon org-section-header__icon--accent">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2>Available organisations</h2>
                  <p>Select an active workspace</p>
                </div>
              </div>
              <span className="badge badge--info">{items.length} total</span>
            </div>

            <div className="org-list">
              {items.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                  No organisations found. Create one using the form on the left.
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = organizationApi.selectedId() === item.id;
                  return (
                    <button
                      type="button"
                      className={`org-row ${isSelected ? "selected" : ""}`}
                      key={item.id}
                      onClick={() => {
                        organizationApi.select(item);
                        setMessage(`"${item.name}" selected.`);
                      }}
                    >
                      <span className="org-row__info">
                        <b>{item.name}</b>
                        <small>{item.code}</small>
                      </span>
                      {isSelected && (
                        <span className="org-row__check">
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

