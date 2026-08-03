"use client";

import Button from "@/components/ui/Button";

interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function SaveBar({ dirty, saving, onSave }: SaveBarProps) {
  if (!dirty && !saving) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-[220px] bg-av-navy px-4 md:px-8 py-3 flex items-center justify-between z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
      <span className="text-sm font-body text-white">
        {saving ? "Saving..." : "Unsaved changes"}
      </span>
      <Button onClick={onSave} disabled={saving} className="min-w-[100px]">
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
