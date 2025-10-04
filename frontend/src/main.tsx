import { ConfigProvider } from "antd";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "antd/dist/reset.css";
import "./index.css";

// Ensure the root element exists
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
          borderRadius: 4,
          colorBgContainer: "#ffffff",
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
