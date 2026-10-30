import { createRoot } from "react-dom/client";
import "./styles.css";
import "./brand.css";
import("./App").then(({ default: App }) =>
  createRoot(document.getElementById("root")!).render(<App />),
);
