"use client";
// CIVITAS OS — DocsView: pustaka dokumen (docs/**) dibaca dari API — docs rapi & satu sumber.

import { useCallback, useEffect, useState } from "react";
import { MCButton, MCPanel, MCSectionTitle } from "../mcui";
import Markdown from "react-markdown";

export default function DocsView() {
  const [files, setFiles] = useState<{ path: string; size: number }[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const load = useCallback(async (file?: string) => {
    const q = file ? `?file=${encodeURIComponent(file)}` : "";
    const res = await fetch(`/api/civos/docs${q}`);
    const j = (await res.json()) as { ok: boolean; files?: { path: string; size: number }[]; file?: string; content?: string };
    if (j.ok && j.files) setFiles(j.files);
    if (j.ok && j.content !== undefined) { setContent(j.content); setCurrent(j.file ?? null); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load("civitas-os/CANONICAL.md"), 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <MCPanel dark className="lg:col-span-1">
        <MCSectionTitle>DOKUMEN ({files.length})</MCSectionTitle>
        <div className="mc-inset-dark p-2 max-h-[520px] overflow-y-auto mc-scroll">
          {files.map((f) => (
            <button key={f.path} onClick={() => void load(f.path)} className={`block w-full text-left mc-body text-[14px] px-2 py-1 border-b border-white/10 hover:bg-white/10 ${current === f.path ? "bg-white/15" : ""}`}>
              📄 {f.path} <span className="text-white/40">({Math.round(f.size / 1024)}KB)</span>
            </button>
          ))}
        </div>
      </MCPanel>
      <MCPanel className="lg:col-span-3">
        <MCSectionTitle>{current ?? "PILIH DOKUMEN"}</MCSectionTitle>
        <div className="mc-inset p-4 max-h-[560px] overflow-y-auto mc-scroll prose prose-sm max-w-none text-black">
          <Markdown>{content}</Markdown>
        </div>
        <div className="mt-3 flex gap-2">
          <MCButton onClick={() => void load()}>MUAT ULANG DAFTAR</MCButton>
        </div>
      </MCPanel>
    </div>
  );
}
