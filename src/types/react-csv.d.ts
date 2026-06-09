declare module "react-csv" {
  import type { ComponentType, ReactNode } from "react";

  export interface CSVLinkProps {
    data: Record<string, unknown>[];
    headers?: { label: string; key: string }[];
    filename?: string;
    className?: string;
    children?: ReactNode;
  }

  export const CSVLink: ComponentType<CSVLinkProps>;
}
