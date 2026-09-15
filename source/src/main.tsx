import React from "react";
import {createRoot} from "react-dom/client";
import Reader from "../components/reader";
import "../app/globals.css";
import "katex/dist/katex.min.css";
createRoot(document.getElementById("root")!).render(<Reader />);
