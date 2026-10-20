import fs from "node:fs";
import path from "path";

// Only repository-owned SVGs are embedded. No third-party SVG/CSS optimizer is needed.
export default function createSvgIcon() {
  const directory = path.resolve(process.cwd(), "src/assets/icons/svg");
  const moduleId = "virtual:svg-icons-register";
  function symbols(folder = directory) {
    return fs
      .readdirSync(folder, { withFileTypes: true })
      .map((entry) => {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) return symbols(file);
        if (!entry.isFile() || !entry.name.endsWith(".svg")) return "";
        const source = fs.readFileSync(file, "utf8");
        const svg = source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
        if (!svg) throw new Error("Invalid repository SVG: " + file);
        const box =
          svg[1].match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ||
          "0 0 1024 1024";
        const id =
          "icon-" +
          path
            .relative(directory, file)
            .replace(/\\/g, "/")
            .replace(/\//g, "-")
            .replace(/\.svg$/, "");
        return `<symbol id="${id}" viewBox="${box}">${svg[2]}</symbol>`;
      })
      .join("");
  }
  return {
    name: "ktv-local-svg-icons",
    resolveId(id) {
      if (id === moduleId) return "\0" + moduleId;
    },
    load(id) {
      if (id !== "\0" + moduleId) return;
      const sprite = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="__svg__icons__dom__" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${symbols()}</svg>`;
      return `if (!document.getElementById('__svg__icons__dom__')) document.body.insertAdjacentHTML('afterbegin', ${JSON.stringify(sprite)});`;
    },
    configureServer(server) {
      server.watcher.add(directory);
      server.watcher.on("change", (file) => {
        if (file.startsWith(directory) && file.endsWith(".svg"))
          server.ws.send({ type: "full-reload" });
      });
    },
  };
}
