// Permite correr los tests (node --experimental-strip-types) con imports sin extensión, como en el sitio.
// Uso: node --experimental-strip-types --import ./scripts/ts-extensionless.mjs scripts/test-insights.mts
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (e && e.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw e;
    }
  },
});
