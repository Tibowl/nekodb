declare module "katex" {
  export type KatexOptions = {
    displayMode?: boolean
    throwOnError?: boolean
    strict?: boolean | "ignore" | "warn" | "error"
    trust?: boolean
    output?: "html" | "mathml" | "htmlAndMathml"
  }

  export function renderToString(tex: string, options?: KatexOptions): string
}
