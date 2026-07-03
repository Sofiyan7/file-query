"use client";

import * as React from "react";
import { Upload, Loader2, FileUp } from "lucide-react";

interface FileUploadProps {
  userId: string;
  onUploadComplete?: () => void;
}

const FileUploadComponent: React.FC<FileUploadProps> = ({ userId, onUploadComplete }) => {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        console.log("File uploaded successfully");
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to upload file");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error connecting to upload server");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf" || ext === "docx" || ext === "doc") {
        uploadFile(file);
      } else {
        alert("Only PDF, DOCX, and DOC files are supported");
      }
    }
  };

  const triggerFileSelect = () => {
    const el = document.createElement("input");
    el.setAttribute("type", "file");
    el.setAttribute("accept", ".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    el.addEventListener("change", (ev: any) => {
      if (el.files && el.files.length > 0) {
        const file = el.files.item(0);
        if (file) uploadFile(file);
      }
    });
    el.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={isUploading ? undefined : triggerFileSelect}
      className={`border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2.5 transition duration-200 cursor-pointer ${
        isDragOver
          ? "border-indigo-500 bg-neutral-800/40 text-neutral-100"
          : isUploading
          ? "border-neutral-800 bg-neutral-900/30 text-neutral-500 cursor-not-allowed"
          : "border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/40 text-neutral-400 hover:border-neutral-700"
      }`}
    >
      {isUploading ? (
        <>
          <Loader2 className="size-6 text-indigo-400 animate-spin" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-neutral-300">Uploading...</span>
            <span className="text-xs text-neutral-500">Indexing content into vector store</span>
          </div>
        </>
      ) : (
        <>
          <div className="p-2.5 rounded-lg bg-neutral-800/80 text-neutral-300 shrink-0">
            <FileUp className="size-5 text-indigo-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-neutral-200">Upload documents</span>
            <span className="text-xs text-neutral-500">Drag & drop or click to browse</span>
            <span className="text-xxs text-neutral-600 mt-1">Supports PDF, DOCX, DOC</span>
          </div>
        </>
      )}
    </div>
  );
};

export default FileUploadComponent;
