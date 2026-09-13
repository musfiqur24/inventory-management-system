import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { twMerge } from "tailwind-merge";
interface DropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: "default" | "sidebar";
  controlClassName?: string;
}
type Option = { value: string; label: string; disabled: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textOf(child.props.children)
        : String(child),
    )
    .join("");
}
function optionsOf(children: ReactNode, disabled = false): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "optgroup" || child.type === Fragment)
      return optionsOf(
        child.props.children,
        disabled || !!child.props.disabled,
      );
    if (child.type !== "option") return [];
    const label = textOf(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: disabled || !!child.props.disabled,
      },
    ];
  });
}
export function Dropdown({
  className,
  controlClassName,
  children,
  disabled,
  variant = "default",
  value,
  defaultValue,
  onChange,
  id,
  required,
  name,
  ...props
}: DropdownProps) {
  const uid = useId(),
    listId = uid + "-options";
  const wrapper = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    select = useRef<HTMLSelectElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const options = optionsOf(children);
  // Empty-valued filter choices are meaningful; placeholder instructions are not options.
  const placeholderOption = options.find(
    (o) =>
      o.value === "" && !/^(all\b|any\b|in and out\b)/i.test(o.label.trim()),
  );
  const choices = options.filter((o) => o !== placeholderOption);
  const [internal, setInternal] = useState(
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const current = String(value ?? internal),
    selected = choices.find((o) => o.value === current);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(-1);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
  });
  const filtered = choices.filter((o) =>
    o.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const sidebar = variant === "sidebar";
  const placeholder =
    placeholderOption?.label.replace(/^[\s\u2014\u2013-]+|[\s\u2014\u2013-]+$/g, "") ||
    "Type to search...";
  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(-1);
  };
  const choose = (option: Option) => {
    if (disabled || option.disabled) return;
    setInternal(option.value);
    if (select.current) {
      select.current.value = option.value;
      select.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
    input.current?.focus();
  };
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected ? "Choose an option from the list." : "",
    );
  }, [required, selected]);
  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  useEffect(() => {
    const form = select.current?.form;
    const reset = () => {
      setInternal(String(defaultValue ?? options[0]?.value ?? ""));
      close();
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, children]);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = wrapper.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 12,
        above = box.top - 12,
        desiredHeight = Math.min(260, Math.max(60, filtered.length * 41 + 8)),
        up = below < desiredHeight && above > below;
      const height = Math.max(
        60,
        Math.min(desiredHeight, up ? above : below),
      );
      setPosition({
        left: Math.max(
          8,
          Math.min(box.left, window.innerWidth - box.width - 8),
        ),
        top: up ? Math.max(8, box.top - height - 4) : box.bottom + 4,
        width: Math.min(box.width, window.innerWidth - 16),
        maxHeight: height,
      });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (
        !wrapper.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, filtered.length]);
  useEffect(() => {
    if (active >= 0)
      menu.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <div
      ref={wrapper}
      className={twMerge(
        "group relative",
        sidebar ? "min-w-0 flex-1" : "w-full",
        className,
      )}
    >
      <select
        {...props}
        ref={select}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        disabled={disabled}
        value={current}
        onChange={onChange}
      >
        {children}
      </select>
      <input
        ref={input}
        id={id ?? uid}
        role="combobox"
        aria-label={props["aria-label"] ?? placeholder}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 && filtered[active]
            ? listId + "-" + active
            : undefined
        }
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={open ? query : (selected?.label ?? "")}
        placeholder={open ? "Type to search..." : placeholder}
        onClick={() => {
          if (!open) {
            setQuery("");
            setActive(-1);
            setOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onBlur={() => close()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key === "Tab") {
            close();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            let next = active;
            for (let n = 0; n < filtered.length; n++) {
              next = (next + step + filtered.length) % filtered.length;
              if (!filtered[next].disabled) {
                setActive(next);
                break;
              }
            }
            return;
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active >= 0 && filtered[active]) choose(filtered[active]);
            else if (filtered.filter((o) => !o.disabled).length === 1)
              choose(filtered.find((o) => !o.disabled)!);
          }
        }}
        className={twMerge(
          "w-full outline-none transition disabled:cursor-not-allowed disabled:opacity-55",
          sidebar
            ? "h-8 border-0 bg-transparent py-1 pr-7 text-[12.5px] font-semibold text-white placeholder:text-white/60"
            : "h-11 rounded-xl border border-[#d9e2d8] bg-white px-3.5 pr-16 text-sm font-medium text-[#19362a] shadow-sm placeholder:text-[#8a9a91] hover:border-[#a9b9ad] focus:border-[#1a5c45] focus:ring-4 focus:ring-[#1a5c45]/10 disabled:bg-[#f3f5f2]",
          controlClassName,
        )}
      />
      {!disabled && placeholderOption && current !== "" && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear selection"
          className="absolute right-9 top-1/2 -translate-y-1/2 text-[#73877c] hover:text-red-600"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choose({ value: "", label: "", disabled: false })}
        >
          <X size={14} />
        </button>
      )}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open ? "Close options" : "Open options"}
        className={twMerge(
          "absolute top-1/2 grid -translate-y-1/2 place-items-center",
          sidebar
            ? "right-0 text-white/60"
            : "right-2 size-7 rounded-lg bg-[#f3f7f1] text-[#587064]",
        )}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          input.current?.focus();
          setQuery("");
          setActive(-1);
          setOpen((v) => !v);
        }}
      >
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={props["aria-label"] ?? "Options"}
            style={{ position: "fixed", ...position, zIndex: 200 }}
            className="overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-[#d9e2d8] bg-white p-1 shadow-xl"
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.map((option, index) => (
              <div
                key={option.value}
                id={listId + "-" + index}
                role="option"
                aria-selected={option.value === current}
                aria-disabled={option.disabled}
                data-active={index === active}
                onMouseMove={() => {
                  if (!option.disabled) setActive(index);
                }}
                onClick={() => choose(option)}
                className={twMerge(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-[#19362a]",
                  index === active && "bg-[#edf5e8]",
                  option.value === current && "font-semibold text-[#1a5c45]",
                  option.disabled && "cursor-not-allowed opacity-40",
                )}
              >
                <span className="min-w-0 break-words leading-5">{option.label}</span>
                {option.value === current && (
                  <Check size={15} className="shrink-0" />
                )}
              </div>
            ))}
            {!filtered.length && (
              <div
                role="status"
                className="px-3 py-5 text-center text-sm text-[#73877c]"
              >
                {choices.length
                  ? "No matching options"
                  : "No options available"}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
