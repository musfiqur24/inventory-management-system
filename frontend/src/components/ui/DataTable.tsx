import type { ReactNode } from 'react';

interface Props {
  columns: string[];
  children: ReactNode;
  empty?: ReactNode;
}

export function DataTable({ columns, children, empty }: Props) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
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
