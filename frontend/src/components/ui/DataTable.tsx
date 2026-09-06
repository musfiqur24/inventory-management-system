import type { ReactNode } from 'react';

interface Props {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
}

export function DataTable({ columns, children, empty }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-140 border-collapse [:where(&_th)]:p-[10px_16px] [:where(&_th)]:text-left [:where(&_th)]:text-[11px] [:where(&_th)]:font-bold [:where(&_th)]:tracking-[0.07em] [:where(&_th)]:uppercase [:where(&_th)]:text-[#7a9185] [:where(&_th)]:bg-[#f8faf7] [:where(&_th)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:p-[13px_16px] [:where(&_td)]:[border-bottom:1px_solid_#e0e5dd] [:where(&_td)]:text-[13.5px] [:where(&_td)]:text-[#0f1c16] [&_tbody_tr]:[transition:background_0.1s] [&_tbody_tr:hover]:bg-[#f8faf7] [&_tbody_tr:last-child_td]:[border-bottom:0]">
        <thead>
          <tr>
            {columns.map((col) => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {children}
        </tbody>
      </table>
      {empty}
    </div>
  );
}
