import { useState } from "react";
import { HomeTab } from "./HomeTab";
import { InsertTab } from "./InsertTab";
import { LayoutTab } from "./LayoutTab";
import { ReviewTab } from "./ReviewTab";
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { Editor } from "@tiptap/core";
import { cn } from "@/lib/utils";

interface RibbonBarProps {
  editor: Editor;
}

type RibbonTab = "home" | "insert" | "layout" | "review";

export function RibbonBar({ editor }: RibbonBarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("home");

  const tabs = [
    { id: "home" as const, label: "Inicio" },
    { id: "insert" as const, label: "Insertar" },
    // { id: "layout" as const, label: "Diseño" },
    { id: "review" as const, label: "Revisar" },
  ];

  return (
    <div className="ribbon-container">
      {/* Tab Headers */}
      <div className="ribbon-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "ribbon-tab",
              activeTab === tab.id && "ribbon-tab-active",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="ribbon-content">
        {activeTab === "home" && <HomeTab editor={editor} />}
        {activeTab === "insert" && <InsertTab editor={editor} />}
        {activeTab === "layout" && <LayoutTab editor={editor} />}
        {activeTab === "review" && <ReviewTab editor={editor} />}
      </div>
    </div>
  );
}
